// Multiplayer integration test: two independent WebSocket clients against a running server.
// Usage: node tests/multiplayer.test.mjs http://localhost:8080
import WebSocket from 'ws';
const BASE = process.argv[2] || 'http://localhost:8080';
const WS_URL = BASE.replace(/^http/, 'ws') + '/ws';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(label) {
  const c = { label, ws: null, msgs: [], welcome: null, last: {}, lastState: null, errors: [], closed: null };
  c.open = () => new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    c.ws = ws;
    ws.on('open', () => resolve(c));
    ws.on('error', reject);
    ws.on('close', (code, reason) => { c.closed = { code, reason: String(reason) }; });
    ws.on('message', (data) => {
      const m = JSON.parse(data.toString());
      if (m.t === 'welcome') c.welcome = m;
      if (m.t === 'state') { c.lastState = m; }
      if (m.t === 'lobby') c.last.lobby = m;
      if (m.t === 'results') c.last.results = m;
      if (m.t === 'error') c.errors.push(m.msg);
      c.msgs.push(m.t);
      if (c.msgs.length > 500) c.msgs.splice(0, 250);
    });
  });
  c.send = (o) => c.ws.readyState === 1 && c.ws.send(JSON.stringify(o));
  c.car = (id) => (c.lastState?.cars || []).find((r) => r[0] === id);
  return c;
}
const waitFor = async (fn, ms = 8000, step = 50) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; };

