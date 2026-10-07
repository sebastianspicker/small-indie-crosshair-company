// Generated preview backgrounds: small, deterministic compositions painted from colour palettes only (no images, no
// textures), scaled up by the canvas into a blurred scene. Scenes are named by type, never by map.

const hex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));

/** `palette`: sky (top, low; outdoor scenes only), wall, wall2, shade, ground, opening, plus optional panel and light.
 * `layout`: horizon (fraction of the height), skyFrac, ranges of buildings, crates and openings, lamps, panels. */
export const SCENES = Object.freeze([
  { id: 'desert', label: 'Desert sand & sky',
    palette: { sky: ['#a8c8de', '#d4e3ec'], wall: '#c9a874', wall2: '#b8925c', shade: '#8a6a45', ground: '#d8bf8f', opening: '#4a3a28' },
    layout: { horizon: .64, skyFrac: .55, buildings: [3, 5], crates: [1, 3], openings: [3, 6], lamps: 0, panels: 0 } },
  { id: 'stone', label: 'Sunlit stone',
    palette: { sky: ['#9fc3dc', '#cfe0ea'], wall: '#cfc7b6', wall2: '#b9b09c', shade: '#8c8473', ground: '#aaa391', opening: '#4d4a43' },
    layout: { horizon: .6, skyFrac: .55, buildings: [2, 4], crates: [1, 2], openings: [3, 5], lamps: 0, panels: 0 } },
  { id: 'terracotta', label: 'Terracotta & plaster',
    palette: { sky: ['#b7d0e0', '#e0e8ec'], wall: '#c27a58', wall2: '#d9b79a', shade: '#8e4f38', ground: '#b89a7c', opening: '#4a2e25' },
    layout: { horizon: .62, skyFrac: .6, buildings: [3, 5], crates: [1, 2], openings: [4, 7], lamps: 0, panels: 0 } },
  { id: 'industrial', label: 'Industrial grey-blue',
    palette: { wall: '#a7aeb1', wall2: '#6f7a82', shade: '#2c3338', ground: '#878e91', opening: '#2c3338', panel: '#3e5f7a',
      light: '#d6dcdf' },
    layout: { horizon: .66, skyFrac: 0, buildings: [0, 1], crates: [2, 4], openings: [2, 4], lamps: 3, panels: 3 } },
  { id: 'jungle', label: 'Jungle green',
    palette: { sky: ['#b5d3c4', '#d7e6dc'], wall: '#3f6b3a', wall2: '#2c4f2b', shade: '#1a3320', ground: '#6b6040', opening: '#16281a',
      light: '#a9c36a' },
    layout: { horizon: .66, skyFrac: .3, buildings: [4, 6], crates: [1, 2], openings: [1, 3], lamps: 2, panels: 0 } },
  { id: 'night', label: 'Dark interior',
    palette: { wall: '#1d2228', wall2: '#2e3640', shade: '#0f1216', ground: '#171b20', opening: '#07090b', light: '#7a5a32' },
    layout: { horizon: .66, skyFrac: 0, buildings: [0, 1], crates: [1, 3], openings: [2, 4], lamps: 2, panels: 2 } }]);
export const SCENE_IDS = Object.freeze(SCENES.map(scene => scene.id));

/** Tiny seeded PRNG (mulberry32): a function returning floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashString = text => [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** A w×h RGBA composition (alpha 255): sky, far wall and ground bands, seeded buildings, crates, doorways and lamps,
 * a light gradient with a little noise, then one soft pass so the result is already low-contrast at its own size. */
