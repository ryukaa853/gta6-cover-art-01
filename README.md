# Vice Coast Cover Studio

A GTA 6-style cover art maker that runs **offline in a desktop browser** from
its own static files. Your photo and caption become a multi-panel poster
cover — bold lettering, Vice City sunset/neon grade — exported as a PNG to
share. Photos never leave your machine.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `app/index.html` from any static file server. No build step, no
network requests.

## What it does

- **Photos** — add up to 4 photos from your machine (or use the two bundled
  samples). Click a panel in the preview to select it, drag to reposition the
  photo, scroll to zoom, flip it, or fill every panel with one photo.
- **Layouts** — Hero + Three (the classic poster), Four Grid, Full Bleed,
  Tilted Snaps (polaroid-style), Nine Grid, Story Split.
- **Caption** — title in Anton with a sunset / white / neon gradient fill and
  heavy outline, script subtitle in Pacifico, badge ribbon, star heat meter.
- **Grades** — Sunset, Neon Nights, Golden Hour, Vice Noir, Cotton Candy,
  plus sunburst rays, palm silhouettes, halftone title block, film grain and
  vignette.
- **Export** — PNG in 1080×1080, 1080×1350, 1920×1080 and 1080×1920, one at a
  time or all three post sizes at once. Undo/redo and a shuffle button included.

## Files

- `app/` — the web app (static files only)
  - `index.html`, `style.css`
  - `src/cover.js` — the cover render engine (layouts, grades, lettering)
  - `src/editor.js` — editor state, undo/redo, export
  - `src/main.js` — bootstrap and font loading
  - `src/shots.js` — fixed `?shot=` scenes for screenshots
  - `fonts/` — Anton and Pacifico, SIL Open Font License (texts beside them)
  - `samples/` — two model-made sample photos, free to use
- `main.ts` — the entry program: copies `app/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` (Node 22, stdlib only)
- `screenshots/` — 4 screenshots taken from the app itself
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged

## Originality

All art, lettering and fonts in this app are original or SIL OFL licensed.
No Rockstar Games logo, artwork or font is used anywhere.

## License

MIT — see `LICENSE`.
