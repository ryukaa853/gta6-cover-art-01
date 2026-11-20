// Vice Coast Cover Studio — the cover engine. Pure canvas 2D, no libraries.
// Draws a multi-panel GTA-poster-style cover from the user's photos, a caption
// and a grade, at any size. Everything drawn here is original art: gradient
// grades, vector palm silhouettes, halftone, grain and hand-set lettering
// (Anton + Pacifico, SIL OFL). No Rockstar logo, artwork or font is used.

export const LAYOUTS = {
  hero3: { name: 'Hero + Three', panels: 4, blurb: 'The classic poster: one hero, three stacked' },
  grid4: { name: 'Four Grid', panels: 4, blurb: 'Four equal panels' },
  fullbleed: { name: 'Full Bleed', panels: 1, blurb: 'One photo, edge to edge' },
  tilted: { name: 'Tilted Snaps', panels: 4, blurb: 'Polaroid-style tilted snapshots' },
  nine: { name: 'Nine Grid', panels: 9, blurb: 'Nine-panel contact sheet' },
  story: { name: 'Story Split', panels: 4, blurb: 'Hero on top, three below' },
};

export const GRADES = {
  sunset: { name: 'Sunset', swatch: 'linear-gradient(135deg,#ffd166,#ff7a18 45%,#ff2e88)' },
  neon: { name: 'Neon Nights', swatch: 'linear-gradient(135deg,#ff2e88,#7c3aed 50%,#22d3ee)' },
  golden: { name: 'Golden Hour', swatch: 'linear-gradient(135deg,#fff3b0,#ffb703 50%,#fb8500)' },
  noir: { name: 'Vice Noir', swatch: 'linear-gradient(135deg,#e5e5e5,#737373 50%,#111111)' },
  candy: { name: 'Cotton Candy', swatch: 'linear-gradient(135deg,#ffc6ff,#bdb2ff 50%,#a0c4ff)' },
};

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape · 1920 × 1080' },
  '1080x1920': { w: 1080, h: 1920, label: 'Story · 1080 × 1920' },
};

/** A fresh default state. `panels` always holds 9 slots; a layout uses its first N. */
export function defaultState() {
  return {
    title: 'VICE COAST',
    subtitle: 'Neon Shore Nights',
    badge: 'LEONIDA • EST. 2026',
    layout: 'hero3',
    grade: 'sunset',
    titleStyle: 'sunset',
    size: '1080x1080',
    photos: [], // { img: HTMLImageElement, name: string }
    panels: Array.from({ length: 9 }, (_, i) => ({
      photo: 0, zoom: 1, ox: 0.5, oy: 0.5, flip: false, slot: i,
    })),
    effects: { rays: true, palms: true, halftone: true, grain: true, vignette: true },
  };
}

export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/** Panel rectangles for a layout, in fractions of the cover (x, y, w, h, rotate). */
export function layoutPanels(layout, W, H) {
  const g = Math.max(4, Math.round(Math.min(W, H) * 0.008)); // gutter, px
  const gx = g / W, gy = g / H;
  switch (layout) {
    case 'hero3': {
      const rx = 0.62 + gx, rw = 1 - rx;
      const ph = (1 - 2 * gy) / 3;
      return [
        { x: 0, y: 0, w: 0.62, h: 1 },
        { x: rx, y: 0, w: rw, h: ph },
        { x: rx, y: ph + gy, w: rw, h: ph },
        { x: rx, y: 2 * (ph + gy), w: rw, h: ph },
      ];
    }
    case 'grid4': {
      const w = (1 - gx) / 2, h = (1 - gy) / 2;
      return [
        { x: 0, y: 0, w, h }, { x: w + gx, y: 0, w, h },
        { x: 0, y: h + gy, w, h }, { x: w + gx, y: h + gy, w, h },
      ];
    }
    case 'fullbleed':
      return [{ x: 0, y: 0, w: 1, h: 1 }];
    case 'tilted': {
      // Background photo plus three tilted snapshot frames on top.
      const sw = 0.34, sh = 0.40;
      return [
        { x: 0, y: 0, w: 1, h: 1, bg: true },
        { x: 0.05, y: 0.06, w: sw, h: sh, rotate: -6, frame: true },
        { x: 0.60, y: 0.10, w: sw, h: sh, rotate: 5, frame: true },
        { x: 0.31, y: 0.42, w: sw, h: sh, rotate: -2, frame: true },
      ];
    }
    case 'nine': {
      const w = (1 - 2 * gx) / 3, h = (1 - 2 * gy) / 3;
      const out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
        out.push({ x: c * (w + gx), y: r * (h + gy), w, h });
      return out;
    }
    case 'story': {
      const top = 0.60, bw = (1 - 2 * gx) / 3, bh = 1 - top - gy;
      return [
        { x: 0, y: 0, w: 1, h: top },
        { x: 0, y: top + gy, w: bw, h: bh },
        { x: bw + gx, y: top + gy, w: bw, h: bh },
        { x: 2 * (bw + gx), y: top + gy, w: bw, h: bh },
      ];
    }
    default:
      return [{ x: 0, y: 0, w: 1, h: 1 }];
  }
}

