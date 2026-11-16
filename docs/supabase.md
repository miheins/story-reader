# Folio and Supabase

## Built (16 Nov 2026): one account, private data

Lists, categories, articles (with reading progress) and notes sync to a Supabase project, private to the signed-in account.

**Set up, once**
1. Create a project at supabase.com.
2. SQL Editor → paste [`supabase/schema.sql`](../supabase/schema.sql) → Run. It creates four tables (`folio_lists`, `folio_categories`, `folio_articles`, `folio_notes`) and their row-level security.
3. Authentication → Users → **Add user** (email and password, *Auto Confirm User* on). Optional but sensible: Authentication → Sign In / Providers → turn off *Allow new users to sign up*.
4. In Folio: ☰ → **Supabase** → paste the Project URL and the **publishable** key (Project Settings → API Keys; the older *anon* key also works), then the email and password → **Connect**.
5. On other devices: the same step 4. To skip the URL and key there, fill in `SB_URL` and `SB_KEY` at the top of the Supabase section in `index.html`; the publishable key is meant to be public.

**How it works**
- No library: plain `fetch` to Supabase's Auth (`/auth/v1/token`) and REST (`/rest/v1/…`) APIs. Section `Supabase` in `index.html`.
- Local storage stays the working copy, so the app works offline. After each save, only the rows that changed since the last sync are upserted or deleted (`sbPush`, 1.5 s after the last change). On start, on returning to the tab and on **Sync now**, pending changes go up, then everything comes down (`sbPull`, `sbApply`).
- A device's first sync only *adds* what the account doesn't have; it never overwrites. After that, the last change wins per row.
- The starter example links don't sync until opened. Cached article text stays on each device and is re-fetched elsewhere.
- Once a project is connected, the GitHub store (`ONLINE`) switches itself off.
- Never put a **secret** / `service_role` key in the app; the form refuses one.

**Not built yet** (the plan below): sharing a list with other people, public list links, uuid ids, a separate progress table, soft delete. Today's tables use the app's own text ids and keep progress on the article row, which is right for one owner and can be migrated.

**Tested** against an in-memory stand-in for Supabase (`tests/supabase.test.js`), **not yet against a real project**. First real run: watch for the upsert (`on_conflict=owner_id,id`) and the first sign-in.

---

# Plan: sharing and roles (not built)

A plan, not yet built. The app is already shaped for it: every list and article change in the list admin goes through **`Repo`** (one named command, plain-JSON arguments), and every permission question goes through **`can(action, listId)`**. Moving to Supabase means re-implementing those two things; the UI stays as it is.

## What changes

| Today | With Supabase |
|---|---|
| Lists and articles in `localStorage`, optionally mirrored to `data/folio.json` on GitHub | Postgres tables, one row per list / article |
| Owner = whoever knows the passphrase that decrypts the GitHub token | Supabase Auth (email link or passkey); roles per list |
| `can()` returns "not read-only" | `can()` reads the signed-in user's role on the list; **row-level security** enforces it again on the server |
| Notes and reading progress stay on each device | Private per user, synced across devices |
| Everyone can read every list in the public repository | A list is private unless marked public |

## Tables

```sql
-- Lists. slug is the address (#list-<slug>, #admin-<slug>); old slugs keep working after a rename.
create table lists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null check (length(name) between 1 and 40),
  slug        text not null unique,
  old_slugs   text[] not null default '{}',
  is_public   boolean not null default false,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

-- Who may do what on a list. The owner gets a row too, so every check is one lookup.
create table list_members (
  list_id  uuid references lists on delete cascade,
  user_id  uuid references auth.users on delete cascade,
  role     text not null check (role in ('owner','editor','viewer')),
  primary key (list_id, user_id)
);

create table categories (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null default auth.uid() references auth.users on delete cascade,
  name      text not null,
  colour    smallint not null check (colour between 0 and 5)
);

-- One row per link in a list. The same URL may sit in several people's lists.
create table articles (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references lists on delete cascade,
  url         text not null,
  title       text,
  site        text,
  kind        text not null default 'story' check (kind in ('story','link')),  -- 'link' = "Just link"
  hero        text,                 -- og:image for links, the article's lead image for stories
  category_id uuid references categories on delete set null,
  position    int not null default 0,
  added_at    timestamptz not null default now(),
  deleted_at  timestamptz,              -- soft delete, so Undo works across devices
  unique (list_id, url)
);

-- Private to each reader.
create table progress (
  user_id    uuid default auth.uid() references auth.users on delete cascade,
  article_id uuid references articles on delete cascade,
  status     text not null check (status in ('new','reading','read')),
  pct        smallint not null default 0,
  pos        int not null default 0,
  primary key (user_id, article_id)
);

create table notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  article_id  uuid not null references articles on delete cascade,
  pos         int not null,
  where_label text,
  excerpt     text,
  body        text not null,
  created_at  timestamptz not null default now()
);
```

