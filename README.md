# Folio

Turns a blog post or article into a swipeable story for your phone: one paragraph per slide, with typography you can adjust.

**Live:** https://miheins.github.io/story-reader/

## Using it

- Paste one or more links on the queue screen and tap **Read next**.
- Tap the right side to go forward and the left side to go back, or swipe. Hold to pause. Swipe down to close.
- **Aa** sets the typeface (Newsreader or Hanken Grotesk), size, line spacing, theme, and optional auto-advance.
- When an article ends, the next one in the queue is offered on the last slide.

## How links load

Articles are fetched through [Jina Reader](https://jina.ai/reader) (`r.jina.ai`), which returns a page's main content as text. If a page can't be loaded, Folio asks you to paste either the article text or the page's source code instead.

Your queue, reading positions and settings are kept in your browser's local storage on that device only.

## Files

- `index.html`: the whole app in one file, with no build step.
