// Node test for client-side prediction: a delayed-network harness with an authoritative server Sim
// and a CarPredictor. Checks that the predicted car tracks the server car when inputs arrive late.
// Usage: node tests/prediction.test.mjs
import { initPhysics, Sim } from '../shared/sim.js';
import { CarPredictor } from '../src/predict.js';

// Same index map as src/game.js (I). Keep in sync.
const I = { id: 0, x: 1, y: 2, z: 3, qx: 4, qy: 5, qz: 6, qw: 7, speed: 8, wheel: 9, susp: 10, contacts: 11, place: 12, lap: 13, cp: 14, score: 15, boost: 16, alive: 17, finished: 18, lives: 19, boosting: 20, steer: 21, name: 22, carId: 23, bot: 24, vx: 25, vy: 26, vz: 27, wx: 28, wy: 29, wz: 30, ack: 31, freeze: 32 };

await initPhysics();
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

function run({ track, carId, delaySteps, steps, seed }) {
  const server = new Sim({ trackId: track, mode: 'grandprix' });
  server.hazardBodies.length = 0;
  const sc = server.addCar({ id: 'p', name: 'P', carId, bot: false, grid: 0 });
  server.phase = 'racing'; server.countdown = 0; sc.freezeT = 0;
  const client = new CarPredictor({ trackId: track, modeId: 'grandprix', carId, id: 'p' });
  client.car.freezeT = 0;
  let rng = seed >>> 0;
  const rand = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296);
  const inputAt = (k) => {
    const th = k < 60 || rand() < 0.95 ? 1 : 0;           // mostly gas, sometimes lift
    const st = Math.sin(k / 37) * 0.8 + (rand() < 0.05 ? (rand() - 0.5) : 0);
    return { th, br: 0, st, hb: k % 240 > 200 && k % 240 < 215 ? 1 : 0, bo: k % 300 > 250 ? 1 : 0 };
  };
  const inFlight = [];       // inputs on the wire: {arrive, s, inp}
  const snapInFlight = [];   // snapshots on the wire: {arrive, car, ack}
  const serverPos = [];
  const clientPos = [];
  let maxErr = 0, sumErr = 0, n = 0;
  for (let k = 0; k < steps; k++) {
    // client: predict this step and send the input
    const inp = inputAt(k);
    const s = client.step(inp);
    clientPos.push(client.position());
    inFlight.push({ arrive: k + delaySteps, s, inp });
    // server: apply inputs that have arrived, then step
    while (inFlight.length && inFlight[0].arrive <= k) {
      const m = inFlight.shift();
      server.setInput('p', { ...m.inp, s: m.s });
      sc.input = { ...m.inp, s: m.s };
    }
    server.step(); server.events.length = 0;
    const pp = sc.body.translation();
    serverPos.push({ x: pp.x, y: pp.y, z: pp.z });
    // snapshot every 2 steps (30 Hz), delivered after the same one-way delay
    if (k % 2 === 0) {
      const snap = server.snapshot().cars.find((c) => c[I.id] === 'p');
      snapInFlight.push({ arrive: k + delaySteps, car: snap, ack: sc.input && sc.input.s ? sc.input.s : 0 });
    }
    while (snapInFlight.length && snapInFlight[0].arrive <= k) {
      const sn = snapInFlight.shift();
      client.reconcile(sn.car, sn.ack, I);
    }
  }
  // error: client position at step k vs server position at step k + delay (same input history)
  for (let k = 60; k + delaySteps < steps; k++) {
    const a = clientPos[k], b = serverPos[k + delaySteps];
    const e = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    maxErr = Math.max(maxErr, e); sumErr += e; n++;
  }
  return { maxErr, meanErr: n ? sumErr / n : 0, reconciles: client.reconciles, pending: client.pending.length };
}

{
  const r = run({ track: 'neon_skyline', carId: 'bolt', delaySteps: 0, steps: 480, seed: 7 });
  check('no network delay: predicted car matches server (neon, bolt)', r.maxErr < 0.25, `max ${r.maxErr.toFixed(3)} m, mean ${r.meanErr.toFixed(3)} m, reconciles ${r.reconciles}`);
}
{
  const r = run({ track: 'neon_skyline', carId: 'bolt', delaySteps: 9, steps: 480, seed: 7 });
  check('150 ms one-way delay: prediction stays within 0.5 m of server (neon, bolt)', r.maxErr < 0.5, `max ${r.maxErr.toFixed(3)} m, mean ${r.meanErr.toFixed(3)} m`);
}
{
  const r = run({ track: 'glacier_overpass', carId: 'titan', delaySteps: 9, steps: 480, seed: 11 });
  check('150 ms one-way delay: prediction stays within 0.5 m of server (glacier, titan)', r.maxErr < 0.5, `max ${r.maxErr.toFixed(3)} m, mean ${r.meanErr.toFixed(3)} m`);
}
{
  // Injected error: shift the predicted car 1 m sideways; reconciliation must pull it back to the server.
  const track = 'neon_skyline', carId = 'bolt';
  const server = new Sim({ trackId: track, mode: 'grandprix' });
  server.hazardBodies.length = 0;
  const sc = server.addCar({ id: 'p', name: 'P', carId, bot: false, grid: 0 });
  server.phase = 'racing'; server.countdown = 0; sc.freezeT = 0;
  const client = new CarPredictor({ trackId: track, modeId: 'grandprix', carId, id: 'p' });
  client.car.freezeT = 0;
  let seq = 0;
  for (let k = 0; k < 360; k++) {
    const inp = { th: 1, br: 0, st: k > 200 ? 0.3 : 0, hb: 0, bo: 0 };
    seq = client.step(inp).valueOf();
    server.setInput('p', { ...inp, s: seq }); sc.input = { ...inp, s: seq };
    server.step(); server.events.length = 0;
    if (k % 2 === 0) client.reconcile(server.snapshot().cars.find((c) => c[I.id] === 'p'), seq, I);
    if (k === 120) { const b = client.car.body, p = b.translation(); b.setTranslation({ x: p.x + 1, y: p.y, z: p.z }, true); }
  }
  const sp = sc.body.translation(), cp = client.position();
  const err = Math.hypot(sp.x - cp.x, sp.y - cp.y, sp.z - cp.z);
  check('injected 1 m error is corrected by reconciliation within 0.5 s', err < 0.1, `final error ${err.toFixed(3)} m`);
}
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
