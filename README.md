# Article Folio

Turns a blog post or article into a swipeable story for your phone: one paragraph per slide, with typography you can adjust.

**Live:** https://miheins.github.io/story-reader/

Picking this up? Read [HANDOVER.md](HANDOVER.md) for how it's built, where things are, and what's open.

## Using it

- Paste one or more links on the queue screen and tap **Read next**. Drag the dotted handle to reorder the queue; the top unread article plays next.
- **Stack or list:** the overview opens as a stack of cards (swipe or use ← → to flip, tap a card to read). Switch to the list with the toggle above the queue; reordering, moving, categorising and removing are done in the list.
- Tap the right side to go forward and the left side to go back, or swipe. Hold to pause. Swipe down to close.
- **Aa** sets the typeface (Newsreader or Hanken Grotesk), size, line spacing, theme, and optional auto-advance.
- When an article ends, the next one in the queue is offered on the last slide.
- **Notes:** while reading, tap the pencil to note something on the current slide. The **Notes** tab collects every note with the passage it belongs to; tap a passage to jump back. **Copy all as text** exports them.
- **Reading lists:** keep separate queues (e.g. Work, Weekend). Each list has its own address (`#list-weekend`), so you can bookmark it or add it to your home screen. Switch from the menu (☰ → Reading lists → Open, or Copy link), or on desktop press **L** for the list switcher. Move an article with **Move to…** on its row. New links go into the list you have open, and **Read next** stays inside it.
- **Categories:** create them in the menu (☰), set one per article from the dropdown on its row, and tap a category above the queue to highlight its articles. **Read next** then stays within that category.
- **Links:** every article has its own address (`#read-<id>`), so Back returns to the list you came from and reloading keeps you in the article.
- **Home screen:** open the menu (☰) for install instructions. On iPhone: Safari → Share → Add to Home Screen.

## Lists online

Your lists can live in this repository (`data/folio.json`), so every device sees the same lists and each list's address keeps working anywhere. Anyone with a link can read; only the owner can add or edit.

- **Set up once:** menu (☰) → *Your lists online* → **Set up**. Create a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new) limited to this repository with **Contents: Read and write**, paste it, and choose a passphrase (**Suggest** gives five random words). Your current lists are published.
- **Other devices:** menu → type the passphrase → **Unlock**. Anything that device had saved locally is added to the online lists. A device stays unlocked for 30 days (or the session, if you untick *Remember*).
- **How it's protected:** the token is stored in `data/owner.json` encrypted with your passphrase (PBKDF2-SHA256, 600,000 rounds, AES-256-GCM) and is decrypted only in your browser. Deleting the token on GitHub disables it everywhere.
- Reading progress, notes and settings stay on each device.
- Switches at the top of the online code in `index.html`: `ONLINE` turns the whole feature on or off; `SHOW_LOCK` shows a **Lock** button in the menu (hidden for now).

## How links load

Articles are fetched through [Jina Reader](https://jina.ai/reader) (`r.jina.ai`), asking for the rendered HTML. Article Folio reads only what sits inside the page's `<article>` (or its main body container), then drops captions, credits, galleries, repeated pull quotes and labels. If the HTML request fails it falls back to Jina's markdown. If a page can't be loaded, Article Folio asks you to paste either the article text or the page's source code instead.

Your queue, reading positions, notes, categories and settings are kept in your browser's local storage on that device only.

## Files

- `index.html`: the whole app in one file, with no build step.
- `manifest.webmanifest`, `icons/`: home-screen name and icons, generated from `icons/monogram-source.jpg`.
- `tests/`: simulated-browser checks (`cd tests && npm install && npm test`).
- `HANDOVER.md`: how it's built, data, decisions and open items.
