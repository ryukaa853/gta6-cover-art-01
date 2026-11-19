// Vice Coast Cover Studio — the editor: wires the controls to the cover engine,
// keeps an undo/redo history, and exports PNGs. Photos are read with
// URL.createObjectURL and never leave the machine; the app makes no network
// requests at all.

import {
  LAYOUTS, GRADES, SIZES, defaultState, layoutPanels, renderCover,
  renderExportCanvas, loadImageFile, loadImageUrl, clamp,
} from './cover.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const ctx = canvas.getContext('2d');

export const state = defaultState();
let selectedPanel = 0;
let history = [];
let future = [];
let previewW = 1080, previewH = 1080;

function snapshot() {
  return JSON.stringify({
    title: state.title, subtitle: state.subtitle, badge: state.badge,
    layout: state.layout, grade: state.grade, titleStyle: state.titleStyle,
    size: state.size, panels: state.panels, effects: state.effects,
    photoNames: state.photos.map((p) => p.name),
  });
}
function pushHistory() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  syncUndoButtons();
}
function applySnapshot(json) {
  const s = JSON.parse(json);
  state.title = s.title; state.subtitle = s.subtitle; state.badge = s.badge;
  state.layout = s.layout; state.grade = s.grade; state.titleStyle = s.titleStyle;
  state.size = s.size; state.panels = s.panels; state.effects = s.effects;
  // Photos themselves are not snapshotted; rebind by name, falling back to 0.
  for (const p of state.panels) {
    if (p.photo >= state.photos.length) p.photo = 0;
  }
  selectedPanel = Math.min(selectedPanel, layoutPanels(state.layout, 1, 1).length - 1);
  syncAllControls();
  redraw();
}
function syncUndoButtons() {
  $('undoBtn').disabled = history.length === 0;
  $('redoBtn').disabled = future.length === 0;
}
function undo() {
  if (!history.length) return;
  future.push(snapshot());
  applySnapshot(history.pop());
  syncUndoButtons();
}
function redo() {
  if (!future.length) return;
  history.push(snapshot());
  applySnapshot(future.pop());
  syncUndoButtons();
}

/** Preview canvas follows the selected export aspect, capped at 960 px. */
function fitPreviewCanvas() {
  const size = SIZES[state.size];
  const scale = Math.min(1, 960 / Math.max(size.w, size.h));
  previewW = Math.round(size.w * scale);
  previewH = Math.round(size.h * scale);
  canvas.width = previewW;
  canvas.height = previewH;
  $('previewLabel').textContent = `Preview · ${size.label}`;
}

export function redraw() {
  renderCover(ctx, state, previewW, previewH);
}

function status(msg) { $('status').textContent = msg; }

/** Adds photos (File objects) to the library, up to 4. */
export async function addPhotos(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) { status('That file is not an image.'); return; }
  pushHistory();
  for (const file of list) {
    if (state.photos.length >= 4) { status('Four photos at most — remove one first.'); break; }
    try {
      const img = await loadImageFile(file);
      state.photos.push({ img, name: file.name });
    } catch { status('Could not read ' + file.name); }
  }
  // A newly added photo fills any panel that has no photo yet.
  const rects = layoutPanels(state.layout, 1, 1);
  for (let i = 0; i < rects.length; i++) {
    if (state.panels[i].photo >= state.photos.length) state.panels[i].photo = state.photos.length - 1;
  }
  syncPhotoSlots();
  redraw();
  status(state.photos.length + (state.photos.length === 1 ? ' photo loaded.' : ' photos loaded.'));
}

export async function loadSamples() {
  pushHistory();
  const samples = [
    { url: 'samples/boulevard.jpg', name: 'boulevard.jpg' },
    { url: 'samples/pier.jpg', name: 'pier.jpg' },
  ];
  state.photos = [];
  for (const s of samples) {
    try {
      const img = await loadImageUrl(s.url);
      state.photos.push({ img, name: s.name });
    } catch { /* sample missing: keep going */ }
  }
  state.panels.forEach((p, i) => { p.photo = Math.min(i, Math.max(0, state.photos.length - 1)); });
  syncPhotoSlots();
  redraw();
  status('Sample photos loaded — replace them with your own any time.');
}

