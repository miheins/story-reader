-- Folio: tables and security for Supabase.
-- Run this once in your project: Supabase dashboard → SQL Editor → paste → Run. Safe to run again.
--
-- Every row belongs to one account (owner_id). Row-level security lets a signed-in
-- user see and change only their own rows; nobody else, signed in or not, can read them.
-- Ids are the app's own text ids (an article's id is a hash of its URL), unique per account.

create table if not exists public.folio_lists (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id       text not null,
  name     text not null check (char_length(name) between 1 and 80),
  slug     text not null default '',          -- the address: #list-<slug>, #admin-<slug>
  alt      jsonb not null default '[]',       -- earlier slugs, so old addresses keep working
  position integer not null default 0,
  primary key (owner_id, id)
);

create table if not exists public.folio_categories (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id       text not null,
  name     text not null,
  c        smallint not null default 0,       -- colour index, 0 to 5
  position integer not null default 0,
  primary key (owner_id, id)
);

create table if not exists public.folio_articles (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id       text not null,
  url      text not null,
  title    text not null default '',
  site     text not null default '',
  list_id  text not null,
  cat_id   text,
  kind     text not null default 'story' check (kind in ('story', 'link')),   -- 'link' = "Just link"
  img      text,                              -- share image of a "Just link" item
  added    date,
  position integer not null default 0,
  status   text not null default 'new' check (status in ('new', 'reading', 'read')),
  pos      integer not null default -1,       -- slide the reader stopped on
  pct      smallint not null default 0,       -- percent read
  primary key (owner_id, id)
);
create index if not exists folio_articles_list on public.folio_articles (owner_id, list_id);

create table if not exists public.folio_notes (
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id          text not null,
  article_id  text not null,
  pos         integer not null default 0,
  where_label text not null default '',
  excerpt     text not null default '',
  body        text not null default '',
  noted_at    bigint not null default 0,      -- milliseconds since 1970, as the app records it
  title       text not null default '',
  site        text not null default '',
  url         text not null default '',
  primary key (owner_id, id)
);
create index if not exists folio_notes_article on public.folio_notes (owner_id, article_id);

-- Security: only the owner, and only when signed in.
do $$
declare t text;
begin
  foreach t in array array['folio_lists', 'folio_categories', 'folio_articles', 'folio_notes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