export function scenePixels(id, w = 32, h = 18, seed = 0) {
  const scene = SCENES.find(candidate => candidate.id === id);
  if (!scene) throw new RangeError(`Unknown scene: ${id}`);
  const { palette: p, layout: l } = scene, rng = mulberry32(hashString(id) ^ Math.imul(seed | 0, 0x9e3779b1));
  const int = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const colour = Object.fromEntries(Object.entries(p).filter(([key]) => key !== 'sky').map(([key, value]) => [key, hex(value)]));
  const sky = p.sky?.map(hex), horizon = Math.round(h * l.horizon), skyEnd = sky ? Math.round(horizon * l.skyFrac) : 0;
  const px = new Float32Array(w * h * 3);
  const put = (x, y, rgb) => { if (x >= 0 && x < w && y >= 0 && y < h) px.set(rgb, (y * w + x) * 3); };
  const rect = (x, y, rw, rh, rgb) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(x + i, y + j, rgb); };
  for (let y = 0; y < h; y++) {
    let row;
    if (y >= horizon) row = mix(colour.ground, colour.shade, .25 * (y - horizon) / Math.max(1, h - horizon));
    else if (y < skyEnd) row = mix(sky[0], sky[1], y / Math.max(1, skyEnd - 1));
    else row = sky ? mix(colour.wall2, sky[1], .4) : mix(colour.wall, colour.wall2, y / Math.max(1, horizon - 1));
    rect(0, y, w, 1, row);
  }
  for (let n = int(...l.buildings); n > 0; n--) {
    const bw = int(4, 9), bh = int(3, Math.max(3, horizon - skyEnd + 1)), x = int(-2, w - bw + 1), y = horizon + int(0, 1) - bh;
    const face = rng() < .5 ? colour.wall : colour.wall2;
    rect(x, y, bw, bh, face); rect(x + bw - 2, y, 2, bh, colour.shade); rect(x, y, bw - 2, 1, mix(face, [255, 255, 255], .18));
  }
  for (let n = int(...l.openings); n > 0; n--) {
    const x = int(0, w - 2), ow = int(1, 2), oh = int(2, 3), y = rng() < .4 ? horizon - oh : int(Math.max(0, skyEnd), horizon - oh - 1);
    rect(x, y, ow, oh, colour.opening);
  }
  for (let n = l.panels; n > 0; n--) rect(int(0, w - 5), int(1, horizon - 4), int(3, 5), int(3, 5), colour.panel ?? colour.wall2);
  for (let n = int(...l.crates); n > 0; n--) {
    const s = int(2, 3), x = int(0, w - s), y = int(horizon + 1, h - s);
    rect(x, y, s, s, colour.wall2); rect(x, y + s - 1, s, 1, colour.shade); rect(x + s - 1, y, 1, s, colour.shade);
  }
  const lamps = [];
  for (let n = 0; n < l.lamps; n++) lamps.push([int(2, w - 3), int(1, Math.max(1, horizon - 6))]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    let light = sky ? 1.06 - .12 * x / w : 1 - .35 * (Math.hypot((x - w / 2) / w, (y - h / 2) / h)) + .08;
    light += (rng() - .5) * .06;
    let rgb = px.subarray(i, i + 3).map(v => v * light);
    for (const [lx, ly] of lamps) rgb = mix(rgb, colour.light, .55 / (1 + Math.hypot(x - lx, (y - ly) * 1.5) ** 2 / 3));
    px.set(rgb, i);
  }
  for (const [x, y] of lamps) put(x, y, colour.light);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const at = (cx, cy) => ((Math.min(h - 1, Math.max(0, cy)) * w) + Math.min(w - 1, Math.max(0, cx))) * 3;
    for (let c = 0; c < 3; c++) {
      const near = (px[at(x - 1, y) + c] + px[at(x + 1, y) + c] + px[at(x, y - 1) + c] + px[at(x, y + 1) + c]) / 4;
      out[(y * w + x) * 4 + c] = Math.round(.5 * px[at(x, y) + c] + .5 * near);
    }
    out[(y * w + x) * 4 + 3] = 255;
  }
  return out;
}

/** Mean colour of a scene's default composition, as [r, g, b]; the CSS `--plate` of each scene is this value. */
export function sceneAverage(id) {
  const data = scenePixels(id), sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += data[i + c];
  return sum.map(v => Math.round(v / (data.length / 4)));
}

const cache = new Map();
/** The scene as a small offscreen canvas, built once per id; the plate canvas scales it up with smoothing (the blur). */
export function sceneImage(id, w = 32, h = 18) {
  if (cache.has(id)) return cache.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const context = canvas.getContext('2d'), image = context.createImageData(w, h);
  image.data.set(scenePixels(id, w, h));
  context.putImageData(image, 0, 0);
  cache.set(id, canvas);
  return canvas;
}
