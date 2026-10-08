import { raster, rectangles, outlineRaster, legacyRaster } from '../../lib/geometry/raster.js';
import { SCENE_IDS, sceneImage } from './scenes.js';

/** Plate colours come from the CSS tokens so the canvas and the page stay one system. */
function palette(canvas) {
  // Read from the canvas: the background choice overrides the plate tokens on #quant, below the document element.
  const css = getComputedStyle(canvas), read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return { plate: read('--plate', '#0a0c0f'), plateLight: read('--plate-light', '#1a1e24'), grid: read('--plate-grid', '#171b21'),
    axis: read('--plate-axis', '#2a303a'), ink: read('--plate-ink', '#8b94a1'), annot: read('--plate-annot', '#f08a24'),
    shared: read('--diff-shared', '#d9dde3'), extra: read('--diff-extra', '#f08a24'), missing: read('--diff-missing', '#5aa9e6'),
    mono: read('--font-mono', 'monospace'), halo: read('--plate-halo', ''),
    // A generated scene background, named by the token on #quant; anything unknown paints the flat plate.
    scene: SCENE_IDS.includes(read('--plate-scene', '')) ? read('--plate-scene', '') : '' };
}

function grid(context, width, height, ox, oy, zoom, colors) {
  context.strokeStyle = colors.grid; context.lineWidth = 1; context.beginPath();
  for (let x = ox % zoom; x < width; x += zoom) { context.moveTo(Math.round(x) + .5, 0); context.lineTo(Math.round(x) + .5, height); }
  for (let y = oy % zoom; y < height; y += zoom) { context.moveTo(0, Math.round(y) + .5); context.lineTo(width, Math.round(y) + .5); }
  context.stroke();
}

/** Registration ticks on the plate edges mark the screen centre, like a print register. The model origin is the
 * screen centre, which on an even-sized screen (1920×1080) is a pixel corner, not a pixel: a 1 px bar cannot sit on
 * it, so the old and new games each draw it half a pixel off, the old one right/down, the new one left/up. */
function registration(context, width, height, ox, oy, colors) {
  const cx = Math.round(ox) + .5, cy = Math.round(oy) + .5, tick = 7;
  context.beginPath();
  context.moveTo(cx, 0); context.lineTo(cx, tick); context.moveTo(cx, height - tick); context.lineTo(cx, height);
  context.moveTo(0, cy); context.lineTo(tick, cy); context.moveTo(width - tick, cy); context.lineTo(width, cy);
  // On a scene the ticks carry a halo so they read on any part of the picture.
  if (colors.scene) { context.strokeStyle = colors.halo; context.lineWidth = 3; context.stroke(); }
  context.strokeStyle = colors.axis; context.lineWidth = 1; context.stroke();
}

/** Small ring on the screen centre. Painted beneath the crosshair layers: at low zoom it passes through the four
 * centre pixels, and the preview must never change a game pixel. */
function centreMark(context, ox, oy, colors) {
  for (const [style, lineWidth] of [[colors.scene ? colors.halo : colors.plate, 3], [colors.annot, 1.5]]) {
    context.strokeStyle = style; context.lineWidth = lineWidth;
    context.beginPath(); context.arc(ox, oy, 3, 0, 2 * Math.PI); context.stroke();
  }
}

/** Outline layer: black at its own exported opacity, drawn beneath the core like the game does. */
function drawOutline(context, mask, width, height, zoom, alpha) {
  const ox = Math.floor(width / 2), oy = Math.floor(height / 2), half = (mask.side - 1) / 2;
  context.fillStyle = '#000'; context.globalAlpha = alpha / 255;
  for (let i = 0; i < mask.data.length; i++)
    if (mask.data[i]) context.fillRect(ox + (i % mask.side - half) * zoom, oy + (Math.floor(i / mask.side) - half) * zoom, zoom, zoom);
  context.globalAlpha = 1;
}

function drawCells(context, mask, reference, width, height, zoom, color, colors) {
  const ox = Math.floor(width / 2), oy = Math.floor(height / 2), half = (mask.side - 1) / 2;
  const rgb = `rgb(${color.rgb.join(',')})`;
  context.globalAlpha = color.alpha / 255;
  for (let i = 0; i < mask.data.length; i++) {
    const a = mask.data[i], b = reference?.data[i];
    if (!(a || b)) continue;
    context.fillStyle = reference ? (a && b ? colors.shared : a ? colors.extra : colors.missing) : rgb;
    context.fillRect(ox + (i % mask.side - half) * zoom, oy + (Math.floor(i / mask.side) - half) * zoom, zoom, zoom);
  }
  context.globalAlpha = 1;
}

/** Dimension lines for the right arm: length below the whole crosshair (outline included), thickness beside it, in
 * game pixels. Crossed arms overlap in game, so their ruler spans the visible horizontal stroke instead of one arm. */
