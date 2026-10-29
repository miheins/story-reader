# The Reading Folio

Turns a blog post or article into a swipeable story for your phone: one paragraph per slide, with typography you can adjust.

**Live:** https://miheins.github.io/story-reader/

## Using it

- Paste one or more links on the queue screen and tap **Read next**. Drag the dotted handle to reorder the queue; the top unread article plays next.
- Tap the right side to go forward and the left side to go back, or swipe. Hold to pause. Swipe down to close.
- **Aa** sets the typeface (Newsreader or Hanken Grotesk), size, line spacing, theme, and optional auto-advance.
- When an article ends, the next one in the queue is offered on the last slide.
- **Notes:** while reading, tap the pencil to note something on the current slide. The **Notes** tab collects every note with the passage it belongs to; tap a passage to jump back. **Copy all as text** exports them.
- **Categories:** create them in the menu (☰), set one per article from the dropdown on its row, and tap a category above the queue to highlight its articles. **Read next** then stays within that category.

## How links load

Articles are fetched through [Jina Reader](https://jina.ai/reader) (`r.jina.ai`), asking for the rendered HTML. Folio reads only what sits inside the page's `<article>` (or its main body container), then drops captions, credits, galleries, repeated pull quotes and labels. If the HTML request fails it falls back to Jina's markdown. If a page can't be loaded, Folio asks you to paste either the article text or the page's source code instead.

Your queue, reading positions, notes, categories and settings are kept in your browser's local storage on that device only.

## Files

- `index.html`: the whole app in one file, with no build step.
