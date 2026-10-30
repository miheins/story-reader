# Article Folio: handover

Everything you need to pick this project up again. The user guide is in [README.md](README.md); this file covers how it's built, where things are, and what's still open.

*Last updated 30 Oct 2026.*

## At a glance

| | |
|---|---|
| **What it is** | A reader that turns article links into Instagram-style stories: one paragraph per slide, typography first. Queue, reading lists, categories, notes, card stack. |
| **Live site** | https://miheins.github.io/story-reader/ (GitHub Pages, deploys from `main` in about a minute) |
| **Repository** | https://github.com/miheins/story-reader (public) |
| **Design file** | Paper: [Article Folio](https://app.paper.design/file/01M6429AMHNHA15K5JK8ZC36AA). Page *Screens* holds mobile and desktop views; page *Design system* holds every token. |
| **Claude artifact** | A private copy on claude.ai, used early on for quick previews. It can't load links or reach GitHub; the GitHub site is the real app. |
| **Stack** | One HTML file, no build step, no framework. Google Fonts (Newsreader, Hanken Grotesk). Jina Reader for fetching articles. |

## Where things stand

**Working**
- Paste links; each plays as a story with one paragraph per slide. Text size steps up for short paragraphs (1×–1.85×), and long paragraphs split between sentences.
- Overview as a **card stack** (default) or a **list**, with a toggle.
- **Reading lists**, each with its own address (`#list-<slug>`). The switcher is hidden; on desktop **L** shows it.
- **Categories** with six colours, a filter to highlight one, and **Read next** that respects it.
- **Notes** per slide, collected in the Notes tab with the passage each refers to. Copy all as text.
- Article addresses (`#read-<id>`), so Back, Forward and reload all behave.
- Installable on the home screen with the AF monogram icon.
- Article extraction from the page's `<article>` via Jina Reader's HTML, with markdown and paste-in fallbacks (text or page source).
- **Lists online**: lists stored in this repository, editable only after unlocking with a passphrase. Built and switched on, but **not yet set up or tried against real GitHub**.

**Switched off or hidden (kept in the code)**
- `SHOW_LOCK=false`: the **Lock** button in the online section.
- `ONLINE`: currently `true`. Setting it to `false` turns the whole online feature off and goes back to device-only.

## How the code is laid out

Everything is in `index.html`. Search for these section markers:

| Marker | What's there |
|---|---|
| `Library` / `Reader (story)` / `Sheets` (CSS) | Styles. Colour tokens are at the top of `<style>`, with light and dark sets. Desktop framing is the `@media (min-width:720px)` block. |
| `Settings` | Typeface, size steps, line spacing, theme, auto-advance. |
| `Queue` | Queue model, list view rendering, drag-to-reorder, adding links, clear finished. |
| `Categories` | Category model, filter chips, row dropdown, menu editing, home-screen install. |
| `Card stack view` | Stack rendering, swipe and keys, the `VIEW` toggle. |
| `Reading lists UI` | List switcher, *Move to…*, menu list management, copy list link. |
| `Lists online` | GitHub storage, encryption, owner set-up and unlock, read-only mode. Flags `ONLINE` and `SHOW_LOCK` are near the top. |
| `Notes` | Notes model, Notes tab, note sheet. |
| `Parsing` | Jina fetch, HTML and markdown to blocks, `clean()` (keeps only the main reading text). |
| `Story building` | Fits each paragraph to the largest size step that fits the slide. |
| `Reader` | Slides, progress bars, timer, gestures (tap, swipe, hold, swipe down). |
| `Routes` | Addresses: `#list-<slug>`, `#read-<id>`, `#notes`. Back-button handling. |

**Every change to queue, list or category data goes through `edit(message, fn)`.** It applies `fn` here at once and, when unlocked online, queues the same `fn` to run against the latest file on GitHub. New features that change those lists must use `edit()` too, or their changes won't sync.

## Where data lives

**On each device (`localStorage`)**

| Key | Contents |
|---|---|
| `folio.queue` | Articles: id, url, title, site, list, category, plus this device's status, position and progress |
| `folio.lists`, `folio.alist` | Reading lists (id, name, slug, old slugs) and the open one |
| `folio.cats`, `folio.filter` | Categories and the selected filter |
| `folio.notes` | Notes (article, position, quoted passage, text, time) |
| `folio.c.<id>` | Cached, cleaned article text |
| `folio.settings`, `folio.view`, `folio.tab` | Reading settings, stack or list, current tab |
| `folio.canFetch` | Whether this copy can reach the reader service (paste mode otherwise) |
| `folio.remote` | Last copy of the online lists, for instant start-up |
| `folio.owner` | The decrypted GitHub token while unlocked (30 days or the session) |
| `folio.stash`, `folio.stashDone` | This device's own articles, kept aside until first unlock so they can be merged |

**In the repository (only once Lists online is set up)**
- `data/folio.json`: `{ v, updated, lists[], categories[], articles[] }`. Articles hold `id, url, title, site, list, cat?, added`. No progress or notes.
- `data/owner.json`: the GitHub token encrypted with the passphrase (PBKDF2-SHA256, 600,000 rounds, AES-256-GCM, random salt and IV). Safe to be public, provided the passphrase is strong.

Article ids are a hash of the URL, so the same link has the same id on every device.

## Working on it

- **Edit `index.html` directly**, then push to `main`. Pages redeploys in about a minute.
- **When the online lists are in use, the app commits `data/folio.json` itself.** Pull before pushing (`git pull --rebase`) to avoid conflicts.
- **Tests** (simulated browser, about 30 seconds): `cd tests && npm install && npm test`.
  - `routes`: article addresses, Back, Forward, close, opening an article link directly.
  - `stack`: stack default, flipping, toggle, opening.
  - `lists`: list addresses, the L key, opening a list link directly, unknown lists.
  - `online`: a stand-in for GitHub across four devices: set-up, publish, visitor read-only, unlock and merge, wrong passphrase, simultaneous adds, opening a list link on a fresh device.
- **Design round trip:** edit in Paper, preferably by changing tokens, then ask Claude to "pull the Paper changes". It reads exact values from the file, not screenshots.

## Open items

1. **First real set-up of Lists online.** Only tested against a stand-in for GitHub. Watch for: the token check, the first publish, and unlocking on a second device. If something fails, note the exact error text.
2. **Article extraction for itsnicethat.** Reworked to read `<article>` from Jina's HTML. Not yet confirmed on the live page. It also depends on Jina accepting the `X-Return-Format` header from a browser; if not, it silently falls back to markdown.
3. **Swipe feel on a real phone** (stack and reader). Thresholds: 25% of the width, or a fast flick.
4. **Mobile list switching.** With the switcher hidden, phones switch via ☰ → Reading lists, or by bookmarked list addresses. A tappable list name may be needed.
5. **Repository rename** to `article-folio`. Changes the site address to `…/article-folio/`. Saved data survives, because it's tied to `miheins.github.io`, not the path. Update the README link at the same time. Can only be done in GitHub Settings.
6. **Large icon (512px)** is upscaled from a 420px source and slightly soft. A larger or SVG monogram would fix it.
7. **Rate limits.** Visitors who aren't signed in get 60 GitHub requests an hour from each connection; beyond that the app shows the published copy, about a minute behind.
8. **Notes and progress are per device.** Syncing them would need private storage, not the public repository.
9. **Dark theme** isn't in the Paper design system yet (Paper tokens hold one value each).

## Decisions so far, and why

- **Single file, no build:** easy to host, easy to hand to Claude, nothing to install.
- **One paragraph per slide, with a fixed size scale:** feels like a story, and the steady scale keeps the rhythm.
- **GitHub as the database:** you already have it, no new service, every change is versioned. The cost is that lists are public.
- **Passphrase rather than an account:** no sign-up. The token is encrypted in the repository; lose the passphrase and you set up again with a new token.
- **Repository name kept as `story-reader` for now,** even though the app is called Article Folio.

## Resuming with Claude

Start a conversation, attach or link this repository, and say: *"Read HANDOVER.md in miheins/story-reader and continue with Article Folio."* For design work, also share the Paper link above.
