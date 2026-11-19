// Fixed scenes for screenshots: `?shot=editor` shows the editor with photos
// loaded; `?shot=cover` shows the exported cover alone, full frame.
// `layout`, `grade`, `size`, `title`, `subtitle` and `titleStyle` come from
// the query string. window.__shotReady is set once the scene is painted.
import { state, redraw, loadSamples } from './editor.js';
import { SIZES, renderCover } from './cover.js';

const PRESETS = {
  editor: { layout: 'hero3', grade: 'sunset', title: 'VICE COAST', subtitle: 'Neon Shore Nights', titleStyle: 'sunset' },
  cover: { layout: 'hero3', grade: 'sunset', title: 'VICE COAST', subtitle: 'Neon Shore Nights', titleStyle: 'sunset' },
  portrait: { layout: 'tilted', grade: 'neon', title: 'NIGHT SHIFT', subtitle: 'Vice City after dark', titleStyle: 'neon' },
  square: { layout: 'nine', grade: 'golden', title: 'PIER PRESSURE', subtitle: 'Golden hour crew', titleStyle: 'white' },
};

export async function runShot(shot, query) {
  const preset = PRESETS[shot] || PRESETS.editor;
  state.layout = query.get('layout') || preset.layout;
  state.grade = query.get('grade') || preset.grade;
  state.title = query.get('title') || preset.title;
  state.subtitle = query.get('subtitle') || preset.subtitle;
  state.titleStyle = query.get('titleStyle') || preset.titleStyle;
  state.size = query.get('size') || '1080x1080';
  if (query.get('rays') === '0') state.effects.rays = false;
  if (query.get('palms') === '0') state.effects.palms = false;
  if (query.get('halftone') === '0') state.effects.halftone = false;
  if (query.get('grain') === '0') state.effects.grain = false;
  if (query.get('vignette') === '0') state.effects.vignette = false;

  await loadSamples();
  // Spread the two samples across the panels so every panel shows a photo.
  state.panels.forEach((p, i) => { p.photo = i % Math.max(1, state.photos.length); });

  if (shot === 'cover' || shot === 'portrait' || shot === 'square') {
    document.body.classList.add('shot-cover');
    const size = SIZES[state.size] || SIZES['1080x1080'];
    const canvas = document.getElementById('cover');
    canvas.width = size.w;
    canvas.height = size.h;
    renderCover(canvas.getContext('2d'), state, size.w, size.h);
    // Keep the canvas at its export aspect for the screenshot.
    canvas.style.width = '100vw';
    canvas.style.height = 'auto';
    canvas.style.maxHeight = '100vh';
  } else {
    // Editor scene: run the full editor so the screenshot shows the real UI.
    const { initEditor } = await import('./editor.js');
    initEditor();
    redraw();
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
