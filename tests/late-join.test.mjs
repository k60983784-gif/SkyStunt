// Protocol test: a human joins a RACING public room via Quick Play and takes over an AI car. Usage: node tests/late-join.test.mjs ws://localhost:8080/ws
import WebSocket from 'ws';
const URL = process.argv[2] || 'ws://localhost:8080/ws';
const open = (name, quick, code) => new Promise((res) => {
  const ws = new WebSocket(URL);
  const out = { name, room: null, states: [], lobbyPhase: null, lastState: null };
  ws.on('open', () => ws.send(JSON.stringify(Object.assign({ t: 'join', name, car: 'bolt', mode: 'grandprix', track: 'neon_skyline', isPublic: true }, quick ? { quick: true } : { code }))));
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.t === 'welcome') { out.room = m.room; out.carId = 'h' + m.token.slice(0, 8); }
    if (m.t === 'error') out.error = m.msg;
    if (m.t === 'state') out.lastState = m;
  });
  setTimeout(() => res({ ws, out }), 1200);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Wait until A's room is racing (state arrives).
const a = await open('A', true);
let racing = false;
for (let i = 0; i < 60 && !racing; i++) { await sleep(500); racing = a.out.lastState?.phase === 'racing'; }
const before = a.out.lastState ? a.out.lastState.cars.length : 0;
const b = await open('B', true);
await sleep(1500);
const s = b.out.lastState;
const humanB = s?.cars?.find((c) => c[0].startsWith('h') && c[0].length === 9 && c[0] !== a.out.lastState?.cars?.find((x) => x[0].startsWith('h'))?.[0]);
const humans = s ? s.cars.filter((c) => c[0].startsWith('h')).map((c) => c[0]) : [];
const bots = s ? s.cars.filter((c) => c[0].startsWith('bot')).length : null;
const result = {
  racingBeforeJoin: racing, sameRoom: a.out.room === b.out.room, room: a.out.room,
  joinerError: b.out.error || null, joinerCarId: b.out.carId, joinerCarIsHuman: !!s?.cars?.find((c) => c[0] === b.out.carId), carsInState: before, carsAfter: s?.cars?.length ?? null,
  humanCarIds: humans, botCarsAfter: bots, joinerSeesHumanCar: humans.length >= 2,
  joinerTakeover: !!s?.cars?.find((c) => c[0] === b.out.carId),
};
console.log(JSON.stringify(result));
a.ws.close(); b.ws.close();
process.exit(result.racingBeforeJoin && result.sameRoom && result.joinerTakeover && !result.joinerError ? 0 : 1);