function dimensions(context, geometry, settings, width, height, zoom, colors, outline) {
  if (!(geometry?.length > 0) || !(geometry.width > 0)) return;
  const rects = rectangles(geometry, settings), [left, arm] = rects;
  if (!arm) return;
  const ox = Math.floor(width / 2), oy = Math.floor(height / 2), edge = v => Math.ceil(v - .5);
  const crossed = left.x + left.w > arm.x;
  const x0 = ox + edge(crossed ? Math.min(left.x, arm.x) : arm.x) * zoom;
  const x1 = ox + edge(crossed ? Math.max(left.x + left.w, arm.x + arm.w) : arm.x + arm.w) * zoom;
  const bottom = oy + (Math.max(...rects.map(r => edge(r.y + r.h))) + (outline?.high ?? 0)) * zoom;
  const y0 = oy + edge(arm.y) * zoom, y1 = oy + edge(arm.y + arm.h) * zoom;
  const length = (x1 - x0) / zoom, thickness = (y1 - y0) / zoom;
  context.strokeStyle = context.fillStyle = colors.annot; context.lineWidth = 1;
  context.font = `500 11px ${colors.mono}`; context.textBaseline = 'middle';
  const gap = Math.max(10, Math.round(zoom * .9)), tick = 4;
  const text = (label, tx, ty) => {
    if (colors.scene) {
      context.save(); context.strokeStyle = colors.halo; context.lineWidth = 3; context.lineJoin = 'round';
      context.strokeText(label, tx, ty); context.restore();
    }
    context.fillText(label, tx, ty);
  };
  const line = (ax, ay, bx, by) => {
    context.moveTo(Math.round(ax) + .5, Math.round(ay) + .5); context.lineTo(Math.round(bx) + .5, Math.round(by) + .5);
  };
  context.beginPath();
  if (x1 - x0 >= 14 && bottom + gap + 18 < height) {
    const y = bottom + gap;
    line(x0, y, x1, y); line(x0, y - tick, x0, y + tick); line(x1 - 1, y - tick, x1 - 1, y + tick);
    context.textAlign = 'left'; text(crossed ? `${length} px across` : `${length} px`, x0, y + 12);
  }
  if (x1 + gap + 44 < width) {
    const x = x1 + gap;
    line(x, y0, x, y1 - 1); line(x - tick, y0, x + tick, y0); line(x - tick, y1 - 1, x + tick, y1 - 1);
    context.textAlign = 'left'; text(`${thickness} px`, x + 7, (y0 + y1) / 2);
  }
  if (colors.scene) {
    context.strokeStyle = colors.halo; context.lineWidth = 3; context.stroke();
    context.strokeStyle = colors.annot; context.lineWidth = 1;
  }
  context.stroke();
}

/** Largest integer magnification at which every mask fits comfortably on the canvas. `settings` may be one per geometry. */
export function fitZoom(canvas, geometries, settings, outlines = []) {
  const rect = canvas.getBoundingClientRect(), room = Math.max(40, Math.min(rect.width, rect.height || 150)) / 2 * .56;
  let extent = 1;
  const of = index => Array.isArray(settings) ? settings[index] : settings;
  const masks = geometries.flatMap((geometry, index) => !geometry ? [] : [geometry.data ? geometry : raster(geometry, of(index)),
    ...(outlines[index] && !geometry.data ? [outlineRaster(geometry, of(index), outlines[index])] : [])]);
  // Cell c spans [c, c + 1] around the screen centre (the canvas centre), so its reach is max(-c, c + 1).
  for (const mask of masks) {
    const half = (mask.side - 1) / 2;
    for (let i = 0; i < mask.data.length; i++) {
      if (!mask.data[i]) continue;
      const x = i % mask.side - half, y = Math.floor(i / mask.side) - half;
      extent = Math.max(extent, -x, x + 1, -y, y + 1);
    }
  }
  return Math.max(1, Math.min(40, Math.floor(room / extent)));
}

export function paintQuant(canvas, geometry, settings, color, zoom = 6, difference = null, options = {}) {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), base = palette(canvas);
  // `lightPlate`: a lighter screen so black outline strokes stay visible (the sample plates; the token equals the plate
  // on the Grey and Light backgrounds).
  const colors = options.lightPlate ? { ...base, plate: base.plateLight } : base;
  const width = Math.max(80, rect.width), height = Math.max(100, rect.height || 150);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  const context = canvas.getContext('2d');
  context.scale(dpr, dpr); context.imageSmoothingEnabled = false;
  context.fillStyle = colors.plate; context.fillRect(0, 0, width, height);
  // A scene is a 32×18 composition scaled to the whole plate with smoothing on: the upscale is the blur (no ctx.filter,
  // which Safari lacks). It is identical on every plate; smoothing goes off again before any crosshair cell is drawn.
  if (colors.scene) {
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(sceneImage(colors.scene), 0, 0, width, height);
    context.imageSmoothingEnabled = false;
  }
  const reference = difference?.data ? difference : difference ? raster(difference, settings) : null;
  // Old plates paint element by element, outline then fill, so a later outline covers earlier fills.
  const legacy = options.legacy && options.outline && !reference && !options.mask
    ? legacyRaster(geometry, settings, options.outline) : null;
  const mask = options.mask ?? legacy?.core ?? raster(geometry, settings, reference?.side ?? 161);
  const ox = Math.floor(width / 2), oy = Math.floor(height / 2);
  if (options.grid && zoom >= 4) grid(context, width, height, ox, oy, zoom, colors);
  registration(context, width, height, ox, oy, colors);
  if (zoom >= 4) centreMark(context, ox, oy, colors);
  if (options.outline && !reference && !options.mask)
    drawOutline(context, legacy?.outline ?? outlineRaster(geometry, settings, options.outline), width, height, zoom,
      options.outlineAlpha ?? color.alpha);
  drawCells(context, mask, reference, width, height, zoom, color, colors);
  if (options.annotate && !reference && !options.mask)
    dimensions(context, geometry, settings, width, height, zoom, colors, options.outline);
}
