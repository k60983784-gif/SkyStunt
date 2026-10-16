// Headless physics + rules tests (Node). Usage: node tests/sim.test.mjs
import { initPhysics, Sim, rot } from '../shared/sim.js';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const idle = { th: 0, br: 0, st: 0, hb: 0, bo: 0 };
await initPhysics();

function flatSim(track = 'neon_skyline') {
  const sim = new Sim({ trackId: track, mode: 'grandprix' });
  sim.hazardBodies.length = 0;
  const car = sim.addCar({ id: 'p', name: 'P', carId: 'bolt', bot: false, grid: 0 });
  for (let i = 0; i < 200; i++) { car.input = idle; sim.step(); }
  sim.phase = 'racing'; sim.countdown = 0; car.freezeT = 0;
  return { sim, car };
}
const fwdSpeed = (c) => { const v = c.body.linvel(); const f = rot(c.body.rotation(), [0, 0, 1]); return v.x * f[0] + v.y * f[1] + v.z * f[2]; };
const yawRate = (c) => c.body.angvel().y;

{ // acceleration
  const { sim, car } = flatSim();
  for (let i = 0; i < 180; i++) { car.input = { th: 1, br: 0, st: 0, hb: 0, bo: 0 }; sim.step(); }
  check('throttle accelerates the car forward', fwdSpeed(car) > 8, `speed ${fwdSpeed(car).toFixed(1)} m/s after 3 s`);
  for (let i = 0; i < 120; i++) { car.input = { th: 0, br: 1, st: 0, hb: 0, bo: 0 }; sim.step(); }
  check('brake reduces speed', fwdSpeed(car) < 8, `speed ${fwdSpeed(car).toFixed(1)} m/s after 2 s braking`);
}
{ // steering: st=+1 is a right turn (positive yaw about +Y)
  const { sim, car } = flatSim();
  for (let i = 0; i < 150; i++) { car.input = { th: 1, br: 0, st: 0, hb: 0, bo: 0 }; sim.step(); }
  let maxYaw = 0;
  for (let i = 0; i < 60; i++) { car.input = { th: 1, br: 0, st: 1, hb: 0, bo: 0 }; sim.step(); maxYaw = Math.max(maxYaw, yawRate(car)); }
  check('steer right produces positive yaw (right turn)', maxYaw > 0.2, `peak yaw rate ${maxYaw.toFixed(2)} rad/s`);
}
{ // ramp: airborne trajectory exists at the neon ramp
  const sim = new Sim({ trackId: 'neon_skyline', mode: 'grandprix' });
  sim.hazardBodies.length = 0;
  const car = sim.addCar({ id: 'p', name: 'P', carId: 'bolt', bot: true, skill: 0.9, wobble: 0.5, seed: 1, grid: 0 });
  let airborne = false, maxY = -1e9, startY = null;
  for (let i = 0; i < 60 * 40; i++) {
    sim.step();
    if (car.contacts === 0 && sim.raceTime > 5) airborne = true;
  }
  check('bot drives over ramps and gets airborne (contacts=0 observed)', airborne);
}
{ // falling off the track triggers respawn
  const { sim, car } = flatSim();
  car.body.setTranslation({ x: 0, y: -50, z: 0 }, true);
  for (let i = 0; i < 4; i++) { car.input = idle; sim.step(); }
  const reasons = sim.events.filter((e) => e.k === 'respawn').map((e) => e.reason);
  check('falling below the kill plane triggers fell-respawn', reasons.includes('fell'), reasons.join(',') || 'none');
  const p = car.body.translation();
  check('respawned car is back on the road height', p.y > -1, `y=${p.y.toFixed(2)}`);
}
{ // stunt scoring only from valid events: idle car scores nothing
  const { sim, car } = flatSim();
  for (let i = 0; i < 600; i++) { car.input = idle; sim.step(); }
  check('idle car earns no stunt points', car.score === 0, `score ${car.score}`);
}
{ // lone bot lap (informational: AI lap completion on the canyon track)
  const sim = new Sim({ trackId: 'canyon_skyway', mode: 'grandprix' });
  const car = sim.addCar({ id: 'b', name: 'B', carId: 'bolt', bot: true, skill: 0.9, wobble: 0.5, seed: 1, grid: 0 });
  let t = 0;
  while (car.lapsDone < 1 && t < 60 * 200) { sim.step(); t++; }
  check('AI bot completes one lap on Canyon Skyway (single bot, no traffic)', car.lapsDone >= 1, `laps=${car.lapsDone} time=${sim.raceTime.toFixed(0)}s respawns=${car.respawns}`);
}
{ // steering assist: human car with no steer input sheds sideways slip; bots never use it
  const { sim, car } = flatSim();
  for (let i = 0; i < 120; i++) { car.input = { th: 1, br: 0, st: 0, hb: 0, bo: 0 }; sim.step(); }
  const latOf = (c) => { const v = c.body.linvel(); const r = rot(c.body.rotation(), [1, 0, 0]); return v.x * r[0] + v.y * r[1] + v.z * r[2]; };
  const v0 = car.body.linvel(), q0 = car.body.rotation();
  car.body.setLinvel({ x: v0.x + 4 * rot(q0, [1, 0, 0])[0], y: v0.y, z: v0.z + 4 * rot(q0, [1, 0, 0])[2] }, true);
  const lat0 = Math.abs(latOf(car));
  let assistRan = false;
  for (let i = 0; i < 40; i++) { car.input = { th: 0, br: 0, st: 0, hb: 0, bo: 0 }; sim.step(); if (car.assistOn) assistRan = true; }
  const lat1 = Math.abs(latOf(car));
  check('steering assist damps sideways slip (human, no steer input)', lat1 < lat0 * 0.5 && assistRan, `lateral ${lat0.toFixed(2)} -> ${lat1.toFixed(2)} m/s in 0.67 s`);
  const s2 = new Sim({ trackId: 'neon_skyline', mode: 'grandprix' });
  s2.hazardBodies.length = 0;
  const bot = s2.addCar({ id: 'b', name: 'B', carId: 'bolt', bot: true, grid: 0 });
  for (let i = 0; i < 200; i++) s2.step();
  s2.phase = 'racing'; s2.countdown = 0; bot.freezeT = 0;
  let assistEverOn = false;
  for (let i = 0; i < 120; i++) { s2.step(); if (bot.assistOn) assistEverOn = true; }
  check('steering assist is off for bots', assistEverOn === false);
}
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
