// Client-side prediction for the local player's car (online races).
// The server stays authoritative. This class keeps a private, single-car copy of the race physics,
// steps it at the fixed 60 Hz rate with the player's own inputs, and when a snapshot arrives it
// rewinds to the server state and replays the inputs the server has not acknowledged yet.
// Ghost cars (no car-to-car collision) mean the local copy only needs the track and this car.
import { Sim } from '../shared/sim.js';
import { PHYSICS_DT } from '../shared/constants.js';

const SNAP_LIMIT_M = 3.0;     // larger position errors (respawn, teleport) are snapped, not blended
const BLEND_HALF_LIFE = 0.12; // seconds for a small correction to fade out

export class CarPredictor {
  constructor({ trackId, modeId, carId, id }) {
    this.id = id;
    this.sim = new Sim({ trackId, mode: modeId });
    this.car = this.sim.addCar({ id, name: 'me', carId, bot: false, grid: 0 });
    this.sim.phase = 'racing';
    this.sim.countdown = 0;
    this.car.freezeT = 0;
    this.seq = 0;
    this.pending = [];          // {s, inp} sent but not yet acknowledged by the server
    this.offset = { x: 0, y: 0, z: 0 };
    this.lastCorrection = 0;    // metres, for debugging and tests
    this.reconciles = 0;
  }

  /** Advances the local copy by one physics step using input `inp`. Returns the input sequence number. */
  step(inp) {
    this.seq += 1;
    const entry = { s: this.seq, inp: { th: inp.th, br: inp.br, st: inp.st, hb: inp.hb, bo: inp.bo } };
    this.pending.push(entry);
    if (this.pending.length > 240) this.pending.splice(0, this.pending.length - 240);
    this._apply(entry);
    return this.seq;
  }

  _apply(entry) {
    this.sim.setInput(this.id, { ...entry.inp, s: entry.s });
    this.sim.step();
    this.sim.events.length = 0;
  }

  position() {
    const p = this.car.body.translation();
    return { x: p.x, y: p.y, z: p.z };
  }

  /**
   * Rewinds to the server state for this car and replays unacknowledged inputs.
   * serverCar: the car array from a snapshot (sim.snapshot layout, see game.js I map).
   * ack: last input sequence the server applied for this car.
   */
  reconcile(serverCar, ack, I) {
    const before = this.position();
    const b = this.car.body;
    const v = [serverCar[I.vx], serverCar[I.vy], serverCar[I.vz]];
    const w = [serverCar[I.wx], serverCar[I.wy], serverCar[I.wz]];
    b.setTranslation({ x: serverCar[I.x], y: serverCar[I.y], z: serverCar[I.z] }, true);
    b.setRotation({ x: serverCar[I.qx], y: serverCar[I.qy], z: serverCar[I.qz], w: serverCar[I.qw] }, true);
    b.setLinvel({ x: v[0], y: v[1], z: v[2] }, true);
    b.setAngvel({ x: w[0], y: w[1], z: w[2] }, true);
    this.car.boost = serverCar[I.boost];
    this.car.freezeT = serverCar[I.freeze] ? Math.max(this.car.freezeT, 0.01) : 0;
    this.pending = this.pending.filter((e) => e.s > ack);
    for (const e of this.pending) this._apply(e);
    const after = this.position();
    const dx = before.x - after.x, dy = before.y - after.y, dz = before.z - after.z;
    const err = Math.hypot(dx, dy, dz);
    this.lastCorrection = err;
    this.reconciles += 1;
    if (err > SNAP_LIMIT_M) this.offset = { x: 0, y: 0, z: 0 };
    else this.offset = { x: this.offset.x + dx, y: this.offset.y + dy, z: this.offset.z + dz };
  }

  /** Decays the visual correction. Call once per rendered frame with real dt in seconds. */
  decay(dt) {
    const k = Math.exp(-dt / BLEND_HALF_LIFE);
    this.offset = { x: this.offset.x * k, y: this.offset.y * k, z: this.offset.z * k };
  }

  /** Predicted pose for rendering: position with visual correction, rotation, speed, steer. */
  pose() {
    const p = this.position(), q = this.car.body.rotation();
    return {
      x: p.x + this.offset.x, y: p.y + this.offset.y, z: p.z + this.offset.z,
      qx: q.x, qy: q.y, qz: q.z, qw: q.w, speed: this.car.speed || 0, steer: this.car.steerAngle || 0,
    };
  }

  dispose() { this.sim.dispose(); }
}

export const PREDICT_STEP = PHYSICS_DT;
