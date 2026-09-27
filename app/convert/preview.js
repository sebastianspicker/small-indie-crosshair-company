import { raster, rectangles } from '../../lib/geometry/raster.js';

/** Plate colours come from the CSS tokens so the canvas and the page stay one system. */
function palette() {
  const css = getComputedStyle(document.documentElement), read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return { plate: read('--plate', '#0c0e0d'), grid: read('--plate-grid', '#1b1f1c'), axis: read('--plate-axis', '#2f3530'),
    ink: read('--plate-ink', '#92948c'), annot: read('--plate-annot', '#e8c547'), shared: read('--diff-shared', '#d8d4c8'),
    extra: read('--diff-extra', '#e8b547'), missing: read('--diff-missing', '#6fa6cf'),
    mono: read('--font-mono', 'monospace') };
}

function grid(context, width, height, ox, oy, zoom, colors) {
  context.strokeStyle = colors.grid; context.lineWidth = 1; context.beginPath();
  for (let x = ox % zoom; x < width; x += zoom) { context.moveTo(Math.round(x) + .5, 0); context.lineTo(Math.round(x) + .5, height); }
  for (let y = oy % zoom; y < height; y += zoom) { context.moveTo(0, Math.round(y) + .5); context.lineTo(width, Math.round(y) + .5); }
  context.stroke();
}

/** Registration ticks on the plate edges mark the centre row and column, like a print register. */
function registration(context, width, height, ox, oy, zoom, colors) {
  const cx = Math.round(ox + zoom / 2) + .5, cy = Math.round(oy + zoom / 2) + .5, tick = 7;
  context.strokeStyle = colors.axis; context.lineWidth = 1; context.beginPath();
  context.moveTo(cx, 0); context.lineTo(cx, tick); context.moveTo(cx, height - tick); context.lineTo(cx, height);
  context.moveTo(0, cy); context.lineTo(tick, cy); context.moveTo(width - tick, cy); context.lineTo(width, cy);
  context.stroke();
}

function drawCells(context, mask, reference, width, height, zoom, color, colors) {
  const ox = Math.floor(width / 2), oy = Math.floor(height / 2), half = (mask.side - 1) / 2;
  const rgb = `rgb(${color.rgb.join(',')})`;
  context.globalAlpha = reference ? 1 : color.alpha / 255;
  for (let i = 0; i < mask.data.length; i++) {
    const a = mask.data[i], b = reference?.data[i];
    if (!(a || b)) continue;
    context.fillStyle = reference ? (a && b ? colors.shared : a ? colors.extra : colors.missing) : rgb;
    context.fillRect(ox + (i % mask.side - half) * zoom, oy + (Math.floor(i / mask.side) - half) * zoom, zoom, zoom);
  }
  context.globalAlpha = 1;
}

/** Dimension lines for the right arm: length below it, thickness beside it, in game pixels. */
function dimensions(context, geometry, settings, width, height, zoom, colors) {
  if (!(geometry?.length > 0) || !(geometry.width > 0)) return;
  const arm = rectangles(geometry, settings)[1];
  if (!arm) return;
  const ox = Math.floor(width / 2), oy = Math.floor(height / 2), edge = v => Math.ceil(v - .5);
  const x0 = ox + edge(arm.x) * zoom, x1 = ox + edge(arm.x + arm.w) * zoom;
  const y0 = oy + edge(arm.y) * zoom, y1 = oy + edge(arm.y + arm.h) * zoom;
  const length = (x1 - x0) / zoom, thickness = (y1 - y0) / zoom;
  context.strokeStyle = context.fillStyle = colors.annot; context.lineWidth = 1;
  context.font = `500 11px ${colors.mono}`; context.textBaseline = 'middle';
  const gap = Math.max(10, Math.round(zoom * .9)), tick = 4;
  const line = (ax, ay, bx, by) => {
    context.moveTo(Math.round(ax) + .5, Math.round(ay) + .5); context.lineTo(Math.round(bx) + .5, Math.round(by) + .5);
  };
  context.beginPath();
  if (x1 - x0 >= 14 && y1 + gap + 18 < height) {
    const y = y1 + gap;
    line(x0, y, x1, y); line(x0, y - tick, x0, y + tick); line(x1 - 1, y - tick, x1 - 1, y + tick);
    context.textAlign = 'left'; context.fillText(`${length} px`, x0, y + 12);
  }
  if (x1 + gap + 44 < width) {
    const x = x1 + gap;
    line(x, y0, x, y1 - 1); line(x - tick, y0, x + tick, y0); line(x - tick, y1 - 1, x + tick, y1 - 1);
    context.textAlign = 'left'; context.fillText(`${thickness} px`, x + 7, (y0 + y1) / 2);
  }
  context.stroke();
}

/** Largest integer magnification at which every mask fits comfortably on the canvas. */
export function fitZoom(canvas, geometries, settings) {
  const rect = canvas.getBoundingClientRect(), room = Math.max(40, Math.min(rect.width, rect.height || 150)) / 2 * .56;
  let extent = 1;
  for (const geometry of geometries) {
    if (!geometry) continue;
    const mask = geometry.data ? geometry : raster(geometry, settings), half = (mask.side - 1) / 2;
    for (let i = 0; i < mask.data.length; i++) {
      if (!mask.data[i]) continue;
      extent = Math.max(extent, Math.abs(i % mask.side - half) + .5, Math.abs(Math.floor(i / mask.side) - half) + .5);
    }
  }
  return Math.max(1, Math.min(40, Math.floor(room / extent)));
}

export function paintQuant(canvas, geometry, settings, color, zoom = 6, difference = null, options = {}) {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), colors = palette();
  const width = Math.max(80, rect.width), height = Math.max(100, rect.height || 150);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  const context = canvas.getContext('2d');
  context.scale(dpr, dpr); context.imageSmoothingEnabled = false;
  context.fillStyle = colors.plate; context.fillRect(0, 0, width, height);
  const reference = difference?.data ? difference : difference ? raster(difference, settings) : null;
  const mask = options.mask ?? raster(geometry, settings, reference?.side ?? 161);
  const ox = Math.floor(width / 2), oy = Math.floor(height / 2);
  if (options.grid && zoom >= 4) grid(context, width, height, ox, oy, zoom, colors);
  registration(context, width, height, ox, oy, zoom, colors);
  drawCells(context, mask, reference, width, height, zoom, color, colors);
  if (options.annotate && !reference && !options.mask) dimensions(context, geometry, settings, width, height, zoom, colors);
}
