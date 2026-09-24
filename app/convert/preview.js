import { raster } from '../../lib/geometry/raster.js';

function grid(context, width, height, ox, oy, zoom) {
  context.strokeStyle = '#25282b'; context.lineWidth = .5; context.beginPath();
  for (let x = ox % zoom; x < width; x += zoom) { context.moveTo(x, 0); context.lineTo(x, height); }
  for (let y = oy % zoom; y < height; y += zoom) { context.moveTo(0, y); context.lineTo(width, y); }
  context.stroke();
}

function drawCells(context, mask, reference, width, height, zoom, color) {
  const ox = Math.floor(width / 2), oy = Math.floor(height / 2), half = (mask.side - 1) / 2;
  const rgb = `rgb(${color.rgb.join(',')})`;
  context.globalAlpha = color.alpha / 255;
  for (let i = 0; i < mask.data.length; i++) {
    const a = mask.data[i], b = reference?.data[i];
    if (!(a || b)) continue;
    context.fillStyle = reference ? (a && b ? '#c8d0ca' : a ? '#d9ad75' : '#8baabd') : rgb;
    context.fillRect(ox + (i % mask.side - half) * zoom, oy + (Math.floor(i / mask.side) - half) * zoom, zoom, zoom);
  }
  context.globalAlpha = 1;
}

export function paintQuant(canvas, geometry, settings, color, zoom = 6, difference = null, options = {}) {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(80, rect.width), height = Math.max(100, rect.height || 150);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  const context = canvas.getContext('2d');
  context.scale(dpr, dpr); context.imageSmoothingEnabled = false;
  context.fillStyle = '#111416'; context.fillRect(0, 0, width, height);
  const reference = difference?.data ? difference : difference ? raster(difference, settings) : null;
  const mask = options.mask ?? raster(geometry, settings, reference?.side ?? 161);
  if (options.grid && zoom >= 4) grid(context, width, height, Math.floor(width / 2), Math.floor(height / 2), zoom);
  drawCells(context, mask, reference, width, height, zoom, color);
}
