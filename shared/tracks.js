// Track definitions + geometry generation.
// Every track is a closed Catmull-Rom spline through control points [x, z, height, bankDeg, width].
// Ramps add a smooth height rise before a gap; gaps remove road surface (cars must jump them).
// The same generated sample data drives the Rapier trimesh colliders (server + client)
// and the Three.js road meshes (client), so what you see is what collides.
import { SAMPLE_SPACING, TRACK_THICKNESS } from './constants.js';
import { clamp, lerp } from './math.js';

const cr = (p0, p1, p2, p3, u) => {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
};

export const TRACKS = {
  neon_skyline: {
    id: 'neon_skyline',
    name: 'Neon Skyline',
    tagline: 'Elevated neon highways, tight city hairpins and bridge jumps',
    difficulty: 'Medium',
    friction: 1.0,
    killY: -12,
    groundY: -1,
    checkpoints: 8,
    laps: 3,
    theme: { sky: 0x070818, fog: 0x0b0d2a, ground: 0x0c0f24, road: 0x1d2140, edge: 0xff2bd6, accent: 0x00e5ff, ambient: 0x8888ff, sun: 0xff77dd },
    points: [
      [0, 0, 0, 0, 15], [0, 120, 0, 0, 15], [70, 200, 0, -6, 14], [170, 230, 4, -8, 14],
      [260, 200, 8, 0, 14], [280, 120, 10, 0, 14], [250, 40, 14, 0, 13], [170, 10, 18, 8, 13],
      [90, 40, 16, 0, 13], [70, 110, 8, 0, 13], [-10, 130, 4, 0, 13], [-60, 60, 2, 0, 15], [-30, -30, 0, 0, 15],
    ],
    ramps: [{ t0: 1.62, t1: 1.82, rise: 3.5 }, { t0: 7.3, t1: 7.48, rise: 3.0 }],
    gaps: [{ id: 'n-gap-1', t0: 1.82, t1: 2.02 }, { id: 'n-gap-2', t0: 7.48, t1: 7.68 }],
    hazards: [{ type: 'bar', t: 4.5, amp: 4.5, period: 4.2, size: [7, 1.4, 1.2] }, { type: 'bar', t: 10.5, amp: 4, period: 3.1, size: [7, 1.4, 1.2] }],
    wind: [],
    bumps: 0,
    scenery: 'neon',
  },
  canyon_skyway: {
    id: 'canyon_skyway',
    name: 'Canyon Skyway',
    tagline: 'Giant cliffs, banked switchbacks, long jumps and crosswind gusts',
    difficulty: 'Hard',
    friction: 1.0,
    killY: -40,
    groundY: -30,
    checkpoints: 8,
    laps: 2,
    theme: { sky: 0x3b1d0f, fog: 0xc86b3c, ground: 0x4a2a1a, road: 0x6b5241, edge: 0xffb347, accent: 0xffe08a, ambient: 0xffb08a, sun: 0xffd29a },
    points: [
      [0, 0, 22, 0, 15], [-40, 180, 24, 10, 14], [-10, 340, 28, 10, 14], [150, 420, 34, 10, 14],
      [300, 380, 40, -10, 13], [360, 260, 44, -10, 13], [300, 150, 40, 0, 13], [380, 40, 30, 0, 13],
      [330, -80, 22, 8, 14], [190, -120, 18, 10, 14], [80, -60, 14, 0, 15],
    ],
    ramps: [{ t0: 1.7, t1: 1.92, rise: 7 }, { t0: 5.5, t1: 5.7, rise: 6 }],
    gaps: [{ id: 'c-gap-1', t0: 1.92, t1: 2.1 }, { id: 'c-gap-2', t0: 5.7, t1: 5.9 }],
    hazards: [],
    wind: [{ t0: 3.0, t1: 4.5, force: 4200 }, { t0: 8.0, t1: 9.4, force: -4200 }],
    bumps: 0,
    scenery: 'canyon',
  },
  volcanic_ruins: {
    id: 'volcanic_ruins',
    name: 'Volcanic Ruins',
    tagline: 'Uneven lava-fields, spinning hazards and crumbling jumps',
    difficulty: 'Medium',
    friction: 0.95,
    killY: -10,
    groundY: -6,
    checkpoints: 8,
    laps: 3,
    theme: { sky: 0x1a0505, fog: 0x3a0d05, ground: 0x2a0d05, road: 0x3a2b26, edge: 0xff5a1f, accent: 0xffb000, ambient: 0xff9a6a, sun: 0xff6a2a },
    points: [
      [0, 0, 1, 0, 14], [-120, 60, 3, 0, 14], [-220, 160, 5, -6, 14], [-180, 270, 4, -10, 13],
      [-60, 300, 2, 0, 13], [40, 230, 1, 6, 13], [120, 150, 2, 0, 13], [230, 120, 3, 0, 13],
      [290, 30, 2, 0, 13], [240, -70, 1, 0, 14], [120, -100, 0, 0, 14], [30, -60, 1, 0, 14],
    ],
    ramps: [{ t0: 2.6, t1: 2.78, rise: 4 }, { t0: 6.6, t1: 6.78, rise: 4 }],
    gaps: [{ id: 'v-gap-1', t0: 2.78, t1: 3.1 }, { id: 'v-gap-2', t0: 6.78, t1: 7.1 }],
    hazards: [{ type: 'spin', t: 0.45, size: [13, 1.2, 1.4], speed: 1.4 }, { type: 'spin', t: 9.5, size: [12, 1.2, 1.4], speed: -1.1 }, { type: 'bar', t: 5.3, amp: 7, period: 3.6, size: [8, 1.2, 1.2] }],
    wind: [],
    bumps: 0.55,
    scenery: 'volcanic',
  },
  glacier_overpass: {
    id: 'glacier_overpass',
    name: 'Glacier Overpass',
    tagline: 'Icy high-altitude bridges, sharp corners and low traction',
    difficulty: 'Hard',
    friction: 0.55,
    killY: -20,
    groundY: -14,
    checkpoints: 8,
    laps: 3,
    theme: { sky: 0x0a1a2e, fog: 0x9cc9ea, ground: 0x7fb6d9, road: 0xd6eefc, edge: 0x7af0ff, accent: 0xffffff, ambient: 0xbfe6ff, sun: 0xe6f7ff },
    points: [
      [0, 0, 6, 0, 13], [0, 110, 14, 0, 13], [-50, 170, 24, -10, 12], [-120, 180, 30, -10, 12],
      [-140, 110, 32, 0, 12], [-80, 60, 28, 10, 12], [30, 80, 24, 0, 12], [100, 140, 26, 0, 12],
      [160, 110, 30, -10, 12], [200, 30, 22, -10, 13], [150, -40, 12, 0, 13], [60, -60, 8, 0, 13],
    ],
    ramps: [{ t0: 2.6, t1: 2.78, rise: 3.2 }, { t0: 7.6, t1: 7.78, rise: 3.2 }],
    gaps: [{ id: 'g-gap-1', t0: 2.78, t1: 3.1 }, { id: 'g-gap-2', t0: 7.78, t1: 8.1 }],
    hazards: [{ type: 'bar', t: 5.0, amp: 6, period: 3.4, size: [8, 1.2, 1.2] }],
    wind: [{ t0: 9.4, t1: 10.2, force: 2600 }],
    bumps: 0,
    scenery: 'glacier',
  },
};

