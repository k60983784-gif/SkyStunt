// Network protocol constants and message validation (used by the server and the client).
import { MAX_MSG_BYTES } from './constants.js';
import { CARS } from './cars.js';
import { TRACKS } from './tracks.js';
import { MODES } from './constants.js';

export const CLIENT_TYPES = new Set(['join', 'input', 'start', 'leave', 'ping']);

const clampNum = (v, lo, hi, dflt = 0) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dflt;
  return Math.min(hi, Math.max(lo, n));
};

/** Parses and validates a raw client message. Returns null when invalid. */
export function parseClientMessage(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_MSG_BYTES) return null;
  let m;
  try { m = JSON.parse(raw); } catch { return null; }
  if (!m || typeof m !== 'object' || !CLIENT_TYPES.has(m.t)) return null;
  switch (m.t) {
    case 'join': {
      const name = String(m.name ?? 'Racer').replace(/[^\w \-.]/g, '').trim().slice(0, 16) || 'Racer';
      return {
        t: 'join', name,
        car: CARS[m.car] ? m.car : 'bolt',
        mode: MODES[m.mode] ? m.mode : 'grandprix',
        track: TRACKS[m.track] ? m.track : 'neon_skyline',
        code: typeof m.code === 'string' ? m.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : '',
        quick: !!m.quick, create: !!m.create, isPublic: m.isPublic !== false,
        token: typeof m.token === 'string' ? m.token.slice(0, 40) : '',
      };
    }
    case 'input':
      return {
        t: 'input', s: Math.floor(clampNum(m.s, 0, 1e9)),
        th: clampNum(m.th, 0, 1), br: clampNum(m.br, 0, 1), st: clampNum(m.st, -1, 1),
        hb: m.hb ? 1 : 0, bo: m.bo ? 1 : 0,
      };
    case 'ping': return { t: 'ping', ts: clampNum(m.ts, 0, 1e15) };
    default: return { t: m.t };
  }
}
