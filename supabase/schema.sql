-- Folio on Supabase: reading lists unlocked by a key. No user accounts.
--
-- Run once: Supabase dashboard → SQL Editor → paste all of this → Run. Safe to run again.
-- Then set your admin key (the one line at the very bottom, with your own key).
--
-- How it is protected
--   * The four tables are closed: row-level security is on with no policies, and the public
--     API roles have no rights on them. Nobody can read or write them directly from a browser.
--   * Everything goes through the functions below. Each one checks a key first:
--       the LIST KEY  opens one list, to read and edit it (folio_open, folio_push);
--       the ADMIN KEY puts a list online, changes its key or takes it offline.
--   * Keys are stored only as bcrypt hashes. Use long keys: there is no lock-out after wrong guesses.

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
alter table public.folio_lists    enable row level security;
alter table public.folio_articles enable row level security;
alter table public.folio_notes    enable row level security;
revoke all on public.folio_admin, public.folio_lists, public.folio_articles, public.folio_notes from anon, authenticated;

-- ---------- helpers (not callable from the API) ----------

create or replace function public.folio__admin(p_admin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select key_hash into h from folio_admin;
  if h is null then raise exception 'FOLIO_NOADMIN'; end if;
  if h is distinct from crypt(coalesce(p_admin, ''), h) then raise exception 'FOLIO_ADMIN'; end if;
end $$;

create or replace function public.folio__list(p_ref text, p_key text) returns public.folio_lists
language plpgsql security definer set search_path = public, extensions as $$
declare l public.folio_lists;
begin
  select * into l from folio_lists where id::text = p_ref or slug = p_ref or alt ? p_ref order by (id::text = p_ref) desc, (slug = p_ref) desc limit 1;
  if not found then raise exception 'FOLIO_NOLIST'; end if;
  if l.key_hash is distinct from crypt(coalesce(p_key, ''), l.key_hash) then raise exception 'FOLIO_KEY'; end if;
  return l;
end $$;

-- Run from the SQL editor only: select public.folio_set_admin_key('your long admin key');
create or replace function public.folio_set_admin_key(p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if char_length(coalesce(p_key, '')) < 8 then raise exception 'FOLIO_SHORT'; end if;
  insert into folio_admin (one, key_hash) values (true, crypt(p_key, gen_salt('bf', 10)))
  on conflict (one) do update set key_hash = excluded.key_hash;
end $$;

-- ---------- the API ----------

create or replace function public.folio_ping() returns boolean language sql stable as $$ select true $$;

-- Admin: check the admin key (the app's "Unlock admin").
create or replace function public.folio_check_admin(p_admin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform folio__admin(p_admin);
  return true;
end $$;

-- Admin: put a list online under a list key. Returns the list's id.
create or replace function public.folio_publish(p_admin text, p_slug text, p_name text, p_key text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid;
begin
  perform folio__admin(p_admin);
  if char_length(coalesce(p_key, '')) < 8 then raise exception 'FOLIO_SHORT'; end if;
  begin
    insert into folio_lists (slug, name, key_hash)
    values (lower(trim(p_slug)), left(coalesce(nullif(trim(p_name), ''), p_slug), 80), crypt(p_key, gen_salt('bf', 10)))
    returning id into v;
  exception when unique_violation then raise exception 'FOLIO_SLUG';
  end;
  return v;
end $$;

-- Admin: change a list's key. Devices holding the old key are locked out until given the new one.
create or replace function public.folio_set_key(p_admin text, p_list uuid, p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform folio__admin(p_admin);
  if char_length(coalesce(p_key, '')) < 8 then raise exception 'FOLIO_SHORT'; end if;
  update folio_lists set key_hash = crypt(p_key, gen_salt('bf', 10)), updated_at = now() where id = p_list;
  if not found then raise exception 'FOLIO_NOLIST'; end if;
end $$;

-- Admin: take a list offline (deletes its online copy; devices keep theirs).
create or replace function public.folio_delete_list(p_admin text, p_list uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform folio__admin(p_admin);
  delete from folio_lists where id = p_list;
end $$;

-- List key: read a whole list, by id, address or an earlier address.
create or replace function public.folio_open(p_ref text, p_key text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l public.folio_lists;
begin
  l := folio__list(p_ref, p_key);
  return jsonb_build_object(
    'list', jsonb_build_object('id', l.id, 'name', l.name, 'slug', l.slug, 'alt', l.alt),
    'articles', coalesce((select jsonb_agg(to_jsonb(a) - 'list_id' order by a.position, a.id) from folio_articles a where a.list_id = l.id), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(to_jsonb(n) - 'list_id' order by n.noted_at, n.id) from folio_notes n where n.list_id = l.id), '[]'::jsonb));
end $$;

-- List key: save changes to a list: rows to add or update and ids to delete.
-- Renaming the list (p_meta) also needs the admin key.
drop function if exists public.folio_push(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb);
create or replace function public.folio_push(p_list uuid, p_key text, p_meta jsonb, p_articles jsonb, p_del_articles jsonb, p_notes jsonb, p_del_notes jsonb, p_admin text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare l public.folio_lists;
begin
  l := folio__list(p_list::text, p_key);
  if p_meta is not null then
    perform folio__admin(p_admin);
    begin
      update folio_lists set
        name = left(coalesce(nullif(trim(p_meta->>'name'), ''), name), 80),
        slug = coalesce(nullif(lower(trim(p_meta->>'slug')), ''), slug),
        alt  = case when jsonb_typeof(p_meta->'alt') = 'array' then p_meta->'alt' else alt end,
        updated_at = now()
      where id = l.id;
    exception when unique_violation then raise exception 'FOLIO_SLUG';
    end;
  end if;

  delete from folio_articles where list_id = l.id and id in (select jsonb_array_elements_text(coalesce(p_del_articles, '[]'::jsonb)));
  insert into folio_articles (list_id, id, url, title, site, kind, img, added, position, cat_name, cat_c)
  select l.id, r.id, r.url, coalesce(r.title, ''), coalesce(r.site, ''), coalesce(r.kind, 'story'), r.img, r.added, coalesce(r.position, 0), r.cat_name, r.cat_c
  from jsonb_to_recordset(coalesce(p_articles, '[]'::jsonb)) as r (id text, url text, title text, site text, kind text, img text, added date, position integer, cat_name text, cat_c smallint)
  where r.id is not null and r.url is not null
  on conflict (list_id, id) do update set url = excluded.url, title = excluded.title, site = excluded.site, kind = excluded.kind, img = excluded.img,
    added = excluded.added, position = excluded.position, cat_name = excluded.cat_name, cat_c = excluded.cat_c;

  delete from folio_notes where list_id = l.id and id in (select jsonb_array_elements_text(coalesce(p_del_notes, '[]'::jsonb)));
  insert into folio_notes (list_id, id, article_id, pos, where_label, excerpt, body, liked, noted_at, title, site, url)
  select l.id, r.id, r.article_id, coalesce(r.pos, 0), coalesce(r.where_label, ''), coalesce(r.excerpt, ''), coalesce(r.body, ''), coalesce(r.liked, false), coalesce(r.noted_at, 0),
    coalesce(r.title, ''), coalesce(r.site, ''), coalesce(r.url, '')
  from jsonb_to_recordset(coalesce(p_notes, '[]'::jsonb)) as r (id text, article_id text, pos integer, where_label text, excerpt text, body text, liked boolean, noted_at bigint, title text, site text, url text)
  where r.id is not null and r.article_id is not null
  on conflict (list_id, id) do update set article_id = excluded.article_id, pos = excluded.pos, where_label = excluded.where_label, excerpt = excluded.excerpt,
    body = excluded.body, liked = excluded.liked, noted_at = excluded.noted_at, title = excluded.title, site = excluded.site, url = excluded.url;

  update folio_lists set updated_at = now() where id = l.id;
end $$;

-- Who may call what: the browser gets only the key-checked functions.
revoke execute on function public.folio__admin(text), public.folio__list(text, text), public.folio_set_admin_key(text) from public, anon, authenticated;
revoke execute on function public.folio_ping(), public.folio_publish(text, text, text, text), public.folio_set_key(text, uuid, text),
  public.folio_delete_list(text, uuid), public.folio_open(text, text), public.folio_push(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text), public.folio_check_admin(text) from public;
grant execute on function public.folio_ping(), public.folio_publish(text, text, text, text), public.folio_set_key(text, uuid, text),
  public.folio_delete_list(text, uuid), public.folio_open(text, text), public.folio_push(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text), public.folio_check_admin(text) to anon, authenticated;

-- Last step, once, with your own key (then delete the line from the editor):
-- select public.folio_set_admin_key('choose-a-long-admin-key');
