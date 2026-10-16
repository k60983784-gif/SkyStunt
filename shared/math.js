// Small numeric helpers shared by client, server and tests.
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrapSigned = (v, n) => {
  // map v into (-n/2, n/2]
  let r = ((v % n) + n) % n;
  if (r > n / 2) r -= n;
  return r;
};
export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
export const DEG = Math.PI / 180;
