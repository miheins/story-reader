-- Folio on Supabase: reading lists opened with a pass phrase. No user accounts.
--
-- Run once: Supabase dashboard → SQL Editor → paste all of this → Run. Safe to run again.
-- Then set your admin key (the one line at the very bottom, with your own key).
--
-- How it is protected
--   * The tables are closed: row-level security is on with no policies, and the public
--     API roles have no rights on them. Nobody can read or write them directly from a browser.
--   * Everything goes through the functions below:
--       a list's VISIBILITY decides who can read it: public (listed on the start page),
--         unlisted (anyone with the address) or private (pass phrase needed);
--       the list's PASS PHRASE is needed to add notes, and to read a private list;
--       the ADMIN KEY is needed for articles, list settings, putting a list online or taking it offline.
--   * Pass phrases and the admin key are stored only as bcrypt hashes, so every guess is slow.
--   * There is no lock-out (it would let anyone lock a list for everyone). Instead pass phrases are long:
--     the app generates five random words (about 52 bits), and the database refuses anything under 16 characters.
--     Keep the admin key long too.
--   * Functions return {"error": ...} instead of raising.
--   * An unknown list and a wrong pass phrase give the same answer, so private lists can't be discovered.

create extension if not exists pgcrypto with schema extensions;

-- An earlier draft of this file used per-account tables (owner_id). Remove them if present.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'folio_lists' and column_name = 'owner_id') then
    drop table if exists public.folio_notes, public.folio_articles, public.folio_categories, public.folio_lists;
  end if;
end $$;

create table if not exists public.folio_admin (
  one      boolean primary key default true check (one),   -- a single row
  key_hash text not null
);

create table if not exists public.folio_lists (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug <> ''),       -- the address: #list-<slug>
  name       text not null,
  alt        jsonb not null default '[]',                   -- earlier slugs, so old addresses keep working
  key_hash   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- added later: an intro shown under Folio, above the tabs (admin sets it)
alter table public.folio_lists add column if not exists intro text not null default '';
-- added later: who can read the list without its pass phrase
alter table public.folio_lists add column if not exists visibility text not null default 'private';
do $$ begin
  alter table public.folio_lists add constraint folio_lists_visibility check (visibility in ('public', 'unlisted', 'private'));
exception when duplicate_object then null; end $$;

create table if not exists public.folio_articles (
  list_id  uuid not null references public.folio_lists (id) on delete cascade,
  id       text not null,                                   -- the app's id: a hash of the URL
  url      text not null,
  title    text not null default '',
  site     text not null default '',
  kind     text not null default 'story' check (kind in ('story', 'link')),   -- 'link' = "Just link"
  img      text,
  added    date,
  position integer not null default 0,
  cat_name text,                                            -- category, by name and colour index
  cat_c    smallint,
  primary key (list_id, id)
);
alter table public.folio_articles add column if not exists why text not null default '';   -- "why I added this", shown under the headline

create table if not exists public.folio_notes (
  list_id     uuid not null references public.folio_lists (id) on delete cascade,
  id          text not null,
  article_id  text not null,
  pos         integer not null default 0,
  where_label text not null default '',
  excerpt     text not null default '',
  body        text not null default '',                     -- empty for a remembered slide
  liked       boolean not null default false,               -- "Remember"
  noted_at    bigint not null default 0,                    -- milliseconds since 1970
  title       text not null default '',
  site        text not null default '',
  url         text not null default '',
  primary key (list_id, id)
);

alter table public.folio_admin    enable row level security;
-- added later: the name a reader gives with a note (optional)
alter table public.folio_notes add column if not exists author text not null default '';

alter table public.folio_lists    enable row level security;
alter table public.folio_articles enable row level security;
alter table public.folio_notes    enable row level security;
revoke all on public.folio_admin, public.folio_lists, public.folio_articles, public.folio_notes from anon, authenticated;

-- ---------- helpers (not callable from the API) ----------

