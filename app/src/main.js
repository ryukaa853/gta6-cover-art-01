// Vice Coast Cover Studio — bootstrap. Loads the vendored fonts, then starts the
// editor, or a fixed `?shot=` scene for screenshots (see shots.js).
import { initEditor, state, redraw, loadSamples } from './editor.js';
import { runShot } from './shots.js';

async function loadFonts() {
  // Fonts are local files under fonts/; no network is involved.
  try {
    await Promise.all([
      document.fonts.load('400 100px Anton'),
      document.fonts.load('400 60px Pacifico'),
    ]);
    await document.fonts.ready;
  } catch {
    // The canvas falls back to sans-serif; the cover still renders.
  }
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  await loadFonts();
  if (shot) {
    await runShot(shot, params);
    window.__shotReady = true;
    return;
  }
  initEditor();
  // Start with the sample photos so the first paint already looks like a cover.
  await loadSamples();
  redraw();
  window.__shotReady = true;
}

boot();