## Security (row-level security)

```sql
alter table lists enable row level security;
alter table list_members enable row level security;
alter table categories enable row level security;
alter table articles enable row level security;
alter table progress enable row level security;
alter table notes enable row level security;

-- helper: the caller's role on a list ('owner' | 'editor' | 'viewer' | null)
create function list_role(l uuid) returns text language sql stable security definer set search_path = public as $$
  select role from list_members where list_id = l and user_id = auth.uid()
$$;

-- lists
create policy "read public or member lists" on lists for select
  using (is_public or list_role(id) is not null);
create policy "create own lists" on lists for insert with check (owner_id = auth.uid());
create policy "owner or editor renames" on lists for update
  using (list_role(id) in ('owner','editor')) with check (list_role(id) in ('owner','editor'));
create policy "owner deletes" on lists for delete using (list_role(id) = 'owner');

-- articles: reading follows the list; changes need editor rights.
create policy "read articles of readable lists" on articles for select
  using (exists (select 1 from lists where lists.id = list_id and (is_public or list_role(lists.id) is not null)));
create policy "editors add" on articles for insert with check (list_role(list_id) in ('owner','editor'));
-- Moving an article is an UPDATE of list_id: USING checks the list it leaves,
-- WITH CHECK checks the list it joins, so you need editor rights on both.
create policy "editors change and move" on articles for update
  using (list_role(list_id) in ('owner','editor')) with check (list_role(list_id) in ('owner','editor'));

-- members: owners manage sharing; members can see who else is on the list.
create policy "members see members" on list_members for select using (list_role(list_id) is not null);
create policy "owner manages members" on list_members for all
  using (list_role(list_id) = 'owner') with check (list_role(list_id) = 'owner');

-- categories, progress and notes are private to their user.
create policy "own categories" on categories for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own progress" on progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notes" on notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

A trigger on `lists` insert should add the creator to `list_members` as `owner`. Deleting a list while moving its articles elsewhere belongs in one transaction, as an RPC (`delete_list(list uuid, move_to uuid)`), so a failure can't strand articles.

## Mapping `Repo` to Supabase

| `Repo` method (index.html) | Supabase call |
|---|---|
| `lists()` | `from('lists').select('id,name,slug,articles(count)').order('position')` |
| `list(id)` | `from('lists').select().eq('id', id).single()` |
| `items(id)` | `from('articles').select().eq('list_id', id).is('deleted_at', null).order('position')` |
| `notes(id)` | `from('notes').select('*, articles!inner(list_id)').eq('articles.list_id', id)` |
| `renameList(id, name)` | `from('lists').update({ name, slug, old_slugs }).eq('id', id)` |
| `moveItems(ids, to)` | `from('articles').update({ list_id: to }).in('id', ids)` |
| `removeItems(ids)` | `from('articles').update({ deleted_at: now }).in('id', ids)`; undo sets it back to `null` |
| `deleteList(id)` | `rpc('delete_list', { list: id, move_to })` |
| `can(action, listId)` | the cached `list_role` for that list; the policies above are the real gate |

Each method already returns `{ ok, error?, n?, undo? }`. With Supabase the methods become `async` and return the same shape, so the admin UI only needs `await` added.

## Migration steps

1. Create the project, run the SQL above, turn on email sign-in.
2. Add `supabase-js` (pinned version) and a sign-in sheet in place of the passphrase unlock.
3. Re-implement `Repo` and `can()` against Supabase; keep the method names and return shape.
4. Move the remaining direct edits (add links, reorder, categories, the reader's progress and notes) behind `Repo` methods too. Today only the list admin uses `Repo`; the rest still calls `edit()` directly.
5. One-off import: read `data/folio.json` and each device's `localStorage`, insert into the tables.
6. Remove the GitHub storage code and `data/owner.json`.

## Open questions for later

- **Public links:** keep `is_public` per list (anyone with the link can read), or require sign-in for everything?
- **Sharing:** invite editors by email, or owner-only for now?
- **Slug uniqueness:** global (as above) is simplest. If several people use Folio, addresses may need the owner in them (`#list-michael-weekend`).