/** Draws one photo into a rectangle, cover-fit, with the panel's zoom/pan/flip. */
function drawPhotoInto(ctx, img, rect, panel, W, H) {
  const rx = rect.x * W, ry = rect.y * H, rw = rect.w * W, rh = rect.h * H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  if (!img) {
    // Placeholder: a sunset gradient with a sun disc, so the cover still
    // looks finished before any photo is added.
    const grad = ctx.createLinearGradient(rx, ry, rx, ry + rh);
    grad.addColorStop(0, '#3b1d5e');
    grad.addColorStop(0.55, '#ff7a18');
    grad.addColorStop(1, '#ff2e88');
    ctx.fillStyle = grad;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
    ctx.beginPath();
    ctx.arc(rx + rw / 2, ry + rh * 0.42, Math.min(rw, rh) * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const base = Math.max(rw / iw, rh / ih);
  const s = base * panel.zoom;
  const dw = iw * s, dh = ih * s;
  // Clamp the focal point so the image always covers the rectangle.
  const visX = rw / dw, visY = rh / dh;
  const ox = visX >= 1 ? 0.5 : clamp(panel.ox, visX / 2, 1 - visX / 2);
  const oy = visY >= 1 ? 0.5 : clamp(panel.oy, visY / 2, 1 - visY / 2);
  const dx = rx + rw / 2 - iw * ox * s;
  const dy = ry + rh / 2 - ih * oy * s;
  if (panel.flip) {
    ctx.translate(rx + rw / 2, ry + rh / 2);
    ctx.scale(-1, 1);
    ctx.translate(-(rx + rw / 2), -(ry + rh / 2));
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  // Thin printed-poster edge around the panel.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(1, W * 0.0015);
  ctx.strokeRect(rx, ry, rw, rh);
  ctx.restore();
}

/** A stylised palm silhouette, drawn with strokes from a crown point.
 *  Local units are ~140 tall; `scale` sizes it to the cover. Fronds droop:
 *  each arc rises from the crown and ends below it, like a real palm. */
function drawPalm(ctx, x, y, scale, flip, color) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk: a leaning curve, thicker at the base.
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -55, 26, -110);
  ctx.stroke();
  // Fronds: six arched, drooping fronds from the crown. Each arc rises high
  // above the crown and falls back to (or below) its level, like a real palm.
  ctx.lineWidth = 7;
  const crownX = 26, crownY = -110;
  const fronds = [
    [-75, -70, -120, -5], [-55, -85, -95, -45], [-20, -90, -35, -85],
    [20, -90, 30, -88], [55, -85, 90, -50], [75, -65, 115, -5],
  ];
  for (const [cx, cy, ex, ey] of fronds) {
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + cx, crownY + cy, crownX + ex, crownY + ey);
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath(); ctx.arc(crownX - 5, crownY + 5, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(crownX + 7, crownY + 7, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Deterministic grain tile (seeded, so every export matches the preview). */
let grainTile = null;
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function getGrainTile() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = 160; c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  const rnd = mulberry32(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

/** The colour grade: translucent washes over the photos, per grade. */
function applyGrade(ctx, grade, W, H) {
  ctx.save();
  if (grade === 'sunset') {
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(255, 190, 80, 0.10)');
    wash.addColorStop(0.6, 'rgba(255, 122, 24, 0.12)');
    wash.addColorStop(1, 'rgba(255, 46, 136, 0.28)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255, 120, 40, 0.35)'; ctx.fillRect(0, 0, W, H);
  } else if (grade === 'neon') {
    const a = ctx.createLinearGradient(0, 0, W, H);
    a.addColorStop(0, 'rgba(255, 46, 136, 0.30)');
    a.addColorStop(1, 'rgba(34, 211, 238, 0.30)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = a; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(124, 58, 237, 0.35)'; ctx.fillRect(0, 0, W, H);
  } else if (grade === 'golden') {
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255, 183, 3, 0.30)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(251, 133, 0, 0.35)'; ctx.fillRect(0, 0, W, H);
  } else if (grade === 'noir') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(128,128,128,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(20,20,40,0.30)'; ctx.fillRect(0, 0, W, H);
  } else if (grade === 'candy') {
    const a = ctx.createLinearGradient(0, 0, W, H);
    a.addColorStop(0, 'rgba(255, 198, 255, 0.28)');
    a.addColorStop(1, 'rgba(160, 196, 255, 0.28)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = a; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawSunburst(ctx, W, H) {
  const cx = W * 0.78, cy = H * 0.16, r = Math.max(W, H) * 0.9;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(cx, cy);
  for (let i = 0; i < 24; i++) {
    ctx.rotate(Math.PI / 12);
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 220, 130, 0.07)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -Math.PI / 24, Math.PI / 24);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawHalftone(ctx, y0, y1, W) {
  const step = Math.max(10, W * 0.012);
  ctx.save();
  for (let y = y0; y < y1; y += step) {
    const t = (y - y0) / (y1 - y0); // 0 at top of band, 1 at bottom
    const r = step * (0.12 + 0.38 * t);
    ctx.fillStyle = `rgba(10, 4, 20, ${0.05 + 0.22 * t})`;
    for (let x = step / 2; x < W; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Wraps title words to fit `maxW` at font size `size`; returns lines. */
function wrapTitle(ctx, text, size, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    ctx.font = `${size}px Anton, sans-serif`;
    if (ctx.measureText(test).width <= maxW || !line) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/** The title block: badge, big title, script subtitle, star row. */
function drawTitleBlock(ctx, state, W, H) {
  const bandH = H * 0.30;
  const y0 = H - bandH;
  // Legibility band.
  const band = ctx.createLinearGradient(0, y0 - H * 0.06, 0, H);
  band.addColorStop(0, 'rgba(12, 4, 24, 0)');
  band.addColorStop(0.45, 'rgba(12, 4, 24, 0.55)');
  band.addColorStop(1, 'rgba(12, 4, 24, 0.82)');
  ctx.fillStyle = band;
  ctx.fillRect(0, y0 - H * 0.06, W, H * 0.36);
  if (state.effects.halftone) drawHalftone(ctx, y0 + bandH * 0.55, H, W);

  const cx = W / 2;
  const maxW = W * 0.92;
  const title = (state.title || 'VICE COAST').toUpperCase();
  // Fit the title: shrink until the longest line fits.
  let size = H * 0.115;
  let lines = [];
  while (size > H * 0.03) {
    ctx.font = `${size}px Anton, sans-serif`;
    lines = wrapTitle(ctx, title, size, maxW);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= maxW && lines.length <= 2) break;
    size *= 0.92;
  }
  const lineH = size * 0.98;
  const badge = (state.badge || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  // Lay the whole stack out top-down from a bottom margin, so nothing can
  // fall off the canvas: badge, title lines, subtitle, star row.
  const badgeH = badge ? H * 0.038 : 0;
  const badgeGap = badge ? H * 0.014 : 0;
  const subGap = subtitle ? H * 0.040 : 0;
  const starGap = H * 0.030;
  const stackH = badgeH + badgeGap + lines.length * lineH + subGap + starGap;
  let top = H - H * 0.018 - stackH;

  // Badge ribbon above the title.
  if (badge) {
    ctx.font = `${Math.round(H * 0.021)}px Anton, sans-serif`;
    const bw = ctx.measureText(badge).width + H * 0.05;
    const bh = badgeH;
    const bx = cx - bw / 2, by = top;
    ctx.save();
    ctx.fillStyle = 'rgba(12, 4, 24, 0.78)';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = Math.max(1.5, H * 0.002);
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`★ ${badge} ★`, cx, by + bh / 2 + 1);
    ctx.restore();
    top += badgeH + badgeGap;
  }

  // Title with gradient fill and heavy outline. `top` is now the top of the
  // first title line, so the first baseline sits one line height below it.
  const titleTop = top;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  let grad;
  if (state.titleStyle === 'white') {
    grad = ctx.createLinearGradient(0, titleTop, 0, titleTop + lines.length * lineH);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#ffe9f3');
  } else if (state.titleStyle === 'neon') {
    grad = ctx.createLinearGradient(0, titleTop, 0, titleTop + lines.length * lineH);
    grad.addColorStop(0, '#22d3ee'); grad.addColorStop(0.5, '#ff2e88'); grad.addColorStop(1, '#ffd166');
  } else {
    grad = ctx.createLinearGradient(0, titleTop, 0, titleTop + lines.length * lineH);
    grad.addColorStop(0, '#ffd166'); grad.addColorStop(0.55, '#ff7a18'); grad.addColorStop(1, '#ff2e88');
  }
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.04;
  ctx.font = `${size}px Anton, sans-serif`;
  for (let i = 0; i < lines.length; i++) {
    const ly = titleTop + (i + 1) * lineH - size * 0.12;
    ctx.strokeStyle = '#160a24';
    ctx.lineWidth = size * 0.16;
    ctx.strokeText(lines[i], cx, ly);
    ctx.fillStyle = grad;
    ctx.fillText(lines[i], cx, ly);
  }
  ctx.restore();
  let below = titleTop + lines.length * lineH;

  // Subtitle in script, with a neon glow.
  if (subtitle) {
    const subSize = H * 0.042;
    ctx.save();
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = state.grade === 'neon' ? '#22d3ee' : '#ff2e88';
    ctx.shadowBlur = subSize * 0.45;
    ctx.fillText(subtitle, cx, below + subGap);
    ctx.restore();
    below += subGap;
  }

  // Heat-meter stars under the subtitle.
  ctx.save();
  ctx.font = `${Math.round(H * 0.02)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('★ ★ ★ ★ ☆', cx, below + starGap);
  ctx.restore();
}

/** Renders the whole cover onto `ctx` at W × H. */
export function renderCover(ctx, state, W, H) {
  ctx.save();
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, W, H);

  const rects = layoutPanels(state.layout, W, H);
  const bg = rects.find((r) => r.bg);
  const photos = state.photos;
  const photoFor = (i) => {
    const p = state.panels[i];
    return photos[p.photo] ? photos[p.photo].img : null;
  };

  if (bg) {
    // Tilted layout: background photo first, snapshots on top.
    drawPhotoInto(ctx, photoFor(0), bg, state.panels[0], W, H);
    if (state.effects.rays) drawSunburst(ctx, W, H);
    applyGrade(ctx, state.grade, W, H);
    for (let i = 1; i < rects.length; i++) {
      const r = rects[i];
      const cx = (r.x + r.w / 2) * W, cy = (r.y + r.h / 2) * H;
      const fw = Math.round(r.w * W), fh = Math.round(r.h * H), pad = W * 0.018;
      // Render the snapshot photo to its own canvas first (the frame is drawn
      // in a rotated transform, which a direct clip would misplace).
      const snap = document.createElement('canvas');
      snap.width = fw; snap.height = fh;
      drawPhotoInto(snap.getContext('2d'), photoFor(i), { x: 0, y: 0, w: 1, h: 1 }, state.panels[i], fw, fh);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((r.rotate || 0) * Math.PI) / 180);
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = W * 0.02;
      ctx.shadowOffsetY = W * 0.008;
      ctx.fillStyle = '#fdf6ec';
      ctx.fillRect(-fw / 2 - pad, -fh / 2 - pad, fw + pad * 2, fh + pad * 2 + pad * 1.6);
      ctx.shadowColor = 'transparent';
      ctx.drawImage(snap, -fw / 2, -fh / 2);
      ctx.restore();
    }
  } else {
    for (let i = 0; i < rects.length; i++) {
      drawPhotoInto(ctx, photoFor(i), rects[i], state.panels[i], W, H);
    }
    if (state.effects.rays) drawSunburst(ctx, W, H);
    applyGrade(ctx, state.grade, W, H);
  }

  // Palm silhouettes in the lower corners, over the photos, under the title.
  if (state.effects.palms) {
    const s = H * 0.0011;
    ctx.save();
    ctx.globalAlpha = 0.92;
    drawPalm(ctx, W * 0.005, H * 0.995, s, false, '#12081f');
    drawPalm(ctx, W * 0.995, H * 0.995, s * 0.9, true, '#12081f');
    ctx.restore();
  }

  drawTitleBlock(ctx, state, W, H);

  if (state.effects.grain) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'overlay';
    const tile = getGrainTile();
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.effects.vignette) {
    const v = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75,
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8,2,16,0.38)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

/** Renders the cover to a fresh canvas at the export size and returns it. */
export function renderExportCanvas(state, sizeKey) {
  const size = SIZES[sizeKey] || SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  renderCover(canvas.getContext('2d'), state, size.w, size.h);
  return canvas;
}

/** Loads an image file (File/Blob) into an Image element. The object URL is
 *  kept alive: the photo-slot thumbnails reuse the same URL as their src. */
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read ' + file.name));
    img.src = url;
  });
}

/** Loads an image from a same-origin URL (samples, or a data: URL). */
export function loadImageUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + url));
    img.src = url;
  });
}
