// SkyStunt.io server: static client + health endpoint + authoritative WebSocket race rooms.
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { initPhysics } from '../shared/sim.js';
import { parseClientMessage } from '../shared/protocol.js';
import { MAX_INPUTS_PER_SEC, MAX_HUMANS_PER_ROOM, SNAPSHOT_HZ, PHYSICS_HZ } from '../shared/constants.js';
import { Room } from './room.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 40);
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS || 200);
const VERSION = '1.0.0';
const started = Date.now();
const rooms = new Map();
const socketsOpen = { n: 0 };

const log = (...a) => { if (process.env.SKYSTUNT_LOG !== '0') console.log(new Date().toISOString(), ...a); };

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

function healthPayload() {
  let humans = 0, racing = 0, connected = 0;
  for (const r of rooms.values()) { humans += r.members.size; connected += r.connectedCount; if (r.phase === 'racing') racing++; }
  return { ok: true, service: 'skystunt', version: VERSION, uptimeSec: Math.round((Date.now() - started) / 1000), rooms: rooms.size, racingRooms: racing, humans, connectedSockets: socketsOpen.n, physicsHz: PHYSICS_HZ, snapshotHz: SNAPSHOT_HZ, maxHumansPerRoom: MAX_HUMANS_PER_ROOM };
}

function serveStatic(req, res) {
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('SkyStunt.io server is running. The client has not been built yet: run "npm run build".');
    return;
  }
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(DIST, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  try {
    const body = readFileSync(file);
    const type = MIME[extname(file)] || 'application/octet-stream';
    const cache = file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'content-type': type, 'cache-control': cache, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}

const server = http.createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/healthz' || path === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(healthPayload()));
    return;
  }
  serveStatic(req, res);
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });

server.on('upgrade', (req, socket, head) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path !== '/ws') { socket.destroy(); return; }
  if (socketsOpen.n >= MAX_CONNECTIONS) { socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

function sendJson(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function findRoom(code) { return rooms.get(code); }

function newCode() {
  for (let i = 0; i < 50; i++) {
    const c = randomBytes(4).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 5).padEnd(5, 'X');
    if (!rooms.has(c)) return c;
  }
  return randomBytes(6).toString('hex').toUpperCase().slice(0, 6);
}

function quickPlay(msg) {
  let best = null;
  for (const r of rooms.values()) {
    if (!r.isPublic || r.phase !== 'lobby' || r.mode !== msg.mode) continue;
    if (r.members.size >= MAX_HUMANS_PER_ROOM) continue;
    if (!best || r.members.size > best.members.size) best = r;
  }
  if (best) return best;
  if (rooms.size >= MAX_ROOMS) return null;
  const r = new Room({ code: newCode(), mode: msg.mode, track: msg.track, isPublic: true, log });
  rooms.set(r.code, r);
  return r;
}

wss.on('connection', (ws) => {
  socketsOpen.n++;
  const conn = { ws, token: '', room: null, count: 0, windowStart: Date.now(), inputCount: 0 };
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', () => {});

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    const now = Date.now();
    if (now - conn.windowStart >= 1000) { conn.windowStart = now; conn.count = 0; conn.inputCount = 0; }
    conn.count++;
    if (conn.count > 150) { ws.close(1008, 'rate limit'); return; }
    const msg = parseClientMessage(data.toString());
    if (!msg) { sendJson(ws, { t: 'error', msg: 'Invalid message' }); return; }

    if (msg.t === 'ping') { sendJson(ws, { t: 'pong', ts: msg.ts, serverTime: now }); return; }

    if (msg.t === 'join') {
      if (conn.room) return;
      const token = msg.token && /^[A-Za-z0-9_-]{16,40}$/.test(msg.token) ? msg.token : randomUUID().replace(/-/g, '');
      let room = null;
      if (msg.code) {
        room = findRoom(msg.code);
        if (!room) { sendJson(ws, { t: 'error', msg: `Room ${msg.code} was not found.` }); return; }
      } else if (msg.quick) {
        room = quickPlay(msg);
        if (!room) { sendJson(ws, { t: 'error', msg: 'The server is full. Try again in a moment.' }); return; }
      } else {
        if (rooms.size >= MAX_ROOMS) { sendJson(ws, { t: 'error', msg: 'The server is full. Try again in a moment.' }); return; }
        room = new Room({ code: newCode(), mode: msg.mode, track: msg.track, isPublic: msg.isPublic && !msg.create ? true : !msg.create, log });
        rooms.set(room.code, room);
      }
      const res = room.join(ws, msg, token);
      if (res.error) { sendJson(ws, { t: 'error', msg: res.error }); return; }
      conn.token = token;
      conn.room = room;
      sendJson(ws, { t: 'welcome', token, room: room.code, mode: room.mode, track: room.track, isPublic: room.isPublic, maxRacers: 8, reconnectGraceSec: 20 });
      room.broadcastLobby(Date.now());
      return;
    }

    if (!conn.room) { sendJson(ws, { t: 'error', msg: 'Join a room first.' }); return; }
    if (msg.t === 'input') {
      conn.inputCount++;
      if (conn.inputCount > MAX_INPUTS_PER_SEC) return; // drop excess inputs silently
      conn.room.input(conn.token, msg);
      return;
    }
    if (msg.t === 'start') {
      if (conn.room.forceStart(conn.token)) sendJson(ws, { t: 'notice', msg: 'Starting race…' });
      return;
    }
    if (msg.t === 'leave') {
      conn.room.leave(conn.token);
      if (conn.room.members.size === 0) conn.room.lastEmptyAt = Date.now();
      conn.room = null;
      return;
    }
  });

  ws.on('close', () => {
    socketsOpen.n--;
    if (conn.room) conn.room.detach(conn.token);
  });
});

// Heartbeats: drop dead sockets (no pong within two intervals).
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }
}, 15000).unref();

// Game loop: 60 Hz simulation ticks, snapshot broadcast at SNAPSHOT_HZ.
const TICK_MS = 1000 / PHYSICS_HZ;
const SNAP_EVERY = Math.round(PHYSICS_HZ / SNAPSHOT_HZ);
let tickCount = 0;
setInterval(() => {
  const now = Date.now();
  tickCount++;
  for (const [code, room] of rooms) {
    try {
      room.tick(now);
      const shouldSnap = tickCount % SNAP_EVERY === 0;
      room.broadcastState(now, shouldSnap);
    } catch (err) {
      log('room error', code, err && err.stack);
    }
    // Remove rooms with no humans for 60 s
    if (room.members.size === 0 && now - room.lastEmptyAt > 60000) {
      room.dispose();
      rooms.delete(code);
      log('closed room', code);
    }
  }
}, TICK_MS);

async function main() {
  await initPhysics();
  server.listen(PORT, HOST, () => {
    log(`SkyStunt.io server v${VERSION} listening on ${HOST}:${PORT} (ws path /ws, health /healthz)`);
  });
}

const shutdown = () => {
  log('shutting down');
  for (const ws of wss.clients) try { ws.close(1001, 'server restart'); } catch { /* ignore */ }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((e) => { console.error(e); process.exit(1); });