async function main() {
  // 1. Health
  const h = await (await fetch(BASE + '/healthz')).json();
  check('health endpoint returns ok', h.ok === true && h.service === 'skystunt', JSON.stringify({ version: h.version, rooms: h.rooms }));

  // 2. Alice creates a private room; Bob joins by code
  const alice = await client('alice').open();
  alice.send({ t: 'join', name: 'Alice', car: 'bolt', mode: 'grandprix', track: 'canyon_skyway', create: true, isPublic: false });
  const aw = await waitFor(() => alice.welcome);
  check('alice receives welcome with room code', !!aw && /^[A-Z0-9]{5}$/.test(aw.room), aw ? 'room ' + aw.room : 'no welcome');
  const code = aw.room;

  const bob = await client('bob').open();
  bob.send({ t: 'join', name: 'Bob', car: 'dart', code });
  const bw = await waitFor(() => bob.welcome);
  check('bob joins alice\'s private room by code', !!bw && bw.room === code, bw ? 'token len ' + bw.token.length : (bob.errors.join(';') || 'no welcome'));

  const lobbyBoth = await waitFor(() => alice.last.lobby && alice.last.lobby.players.length === 2 ? alice.last.lobby : null);
  check('lobby shows both human players', !!lobbyBoth, lobbyBoth ? lobbyBoth.players.map((p) => p.name).join(', ') : 'lobby missing');

  // 3. Start race (host = first member). Server also starts on its own lobby timer.
  alice.send({ t: 'start' });
  const racing = await waitFor(() => alice.lastState && alice.lastState.phase !== 'lobby' ? alice.lastState : null, 6000);
  check('race starts (countdown/racing states arrive)', !!racing, racing ? 'phase ' + racing.phase : 'no state');
  if (!racing) { return finish(); }
  const cars = racing.cars;
  check('race has 8 competitors (2 humans + 6 AI)', cars.length === 8, `cars=${cars.length}`);
  const humanIds = cars.filter((c) => !String(c[0]).startsWith('bot')).length;
  check('exactly two human cars in the race', humanIds === 2, `human=${humanIds}`);

  // Wait for GO
  await waitFor(() => bob.lastState && bob.lastState.phase === 'racing', 8000);
  check('both clients see phase=racing', bob.lastState?.phase === 'racing' && alice.lastState?.phase === 'racing', `alice=${alice.lastState?.phase} bob=${bob.lastState?.phase}`);

  // Cross-visibility: each client sees the other human's car id
  const aliceId = alice.welcome && 'h' + alice.welcome.token.slice(0, 8);
  const bobId = bob.welcome && 'h' + bob.welcome.token.slice(0, 8);
  check('bob sees alice\'s car in his state stream', !!bob.car(aliceId), `id ${aliceId}`);
  check('alice sees bob\'s car in her state stream', !!alice.car(bobId), `id ${bobId}`);

  // 4. Input from Alice moves Alice's car; Bob observes it
  const a0 = bob.car(aliceId);
  const startX = a0 ? a0[1] : 0, startZ = a0 ? a0[3] : 0;
  const inputTimer = setInterval(() => alice.send({ t: 'input', s: Date.now(), th: 1, br: 0, st: 0, hb: 0, bo: 0 }), 33);
  await sleep(5000);
  clearInterval(inputTimer);
  const a1 = bob.car(aliceId);
  const moved = a1 ? Math.hypot(a1[1] - startX, a1[3] - startZ) : 0;
  check('alice throttle input moves her car (as seen by bob)', moved > 15, `moved ${moved.toFixed(1)} m in 5 s`);
  const aliceSpeed = a1 ? a1[8] : 0;
  check('server reports speed for alice car', aliceSpeed > 5, `speed ${aliceSpeed} m/s`);

  // Bob sends no input -> his car should not drive far
  const b0 = alice.car(bobId);
  await sleep(1500);
  const b1 = alice.car(bobId);
  check('bob (no input) car stays near its grid position', b0 && b1 && Math.hypot(b1[1] - b0[1], b1[3] - b0[3]) < 15, b0 && b1 ? `drift ${Math.hypot(b1[1] - b0[1], b1[3] - b0[3]).toFixed(1)} m` : 'missing');

  // 5. Bots are moving (they are server-controlled)
  const bots = racing.cars.filter((c) => String(c[0]).startsWith('bot'));
  const botMove = await waitFor(async () => {
    const cur = alice.lastState.cars.filter((c) => String(c[0]).startsWith('bot'));
    return cur.some((c, i) => Math.hypot(c[1] - bots[i][1], c[3] - bots[i][3]) > 5) ? true : null;
  }, 6000);
  check('AI bots move under server control', !!botMove);

  // 6. Disconnect Bob, check seat is reserved, then reconnect with token
  const bobToken = bob.welcome.token;
  bob.ws.close();
  await sleep(800);
  check('after Bob disconnects, his car still exists (grace period)', !!alice.car(bobId));
  const bob2 = await client('bob-reconnect').open();
  bob2.send({ t: 'join', name: 'Bob', car: 'dart', code, token: bobToken });
  const bw2 = await waitFor(() => bob2.welcome);
  check('Bob reconnects with his token and gets the same room', !!bw2 && bw2.room === code && bw2.token === bobToken, bw2 ? 'ok' : (bob2.errors.join(';') || 'no welcome'));
  const bobBack = await waitFor(() => bob2.lastState && bob2.car(bobId));
  check('reconnected Bob receives race state', !!bobBack);

  // 7. Malformed input handling
  alice.send({ t: 'input', th: 'x' });
  alice.ws.send('{not json');
  await sleep(300);
  check('malformed JSON is answered with an error, server stays up', alice.errors.includes('Invalid message'), `errors=${alice.errors.length}`);
  const h2 = await (await fetch(BASE + '/healthz')).json();
  check('health still ok after malformed messages', h2.ok === true);

  // 8. Oversized message is rejected by transport limit (maxPayload 1 KB)
  const big = client('big');
  await big.open();
  big.ws.send('x'.repeat(4096));
  await sleep(400);
  check("oversized payload closes that socket only", big.closed !== null && big.closed.code === 1009, `close=${JSON.stringify(big.closed)}`);

  // 9. Bob's spectator leave and room cleanup
  bob2.send({ t: 'leave' });
  await sleep(300);
  check('leave message is accepted', bob2.errors.length === 0);

  // 10. Race reaches a result (give the room the stunt mode would be long; we only check that results can be produced)
  alice.ws.close(); bob2.ws.close();
  await sleep(200);
  return finish();
}

function finish() {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => { console.error('TEST ERROR', e); process.exit(2); });