-- Older versions of these functions raised errors and had other return types: remove them first.
drop function if exists public.folio__admin(text);
drop function if exists public.folio__list(text, text);
drop function if exists public.folio_check_admin(text);
drop function if exists public.folio_publish(text, text, text, text);
drop function if exists public.folio_set_key(text, uuid, text);
drop function if exists public.folio_delete_list(text, uuid);
drop function if exists public.folio_push(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.folio_push(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text);

-- A draft of this file locked lists after wrong guesses; that is gone (anyone could lock a list for everyone).
drop function if exists public.folio__locked(text);
drop function if exists public.folio__fail(text);
drop table if exists public.folio_fails;

-- The admin key: null when it is right, otherwise the error code.
create or replace function public.folio__admin_err(p_admin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select key_hash into h from folio_admin;
  if h is null then return 'FOLIO_NOADMIN'; end if;
  if h is distinct from crypt(coalesce(p_admin, ''), h) then return 'FOLIO_ADMIN'; end if;
  return null;
end $$;

-- A list by id, address or an earlier address; null if there is none.
create or replace function public.folio__find(p_ref text) returns public.folio_lists
language sql security definer set search_path = public as $$
  select * from folio_lists where id::text = p_ref or slug = lower(trim(p_ref)) or alt ? lower(trim(p_ref))
  order by (id::text = p_ref) desc, (slug = lower(trim(p_ref))) desc limit 1
$$;

-- A list's pass phrase: null when it is right, otherwise the error code.
create or replace function public.folio__key_err(l public.folio_lists, p_key text) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if l.id is null then return 'FOLIO_NOMATCH'; end if;
  if l.key_hash is distinct from crypt(coalesce(p_key, ''), l.key_hash) then return 'FOLIO_NOMATCH'; end if;
  return null;
end $$;

-- Run from the SQL editor only: select public.folio_set_admin_key('your long admin key');
create or replace function public.folio_set_admin_key(p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if char_length(coalesce(p_key, '')) < 16 then raise exception 'FOLIO_SHORT'; end if;
  insert into folio_admin (one, key_hash) values (true, crypt(p_key, gen_salt('bf', 10)))
  on conflict (one) do update set key_hash = excluded.key_hash;
end $$;

-- ---------- the API: every function returns {"error": "FOLIO_..."} when it refuses ----------

create or replace function public.folio_ping() returns boolean language sql stable as $$ select true $$;

-- Admin: check the admin key (the app's "Unlock admin").
create or replace function public.folio_check_admin(p_admin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e text := folio__admin_err(p_admin);
begin
  if e is not null then return jsonb_build_object('error', e); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Admin: put a list online under a pass phrase. Returns its id.
create or replace function public.folio_publish(p_admin text, p_slug text, p_name text, p_key text, p_visibility text default 'private') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid; e text := folio__admin_err(p_admin);
begin
  if e is not null then return jsonb_build_object('error', e); end if;
  if char_length(coalesce(p_key, '')) < 16 then return jsonb_build_object('error', 'FOLIO_SHORT'); end if;
  if coalesce(p_visibility, 'private') not in ('public', 'unlisted', 'private') then return jsonb_build_object('error', 'FOLIO_VIS'); end if;
  begin
    insert into folio_lists (slug, name, key_hash, visibility)
    values (lower(trim(p_slug)), left(coalesce(nullif(trim(p_name), ''), p_slug), 80), crypt(p_key, gen_salt('bf', 10)), coalesce(p_visibility, 'private'))
    returning id into v;
  exception when unique_violation then return jsonb_build_object('error', 'FOLIO_SLUG');
  end;
  return jsonb_build_object('id', v);
end $$;

-- Admin: change a list's pass phrase. Devices holding the old one can't add notes until given the new one.
create or replace function public.folio_set_key(p_admin text, p_list uuid, p_key text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e text := folio__admin_err(p_admin);
begin
  if e is not null then return jsonb_build_object('error', e); end if;
  if char_length(coalesce(p_key, '')) < 16 then return jsonb_build_object('error', 'FOLIO_SHORT'); end if;
  update folio_lists set key_hash = crypt(p_key, gen_salt('bf', 10)), updated_at = now() where id = p_list;
  if not found then return jsonb_build_object('error', 'FOLIO_NOMATCH'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Admin: who can read the list without its pass phrase.
create or replace function public.folio_set_visibility(p_admin text, p_list uuid, p_visibility text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e text := folio__admin_err(p_admin);
begin
  if e is not null then return jsonb_build_object('error', e); end if;
  if p_visibility not in ('public', 'unlisted', 'private') then return jsonb_build_object('error', 'FOLIO_VIS'); end if;
  update folio_lists set visibility = p_visibility, updated_at = now() where id = p_list;
  if not found then return jsonb_build_object('error', 'FOLIO_NOMATCH'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Admin: take a list offline (deletes its online copy; devices keep theirs).
create or replace function public.folio_delete_list(p_admin text, p_list uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e text := folio__admin_err(p_admin);
begin
  if e is not null then return jsonb_build_object('error', e); end if;
  delete from folio_lists where id = p_list;
  return jsonb_build_object('ok', true);
end $$;

-- Anyone: the public lists, for the start page.
create or replace function public.folio_directory() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'slug', l.slug, 'intro', l.intro,
           'articles', (select count(*) from folio_articles a where a.list_id = l.id)) order by l.updated_at desc), '[]'::jsonb)
  from folio_lists l where l.visibility = 'public'
$$;

-- Read a whole list. Public and unlisted lists open without a pass phrase (read only);
-- with the right pass phrase "write" is true (notes may be added). Unknown list and wrong
-- pass phrase give the same answer.
create or replace function public.folio_open(p_ref text, p_key text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l public.folio_lists := folio__find(p_ref); e text; w boolean := false;
begin
  if l.id is null then return jsonb_build_object('error', 'FOLIO_NOMATCH'); end if;
  if coalesce(p_key, '') = '' then
    if l.visibility = 'private' then return jsonb_build_object('error', 'FOLIO_NOMATCH'); end if;
  else
    e := folio__key_err(l, p_key);
    if e is not null then return jsonb_build_object('error', e); end if;
    w := true;
  end if;
  return jsonb_build_object(
    'list', jsonb_build_object('id', l.id, 'name', l.name, 'slug', l.slug, 'alt', l.alt, 'intro', l.intro, 'visibility', l.visibility),
    'write', w,
    'articles', coalesce((select jsonb_agg(to_jsonb(a) - 'list_id' order by a.position, a.id) from folio_articles a where a.list_id = l.id), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(to_jsonb(n) - 'list_id' order by n.noted_at, n.id) from folio_notes n where n.list_id = l.id), '[]'::jsonb));
end $$;

-- Save changes to a list: rows to add or update and ids to delete.
-- Notes need the pass phrase. Renaming the list (p_meta) and adding, changing or removing articles also need the admin key.
create or replace function public.folio_push(p_list uuid, p_key text, p_meta jsonb, p_articles jsonb, p_del_articles jsonb, p_notes jsonb, p_del_notes jsonb, p_admin text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l public.folio_lists := folio__find(p_list::text); e text;
begin
  e := folio__key_err(l, p_key);
  if e is not null then return jsonb_build_object('error', e); end if;
  if p_meta is not null
     or jsonb_array_length(coalesce(p_articles, '[]'::jsonb)) > 0
     or jsonb_array_length(coalesce(p_del_articles, '[]'::jsonb)) > 0 then
    e := folio__admin_err(p_admin);
    if e is not null then return jsonb_build_object('error', e); end if;
  end if;
  if p_meta is not null then
    begin
      update folio_lists set
        name = left(coalesce(nullif(trim(p_meta->>'name'), ''), name), 80),
        intro = case when p_meta ? 'intro' then left(coalesce(p_meta->>'intro', ''), 600) else intro end,
        slug = coalesce(nullif(lower(trim(p_meta->>'slug')), ''), slug),
        alt  = case when jsonb_typeof(p_meta->'alt') = 'array' then p_meta->'alt' else alt end,
        updated_at = now()
      where id = l.id;
    exception when unique_violation then return jsonb_build_object('error', 'FOLIO_SLUG');
    end;
  end if;

  delete from folio_articles where list_id = l.id and id in (select jsonb_array_elements_text(coalesce(p_del_articles, '[]'::jsonb)));
  insert into folio_articles (list_id, id, url, title, site, kind, img, added, position, cat_name, cat_c, why)
  select l.id, r.id, r.url, coalesce(r.title, ''), coalesce(r.site, ''), coalesce(r.kind, 'story'), r.img, r.added, coalesce(r.position, 0), r.cat_name, r.cat_c, left(coalesce(r.why, ''), 280)
  from jsonb_to_recordset(coalesce(p_articles, '[]'::jsonb)) as r (id text, url text, title text, site text, kind text, img text, added date, position integer, cat_name text, cat_c smallint, why text)
  where r.id is not null and r.url is not null
  on conflict (list_id, id) do update set url = excluded.url, title = excluded.title, site = excluded.site, kind = excluded.kind, img = excluded.img,
    added = excluded.added, position = excluded.position, cat_name = excluded.cat_name, cat_c = excluded.cat_c, why = excluded.why;

  delete from folio_notes where list_id = l.id and id in (select jsonb_array_elements_text(coalesce(p_del_notes, '[]'::jsonb)));
  insert into folio_notes (list_id, id, article_id, pos, where_label, excerpt, body, author, liked, noted_at, title, site, url)
  select l.id, r.id, r.article_id, coalesce(r.pos, 0), coalesce(r.where_label, ''), coalesce(r.excerpt, ''), coalesce(r.body, ''), left(coalesce(r.author, ''), 40), coalesce(r.liked, false), coalesce(r.noted_at, 0),
    coalesce(r.title, ''), coalesce(r.site, ''), coalesce(r.url, '')
  from jsonb_to_recordset(coalesce(p_notes, '[]'::jsonb)) as r (id text, article_id text, pos integer, where_label text, excerpt text, body text, author text, liked boolean, noted_at bigint, title text, site text, url text)
  where r.id is not null and r.article_id is not null
  on conflict (list_id, id) do update set article_id = excluded.article_id, pos = excluded.pos, where_label = excluded.where_label, excerpt = excluded.excerpt,
    body = excluded.body, author = excluded.author, liked = excluded.liked, noted_at = excluded.noted_at, title = excluded.title, site = excluded.site, url = excluded.url;

  update folio_lists set updated_at = now() where id = l.id;
  return jsonb_build_object('ok', true);
end $$;

-- Who may call what: the browser gets only the API functions, never the helpers.
revoke execute on function public.folio__admin_err(text), public.folio__find(text),
  public.folio__key_err(public.folio_lists, text), public.folio_set_admin_key(text) from public, anon, authenticated;
revoke execute on function public.folio_ping(), public.folio_check_admin(text), public.folio_publish(text, text, text, text, text),
  public.folio_set_key(text, uuid, text), public.folio_set_visibility(text, uuid, text), public.folio_delete_list(text, uuid),
  public.folio_directory(), public.folio_open(text, text), public.folio_push(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text) from public;
grant execute on function public.folio_ping(), public.folio_check_admin(text), public.folio_publish(text, text, text, text, text),
  public.folio_set_key(text, uuid, text), public.folio_set_visibility(text, uuid, text), public.folio_delete_list(text, uuid),
  public.folio_directory(), public.folio_open(text, text), public.folio_push(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text) to anon, authenticated;

-- Last step, once, with your own key (then delete the line from the editor):
-- select public.folio_set_admin_key('choose-a-long-admin-key');
