# Folio and Supabase: lists unlocked by a key

No accounts, no email, no password sign-in. A reading list is put online once by the admin and gets its own **pass phrase**. Anyone with the list's address and its key can open and edit it on any device.

## Set up, once

1. Create a project at supabase.com.
2. SQL Editor → paste [`supabase/schema.sql`](../supabase/schema.sql) → Run.
3. In the same editor, set your **admin key** (your own long phrase), then delete the line:
   `select public.folio_set_admin_key('choose-a-long-admin-key');`
4. *(Done: this project's URL and publishable key are built into `index.html` as `SB_URL` / `SB_KEY`, so this step is skipped.)* In Folio: ☰ → **Admin** → paste the Project URL and the **publishable** key (Project Settings → API Keys; the older *anon* key also works) → **Connect**.
   To skip this on other devices, fill in `SB_URL` and `SB_KEY` at the top of the Supabase section in `index.html`; the publishable key is meant to be public.

## Using it

- **Admin mode:** creating, renaming, deleting and managing lists, and putting them online, need the admin key. ☰ → Admin → *Admin key* → **Unlock admin**; Supabase checks it (`folio_check_admin`) and the device keeps it for 30 days, or until **Lock admin**. Everyone else can open and read lists they have a key or private link for, take notes and remember slides, but sees no *Add new item*, remove buttons, *Clear finished*, category editing or assigning, *New list*, *Manage*, delete or list switching (the L key does nothing and the Reading lists group is hidden). The database enforces it too: `folio_push` refuses a name or address change, and any added, changed or removed article, without the admin key. Notes and remembered slides need only the pass phrase. A non-admin's local article changes (order, category, a better title) stay on their device and are replaced at the next sync.

- **Put a list online:** the list's **Manage** page (L → *Manage …*) → *Online* → enter the admin key and choose a pass phrase → **Put online**.
- **Open it elsewhere:** open the list's address (`…/#list-weekend`) and Folio asks for the key; or ☰ → Admin → **Unlock a list…**, or L → *Unlock a list…*.
- **Intro:** Manage → Name → *Intro* (admin). Up to 600 characters, shown under Folio above the tabs for everyone who has the list; line breaks are kept. Stored in `folio_lists.intro`.
- **Private link:** Manage → Online → **Copy private link** (or L → *Copy private link*). It's the list's address with the key in it (`…#list-weekend&key=…`): opening it unlocks the list without typing, and Folio removes the key from the address bar straight away. Anyone holding the link can open and edit the list; to cut old links off, change the key. The link can also be pasted into *Unlock a list*.
- **Change a key / take offline:** Manage → Online → *Change the key or take offline* (admin key needed). Devices with the old key are locked until given the new one; they keep their copy.
- You can also change a key in Supabase alone: `select public.folio_set_key('admin key', '<list id>', 'new pass phrase');`

## What syncs

**Names:** a note can carry the writer's name (optional, `folio_notes.author`). **When:** a note, remembered slide or (for the admin) any list change is sent about 1.5 seconds after it's made, automatically. Other devices pick changes up when Folio starts, when you come back to it after 30 seconds away, when the device comes back online, or with **Sync now**. There's no live push between devices.

Per online list: its name and address, its articles (order, category, Just-link title and image) and the notes and remembered slides on them. **Reading progress stays on each device**, and so does cached article text. Lists that aren't online stay on the device.

Local storage is the working copy, so the app works offline. After each save, only what changed since the last sync is sent (1.5 s later). On start, on returning to the tab and on **Sync now**, changes go up, then the list comes down. If two devices change the same article or note, the last change wins.

## How it is protected

- The four tables (`folio_admin`, `folio_lists`, `folio_articles`, `folio_notes`) have row-level security on with **no policies**, and the public API roles have no rights on them. A browser cannot read or write them directly.
- All access goes through database functions that check a key first: `folio_open` and `folio_push` need the pass phrase; `folio_publish`, `folio_set_key` and `folio_delete_list` need the admin key. `folio_set_admin_key` can only be run from the SQL editor.
- Keys are stored as bcrypt hashes. On each device, a list's key is kept in local storage (`folio.sb.keys`).
- **Limits to know:** after 10 wrong guesses in 15 minutes a list (or the admin key) is locked for the rest of those 15 minutes. Someone could use this to lock a list on purpose for a while; they still can't get in. Anyone holding a pass phrase can edit and delete in that list, not just read. A wrong key and an unknown address give different messages, so list addresses can be guessed at (their contents can't).

## Code

Section `Supabase` in `index.html`: `sbRpc` (plain `fetch` to `/rest/v1/rpc/…`, no library), `sbListRows` / `sbPushList` / `sbApplyList`, `sbSync`, `sbUnlock`, `sbPublish`, `sbSetKey`, `sbTakeOffline`, the menu section, the unlock sheet and the admin page's *Online* section. Storage keys: `folio.sb` (URL, key), `folio.sb.keys`, `folio.sb.snap`. Online lists carry `rid` (the list's id in Supabase). Once a project is connected, the GitHub store (`ONLINE`) switches itself off.

## Tested

- `supabase/schema.sql` ran twice on a local Postgres 16 and passed checks as the public role: tables closed, helpers and the admin setter closed, wrong / missing / short keys refused, publish, push, open by old address, delete, key change, take offline.
- `tests/supabase.test.js`: the app against a stand-in for those functions, two devices.
- **Not yet run against a real Supabase project.** Watch the first *Connect* and *Put online*.

## Later

Read-only keys (a second key per list that can open but not edit), a guess limit, shared reading progress, and moving the remaining direct edits behind `Repo`.


## Sharing: public, unlisted, private

Each online list has a visibility, set on its **Manage** page → *Online* → *Who can read it*:

| Visibility | Who can read | Listed on the start page |
|---|---|---|
| **Public** | anyone | yes |
| **Unlisted** | anyone with the address `#list-<name>` | no |
| **Private** | only with the pass phrase | no |

- **Notes always need the pass phrase.** Someone reading a public or unlisted list who taps the note button is asked for it once; then it stays on their device.
- **Articles and list settings** still need the admin key.
- **Start page** (`#start`): open a list by name and pass phrase, or tap a public list. New visitors land here; everyone else reaches it from ☰ → *Other lists*, or the list switcher → *Open another list…*.
- **A link to a private list** asks only for the pass phrase and doesn't show the list's name. A wrong name and a wrong pass phrase give the same answer ("Name or pass phrase didn't match"), so private lists can't be found by guessing names.
- New pass phrases need at least 10 characters. Existing ones keep working.
- Functions return `{"error": "FOLIO_..."}` instead of raising, so the count of wrong guesses is saved (an error would roll it back). The app reads both.