export const TRACK_IDS = Object.keys(TRACKS);

// Height bump used for the volcanic track (uneven surface).
function heightAt(def, t, base) {
  let h = base;
  for (const r of def.ramps || []) {
    if (t > r.t0 && t <= r.t1) {
      const u = (t - r.t0) / (r.t1 - r.t0);
      h += r.rise * u * u;
    } else if (t > r.t1 && t < r.t1 + 0.9) {
      // the lift decays after the lip so the loop stays continuous and the landing is a gentle drop
      h += r.rise * (1 - (t - r.t1) / 0.9);
    }
  }
  if (def.bumps) h += def.bumps * Math.sin(t * 2.3) * 0.9 + def.bumps * 0.4 * Math.sin(t * 5.1);
  return h;
}

/** Build the full track: samples, collision geometry and metadata. Pure function, deterministic. */
export function buildTrack(id) {
  const def = TRACKS[id];
  if (!def) throw new Error('unknown track ' + id);
  const P = def.points;
  const n = P.length;
  const at = (i) => P[((i % n) + n) % n];

  // Dense spline sampling (keeps the parameter t for gap / hazard placement).
  const dense = [];
  const STEPS = 60;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < STEPS; k++) {
      const u = k / STEPS;
      const x = cr(p0[0], p1[0], p2[0], p3[0], u);
      const z = cr(p0[1], p1[1], p2[1], p3[1], u);
      const hb = cr(p0[2], p1[2], p2[2], p3[2], u);
      const bank = cr(p0[3], p1[3], p2[3], p3[3], u);
      const w = cr(p0[4], p1[4], p2[4], p3[4], u);
      dense.push({ t: i + u, x, z, base: hb, bank, w });
    }
  }
  // Base elevation is smoothed so crests are not sharp enough to launch cars off the road;
  // ramps and bumps are added afterwards so they keep their exact shape.
  const baseS = dense.map((d) => d.base);
  const SIG = 40; // dense samples (~ 1/60 of a control segment each)
  const smoothBase = baseS.map((_, i) => {
    let acc = 0, wsum = 0;
    for (let o = -2 * SIG; o <= 2 * SIG; o++) {
      const w = Math.exp(-(o * o) / (2 * SIG * SIG));
      const j = (i + o + baseS.length * 4) % baseS.length;
      acc += baseS[j] * w; wsum += w;
    }
    return acc / wsum;
  });
  for (let i = 0; i < dense.length; i++) dense[i].base = smoothBase[i];
  for (const d of dense) d.y = d.base + heightAt(def, d.t, 0);

  // Arc length (3D)
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    cum.push(cum[i - 1] + Math.hypot(dx, dy, dz));
  }
  const total = cum[cum.length - 1];
  const S = Math.round(total / SAMPLE_SPACING);
  const step = total / S;

  // Resample evenly by arc length.
  const samples = [];
  let j = 0;
  for (let k = 0; k < S; k++) {
    const target = k * step;
    while (j < dense.length && cum[j + 1] < target) j++;
    const a = dense[j % dense.length], b = dense[(j + 1) % dense.length];
    const seg = cum[j + 1] - cum[j] || 1;
    const u = clamp((target - cum[j]) / seg, 0, 1);
    samples.push({
      t: lerp(a.t, b.t > a.t ? b.t : b.t + n, u) % n,
      x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u),
      bank: lerp(a.bank, b.bank, u) * Math.PI / 180, w: lerp(a.w, b.w, u),
    });
  }

  // Gap flags
  const gapOf = (t) => {
    for (const g of def.gaps) {
      if (t > g.t0 && t < g.t1) return g;
    }
    return null;
  };

  // Frame per sample: forward T, right R (banked), up U.
  const N = S;
  const arr = {
    x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N),
    tx: new Float32Array(N), ty: new Float32Array(N), tz: new Float32Array(N),
    rx: new Float32Array(N), ry: new Float32Array(N), rz: new Float32Array(N),
    ux: new Float32Array(N), uy: new Float32Array(N), uz: new Float32Array(N),
    w: new Float32Array(N), gap: new Uint8Array(N), gapId: new Array(N).fill(null), t: new Float32Array(N), s: new Float32Array(N),
  };
  for (let k = 0; k < N; k++) {
    const a = samples[(k - 1 + N) % N], b = samples[(k + 1) % N], c = samples[k];
    let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
    let tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    // right = normalize(cross(worldUp, T)); cross((0,1,0), T) = (tz, 0, -tx)
    let rx = tz, ry = 0, rz = -tx;
    let rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    // Bank: rotate right around T
    const cb = Math.cos(c.bank), sb = Math.sin(c.bank);
    // up0 = cross(T, R)
    let ux0 = ty * rz - tz * ry, uy0 = tz * rx - tx * rz, uz0 = tx * ry - ty * rx;
    let r2x = rx * cb + ux0 * sb, r2y = ry * cb + uy0 * sb, r2z = rz * cb + uz0 * sb;
    let u2x = ty * r2z - tz * r2y, u2y = tz * r2x - tx * r2z, u2z = tx * r2y - ty * r2x;
    arr.x[k] = c.x; arr.y[k] = c.y; arr.z[k] = c.z;
    arr.tx[k] = tx; arr.ty[k] = ty; arr.tz[k] = tz;
    arr.rx[k] = r2x; arr.ry[k] = r2y; arr.rz[k] = r2z;
    arr.ux[k] = u2x; arr.uy[k] = u2y; arr.uz[k] = u2z;
    arr.w[k] = c.w; arr.t[k] = c.t; arr.s[k] = k * step;
    const g = gapOf(c.t);
    arr.gap[k] = g ? 1 : 0;
    arr.gapId[k] = g ? g.id : null;
  }

  // Road geometry: 4 verts per sample (Ltop, Rtop, Lbot, Rbot). Gap samples emit no faces.
  const vcount = N * 4;
  const verts = new Float32Array(vcount * 3);
  const setV = (idx, x, y, z) => { verts[idx * 3] = x; verts[idx * 3 + 1] = y; verts[idx * 3 + 2] = z; };
  for (let k = 0; k < N; k++) {
    const hw = arr.w[k] / 2;
    const cx = arr.x[k], cy = arr.y[k], cz = arr.z[k];
    const rx = arr.rx[k], ry = arr.ry[k], rz = arr.rz[k];
    const ux = arr.ux[k], uy = arr.uy[k], uz = arr.uz[k];
    setV(k * 4 + 0, cx - rx * hw, cy - ry * hw, cz - rz * hw);
    setV(k * 4 + 1, cx + rx * hw, cy + ry * hw, cz + rz * hw);
    setV(k * 4 + 2, cx - rx * hw - ux * TRACK_THICKNESS, cy - ry * hw - uy * TRACK_THICKNESS, cz - rz * hw - uz * TRACK_THICKNESS);
    setV(k * 4 + 3, cx + rx * hw - ux * TRACK_THICKNESS, cy + ry * hw - uy * TRACK_THICKNESS, cz + rz * hw - uz * TRACK_THICKNESS);
  }
  const idx = [];
  const quad = (a, b, c, d) => { idx.push(a, b, c, a, c, d); };
  for (let k = 0; k < N; k++) {
    const m = (k + 1) % N;
    if (arr.gap[k] || arr.gap[m]) continue;
    const A = k * 4, B = m * 4;
    quad(A + 0, A + 1, B + 1, B + 0); // top
    quad(A + 2, B + 2, B + 3, A + 3); // bottom
    quad(A + 0, B + 0, B + 2, A + 2); // left side
    quad(A + 1, A + 3, B + 3, B + 1); // right side
  }
  const trimeshIdx = new Uint32Array(idx);

  // Checkpoints: sample indices, moved off gaps.
  const cps = [];
  for (let j = 0; j < def.checkpoints; j++) {
    let k = Math.floor((j * N) / def.checkpoints);
    let guard = 0;
    while (arr.gap[k] && guard++ < 200) k = (k + 1) % N;
    cps.push(k);
  }

  // Grid: behind the line.
  const grid = [];
  for (let g = 0; g < 16; g++) {
    let k = (N - 6 - g * 4 + N * 4) % N;
    let guard = 0;
    while (arr.gap[k] && guard++ < 100) k = (k - 1 + N) % N;
    grid.push(k);
  }

  // Pillars under elevated road (visual + collider) every ~24 m
  // A pillar must never stand on another part of the road (tracks can cross over themselves).
  const blockedBelow = (k, top) => {
    for (let j = 0; j < N; j++) {
      let dk = Math.abs(j - k); dk = Math.min(dk, N - dk);
      if (dk < 60) continue;
      if (arr.y[j] > top - 1) continue;
      const dx = arr.x[j] - arr.x[k], dz = arr.z[j] - arr.z[k];
      if (dx * dx + dz * dz < 9 * 9) return true;
    }
    return false;
  };
  const pillars = [];
  for (let k = 0; k < N; k += 12) {
    if (arr.gap[k]) continue;
    const h = arr.y[k] - def.groundY;
    if (arr.y[k] > 3.5) {
      const top = arr.y[k] - TRACK_THICKNESS - 0.3;
      if (blockedBelow(k, top)) continue;
      pillars.push({ x: arr.x[k], z: arr.z[k], top, bottom: def.groundY - 1, h });
    }
  }

  return {
    def,
    id,
    N,
    length: total,
    step,
    ...arr,
    verts,
    trimeshIdx,
    checkpoints: cps,
    grid,
    pillars,
    gaps: def.gaps,
    hazards: def.hazards,
    wind: def.wind,
    ramps: def.ramps,
    friction: def.friction,
    killY: def.killY,
    groundY: def.groundY,
    laps: def.laps,
  };
}

// Cache built tracks per process (deterministic, so safe to share).
const cache = new Map();
export function getTrack(id) {
  if (!cache.has(id)) cache.set(id, buildTrack(id));
  return cache.get(id);
}