function syncPhotoSlots() {
  const wrap = $('photoSlots');
  wrap.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement('div');
    slot.className = 'photo-slot' + (state.photos[i] ? '' : ' empty');
    if (state.photos[i]) {
      const img = document.createElement('img');
      img.src = state.photos[i].img.src;
      img.alt = state.photos[i].name;
      slot.appendChild(img);
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = 'Photo ' + (i + 1);
      slot.appendChild(tag);
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'rm'; rm.textContent = '×';
      rm.title = 'Remove photo ' + (i + 1);
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        pushHistory();
        state.photos.splice(i, 1);
        for (const p of state.panels) {
          if (p.photo === i) p.photo = 0;
          else if (p.photo > i) p.photo -= 1;
        }
        syncPhotoSlots(); redraw();
      });
      slot.appendChild(rm);
      slot.addEventListener('click', () => {
        const rects = layoutPanels(state.layout, 1, 1);
        if (selectedPanel < rects.length) {
          pushHistory();
          state.panels[selectedPanel].photo = i;
          syncPanelControls(); redraw();
        }
      });
    } else {
      slot.textContent = '+';
      slot.title = 'Add a photo';
      slot.addEventListener('click', () => $('photoInput').click());
    }
    wrap.appendChild(slot);
  }
  syncPanelPhotoOptions();
}

