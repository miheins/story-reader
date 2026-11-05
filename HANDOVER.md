# Article Folio: handover

Everything you need to pick this project up again. The user guide is in [README.md](README.md); this file covers how it's built, where things are, and what's still open.

*Last updated 5 Nov 2026.*

## At a glance

| | |
|---|---|
| **What it is** | A reader that turns article links into Instagram-style stories: one paragraph per slide, typography first. Queue, reading lists, categories, notes, card stack. |
| **Live site** | https://miheins.github.io/story-reader/ (GitHub Pages, deploys from `main` in about a minute) |
| **Repository** | https://github.com/miheins/story-reader (public) |
| **Design file** | Paper: [Article Folio](https://app.paper.design/file/01M6429AMHNHA15K5JK8ZC36AA). Page *Screens* holds mobile and desktop views; page *Design system* holds every token. |
| **Claude artifact** | Retired. An early preview copy on claude.ai; it isn't updated any more, because it can't load the design system's files or the licensed fonts. |
| **Stack** | One HTML file, no build step, no framework. Product Starter design system (`styles/product-starter/`). Newsreader from Google Fonts for reading. Jina Reader for fetching articles. |

## Where things stand

**Working**
- Paste links; each plays as a story with one paragraph per slide. Text size steps up for short paragraphs (1×–1.85×), and long paragraphs split between sentences.
- Overview as a **card stack** (default) or a **list**, with a toggle. On desktop (720px and wider) the stack becomes a **horizontal slider** of wider cards.
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
| `Library` / `Reader (story)` / `Sheets` (CSS) | Folio's styles on top of Product Starter. Folio's token aliases and accent are at the top of `<style>`; component placement is under *Product Starter components in Folio's layout*. The desktop layout (the same narrow column, centred, no frame) is the `@media (min-width:720px)` block. |
| `Settings` | Typeface, size steps, line spacing, theme, auto-advance. |
| `Queue` | Queue model, list view rendering, drag-to-reorder, adding links, clear finished. |
| `Categories` | Category model, filter chips, row dropdown, menu editing, home-screen install. |
| `Card stack view` | Stack rendering, swipe and keys, the `VIEW` toggle. On desktop, `renderSlider()` replaces the stack (see *Desktop slider*). |
| `Reading lists UI` | List switcher, *Move to…*, menu list management, copy list link. |
| `Lists online` | GitHub storage, encryption, owner set-up and unlock, read-only mode. Flags `ONLINE` and `SHOW_LOCK` are near the top. |
| `Notes` | Notes model, Notes tab, note sheet. |
| `Parsing` | Jina fetch, HTML and markdown to blocks, `clean()` (keeps only the main reading text). |
| `Story building` | Fits each paragraph to the largest size step that fits the slide. |
| `Reader` | Slides, progress bars, timer, gestures (tap, swipe, hold, swipe down). |
| `Routes` | Addresses: `#list-<slug>`, `#read-<id>`, `#notes`. Back-button handling. |

**Every change to queue, list or category data goes through `edit(message, fn)`.** It applies `fn` here at once and, when unlocked online, queues the same `fn` to run against the latest file on GitHub. New features that change those lists must use `edit()` too, or their changes won't sync.

## Design system

The interface uses **Product Starter** from the private starter kit (`miheins/starter-kit`, `design-systems/product-starter`, copied at commit `8a9b920`).

- **Files:** `styles/product-starter/tokens.css`, `bundle.css` and `fonts/`, loaded in the `<head>` before Folio's own styles. Don't edit them here; re-copy them from the kit when it changes.
- **Fonts:** the kit's own fonts (Labil Grotesk, GT Alpina Typewriter) are web-licensed to More Yum and are **not** included, so the repository can stay public. Folio overrides `--font-sans` with **Inter** (Google Fonts) and `--font-mono` with **Compagnon** (bundled, SIL Open Font License), the kit's named fallbacks. To use the licensed fonts, the repository must be private first; then copy them into `fonts/` and remove the two overrides.
- **Theme:** the kit switches on `data-theme="light|dark"` on `<html>`. Folio's *Auto* setting follows the system and sets that attribute; a small script in the `<head>` sets it before first paint.
- **Folio's layer** (top of the `<style>` block): Folio's older token names (`--fg`, `--muted`, `--rule`, `--chip`, `--sheet`, `--ink`) are aliases of the kit's semantic tokens. The only colours of Folio's own are:
  - `--accent` `#EA0000` (fills, covers, cards) with `--on-accent` white (4.7:1);
  - `--accent-text` for small red text: `#C80000` light (5.7:1), `#FF5C5C` dark (6.2:1), because `#EA0000` itself is just under 4.5:1 as small text;
  - category colours `--c1`…`--c6` (`--c2` is graphite; rust was too close to the accent).
- **Type:** Inter for the interface and the wordmark, Compagnon for labels (`.st-field__label`, `.kick`, badges). The story slides keep **Newsreader**; the reader's sans option is Inter. The kit's weight scale (400, 500, 600) is kept, with text at 14px or smaller at 500. Inter's 400 is Regular, slightly heavier than Labil's Light, so the interface reads a little bolder than the kit's showcase.
- **Components** are built as plain HTML with the kit's `st-` classes (no React): Button, IconButton, TextField, Textarea, Select, Checkbox, Switch, SegmentedControl, Tabs, Toast, StatusMessage, StatusBadge, EmptyState, Spinner, Card, and Dialog styling for the sheets. Icons use the kit's paths (24px grid, 1.75 stroke) through `ic(name)`; a few extra icons (menu, list, stack, external) follow the same rules.
- **Folio's own** (no kit equivalent): story slides and reader controls, the card stack, coloured category chips and row dropdowns, drag handles, the size stepper, the paste box.
- The slide container class is `.slide-body`, not `.body`, because the kit's `tokens.css` defines a global `.body` text style.

## Desktop slider

- At 720px and wider, the card stack is shown as a horizontal row of cards (`.slider`), from the kit's Carousel slot: **Blossom Carousel** `@blossom-carousel/core@1.1.9`, loaded from jsDelivr only on mouse or trackpad devices (`hover: hover` and `pointer: fine`). It adds mouse dragging with momentum and snapping. Version is in `BLOSSOM_V`.
- Without Blossom (touch-screen laptops, or if jsDelivr fails) the row still works with native sideways scrolling and snapping; nothing breaks.
- The row breaks out of the narrow column to the window edges; the first card lines up with the column. Cards are `clamp(440px, 36vw, 560px)` wide.
- Controls: ← → buttons and arrow keys scroll one card; click or Enter opens a card. A drag of more than 6px doesn't open.
- Phones keep the swipeable stack. The tests stub `matchMedia`, so they cover the stack only; the slider was checked in a browser at 1440px (light and dark: drag, buttons, click to open).
- **Licence note:** npm lists Blossom as MIT, but the package's `LICENSE` file is Apache 2.0. Both permit this use; the kit's entry (`entries/0001-blossom-carousel.md`) says MIT and should be corrected.
- Blossom's own agent skill (`npx skills add https://blossom-carousel.com`) installs on a local machine only and wasn't installed.

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
10. **Paper: three sheets unfinished.** *Menu: unlocked* has only its header so far. *Menu: setup* and *Reader: note sheet* aren't started. Work stopped at Paper's weekly connection limit on 30 Oct; ask Claude to finish them.
11. **Slider on a real desktop.** Check the drag feel on a trackpad and mouse, and that jsDelivr loads (the build was tested with a local copy of Blossom 1.1.9).

## Decisions so far, and why

- **Single file, no build:** easy to host, easy to hand to Claude, nothing to install.
- **One paragraph per slide, with a fixed size scale:** feels like a story, and the steady scale keeps the rhythm.
- **GitHub as the database:** you already have it, no new service, every change is versioned. The cost is that lists are public.
- **Passphrase rather than an account:** no sign-up. The token is encrypted in the repository; lose the passphrase and you set up again with a new token.
- **Repository name kept as `story-reader` for now,** even though the app is called Article Folio.

## Resuming with Claude

Start a conversation, attach or link this repository, and say: *"Read HANDOVER.md in miheins/story-reader and continue with Article Folio."* For design work, also share the Paper link above.