function syncPanelPhotoOptions() {
  const sel = $('panelPhoto');
  sel.innerHTML = '';
  state.photos.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Photo ${i + 1} — ${p.name}`;
    sel.appendChild(opt);
  });
  if (!state.photos.length) {
    const opt = document.createElement('option');
    opt.value = '0';
    opt.textContent = 'No photo yet';
    sel.appendChild(opt);
  }
  const rects = layoutPanels(state.layout, 1, 1);
  if (selectedPanel < rects.length) sel.value = String(state.panels[selectedPanel].photo);
}

function syncPanelControls() {
  const rects = layoutPanels(state.layout, 1, 1);
  const p = state.panels[Math.min(selectedPanel, rects.length - 1)];
  $('panelZoom').value = String(Math.round(p.zoom * 100));
  $('zoomVal').textContent = Math.round(p.zoom * 100) + '%';
  syncPanelPhotoOptions();
}

function syncLayoutButtons() {
  for (const btn of $('layoutGrid').children) {
    btn.classList.toggle('active', btn.dataset.layout === state.layout);
  }
}
function syncGradeButtons() {
  for (const btn of $('gradeGrid').children) {
    btn.classList.toggle('active', btn.dataset.grade === state.grade);
  }
}

function syncAllControls() {
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('badgeInput').value = state.badge;
  $('titleStyle').value = state.titleStyle;
  $('sizeSelect').value = state.size;
  $('fxRays').checked = state.effects.rays;
  $('fxPalms').checked = state.effects.palms;
  $('fxHalftone').checked = state.effects.halftone;
  $('fxGrain').checked = state.effects.grain;
  $('fxVignette').checked = state.effects.vignette;
  fitPreviewCanvas();
  syncLayoutButtons();
  syncGradeButtons();
  syncPhotoSlots();
  syncPanelControls();
}

function buildPickers() {
  const lg = $('layoutGrid');
  for (const [key, def] of Object.entries(LAYOUTS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.layout = key;
    btn.textContent = def.name;
    btn.title = def.blurb;
    btn.addEventListener('click', () => {
      if (state.layout === key) return;
      pushHistory();
      state.layout = key;
      selectedPanel = 0;
      syncLayoutButtons(); syncPanelControls(); redraw();
    });
    lg.appendChild(btn);
  }
  const gg = $('gradeGrid');
  for (const [key, def] of Object.entries(GRADES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.grade = key;
    const sw = document.createElement('span');
    sw.className = 'grade-swatch';
    sw.style.background = def.swatch;
    btn.appendChild(sw);
    btn.appendChild(document.createTextNode(def.name));
    btn.addEventListener('click', () => {
      if (state.grade === key) return;
      pushHistory();
      state.grade = key;
      syncGradeButtons(); redraw();
    });
    gg.appendChild(btn);
  }
}

/** Which panel (index) sits under preview point (px, py)? -1 when none. */
function panelAt(px, py) {
  const rects = layoutPanels(state.layout, previewW, previewH);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (r.bg) continue; // the tilted background is not selectable
    if (px >= r.x * previewW && px <= (r.x + r.w) * previewW
      && py >= r.y * previewH && py <= (r.y + r.h) * previewH) return i;
  }
  return -1;
}

function bindPointer() {
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (previewW / rect.width);
    const py = (e.clientY - rect.top) * (previewH / rect.height);
    const idx = panelAt(px, py);
    if (idx === -1) return;
    selectedPanel = idx;
    syncPanelControls();
    const p = state.panels[idx];
    drag = { idx, startX: px, startY: py, ox: p.ox, oy: p.oy, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (previewW / rect.width);
    const py = (e.clientY - rect.top) * (previewH / rect.height);
    const rects = layoutPanels(state.layout, previewW, previewH);
    const r = rects[drag.idx];
    const p = state.panels[drag.idx];
    const img = state.photos[p.photo] ? state.photos[p.photo].img : null;
    if (!img) return;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const base = Math.max((r.w * previewW) / iw, (r.h * previewH) / ih);
    const s = base * p.zoom;
    const dx = px - drag.startX, dy = py - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      if (!drag.moved) { pushHistory(); drag.moved = true; }
      p.ox = clamp(drag.ox - dx / (iw * s), 0, 1);
      p.oy = clamp(drag.oy - dy / (ih * s), 0, 1);
      syncPanelControls();
      redraw();
    }
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (previewW / rect.width);
    const py = (e.clientY - rect.top) * (previewH / rect.height);
    const idx = panelAt(px, py);
    if (idx === -1) return;
    pushHistory();
    const p = state.panels[idx];
    p.zoom = clamp(p.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 1, 3);
    selectedPanel = idx;
    syncPanelControls();
    redraw();
  }, { passive: false });
}

function downloadCanvas(exportCanvas, name) {
  return new Promise((resolve) => {
    exportCanvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve(blob);
    }, 'image/png');
  });
}

export async function exportPng(sizeKey) {
  const size = SIZES[sizeKey];
  const out = renderExportCanvas(state, sizeKey);
  const slug = (state.title || 'cover').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
  await downloadCanvas(out, `${slug}-${size.w}x${size.h}.png`);
  status(`Saved ${slug}-${size.w}x${size.h}.png`);
  return out;
}

export async function exportAllSizes() {
  for (const key of ['1080x1080', '1080x1350', '1920x1080']) {
    await exportPng(key);
  }
  status('Saved all 3 post sizes.');
}

function randomise() {
  pushHistory();
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  state.titleStyle = ['sunset', 'white', 'neon'][Math.floor(Math.random() * 3)];
  selectedPanel = 0;
  syncAllControls();
  redraw();
  status('Shuffled layout, grade and title style.');
}

export function initEditor() {
  buildPickers();
  bindPointer();
  $('photoInput').addEventListener('change', (e) => { addPhotos(e.target.files); e.target.value = ''; });
  $('sampleBtn').addEventListener('click', loadSamples);
  $('fillAllBtn').addEventListener('click', () => {
    if (!state.photos.length) { status('Load a photo first.'); return; }
    pushHistory();
    for (const p of state.panels) p.photo = 0;
    syncPanelControls(); redraw();
    status('Every panel now shows photo 1.');
  });
  $('panelPhoto').addEventListener('change', (e) => {
    pushHistory();
    state.panels[selectedPanel].photo = Number(e.target.value);
    redraw();
  });
  $('panelZoom').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value) / 100;
    $('zoomVal').textContent = e.target.value + '%';
    redraw();
  });
  $('panelZoom').addEventListener('change', () => pushHistory());
  $('flipBtn').addEventListener('click', () => {
    pushHistory();
    state.panels[selectedPanel].flip = !state.panels[selectedPanel].flip;
    redraw();
  });
  $('resetPanelBtn').addEventListener('click', () => {
    pushHistory();
    state.panels[selectedPanel] = { photo: 0, zoom: 1, ox: 0.5, oy: 0.5, flip: false, slot: selectedPanel };
    syncPanelControls(); redraw();
  });
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  $('titleInput').addEventListener('change', () => pushHistory());
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('subtitleInput').addEventListener('change', () => pushHistory());
  $('badgeInput').addEventListener('input', (e) => { state.badge = e.target.value; redraw(); });
  $('badgeInput').addEventListener('change', () => pushHistory());
  $('titleStyle').addEventListener('change', (e) => { pushHistory(); state.titleStyle = e.target.value; redraw(); });
  for (const [key, id] of [['rays', 'fxRays'], ['palms', 'fxPalms'], ['halftone', 'fxHalftone'], ['grain', 'fxGrain'], ['vignette', 'fxVignette']]) {
    $(id).addEventListener('change', (e) => { pushHistory(); state.effects[key] = e.target.checked; redraw(); });
  }
  $('sizeSelect').addEventListener('change', (e) => {
    pushHistory();
    state.size = e.target.value;
    fitPreviewCanvas();
    redraw();
  });
  $('exportBtn').addEventListener('click', () => exportPng(state.size));
  $('exportAllBtn').addEventListener('click', exportAllSizes);
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('shuffleBtn').addEventListener('click', randomise);
  syncAllControls();
  syncUndoButtons();
  redraw();
}
