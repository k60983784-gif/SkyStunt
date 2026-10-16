// Authoritative race simulation: Rapier 3D world, raycast-vehicle cars, moving hazards,
// wind zones, progress/checkpoint/lap tracking, stunt scoring, lives, respawns and results.
// The SAME module runs on the game server (authority) and in the browser (offline mode).
import { PHYSICS_DT, RESPAWN_FREEZE, MODES, COUNTDOWN_SECONDS } from './constants.js';
import { CARS } from './cars.js';
import { getTrack } from './tracks.js';
import { clamp, lerp, wrapSigned } from './math.js';

let RAPIER = null;
/** Loads the Rapier WASM module once (works in Node and in the browser). */
export async function initPhysics() {
  if (!RAPIER) {
    const mod = await import('@dimforge/rapier3d-compat');
    const R = mod.default && mod.default.World ? mod.default : mod;
    await R.init();
    RAPIER = R;
  }
  return RAPIER;
}

// Quaternion from an orthonormal basis (columns X, Y, Z).
function quatFromBasis(x, y, z) {
  const m00 = x[0], m01 = y[0], m02 = z[0];
  const m10 = x[1], m11 = y[1], m12 = z[1];
  const m20 = x[2], m21 = y[2], m22 = z[2];
  const tr = m00 + m11 + m22;
  let qx, qy, qz, qw;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    qw = 0.25 * s; qx = (m21 - m12) / s; qy = (m02 - m20) / s; qz = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    qw = (m21 - m12) / s; qx = 0.25 * s; qy = (m01 + m10) / s; qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    qw = (m02 - m20) / s; qx = (m01 + m10) / s; qy = 0.25 * s; qz = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    qw = (m10 - m01) / s; qx = (m02 + m20) / s; qy = (m12 + m21) / s; qz = 0.25 * s;
  }
  return { x: qx, y: qy, z: qz, w: qw };
}

// Rotate a vector by a unit quaternion.
function rot(q, v) {
  const { x, y, z, w } = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

const AXLE_SIGN = -1;
// Collision groups: cars (membership 2) collide only with world/hazards (membership 1), never with each other.
const CAR_GROUP = (0x0002 << 16) | 0x0001;
// Steering assist for human cars (see drive()). Half-lives in seconds. Bots never use it.
export const STEER_ASSIST = { deadzone: 0.05, minSpeed: 6, lateralHalfLife: 0.35, yawHalfLife: 0.3 };
export const BOT_TUNING = { top: 0.95, skill: 0.05, turnNorm: 0.5, penalty: 0.6 };
export const BOT_LAT_G = 1.0;
export const BOT_STEER_GAIN = 1.2;
const BOT_TOP_BASE = BOT_TUNING.top, BOT_TOP_SKILL = BOT_TUNING.skill, BOT_TURN_NORM = BOT_TUNING.turnNorm, BOT_TURN_PENALTY = BOT_TUNING.penalty;
const NO_INPUT = Object.freeze({ th: 0, br: 0, st: 0, hb: 0, bo: 0 });
const dist2 = (ax, ay, az, bx, by, bz) => (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;

export class Sim {
  /**
   * @param {{trackId:string, mode:string, laps?:number}} opts
   */
  constructor({ trackId, mode = 'grandprix', laps }) {
    if (!RAPIER) throw new Error('call initPhysics() first');
    this.track = getTrack(trackId);
    this.mode = MODES[mode] || MODES.grandprix;
    this.modeId = this.mode.id;
    this.laps = laps || this.track.laps;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = PHYSICS_DT;
    this.time = 0;
    this.raceTime = 0;
    this.phase = 'countdown';        // countdown -> racing -> finished
    this.countdown = COUNTDOWN_SECONDS;
    this.cars = [];
    this.byId = new Map();
    this.events = [];
    this.finishOrder = [];
    this.eliminated = [];
    this.firstFinishTime = null;
    this.results = null;
    this.hazardBodies = [];
    this.carBodyHandles = new Set();
    this.buildWorld();
  }

  buildWorld() {
    const t = this.track;
    const R = RAPIER;
    const trimesh = R.ColliderDesc.trimesh(t.verts, t.trimeshIdx).setFriction(0.8).setRestitution(0);
    this.world.createCollider(trimesh);
    for (const p of t.pillars) {
      const half = (p.top - p.bottom) / 2;
      const desc = R.ColliderDesc.cuboid(0.7, half, 0.7).setTranslation(p.x, p.bottom + half, p.z);
      this.world.createCollider(desc);
    }
    // Moving hazards: kinematic bodies driven from the server tick.
    for (const h of t.hazards) {
      const baseIdx = this.sampleIndexForT(h.t);
      const body = this.world.createRigidBody(
        R.RigidBodyDesc.kinematicPositionBased().setTranslation(t.x[baseIdx], t.y[baseIdx] + 1.3, t.z[baseIdx])
      );
      const [sx, sy, sz] = h.size;
      // Hazards are sensors: they detect hits (stun + boost loss) but do not launch cars into the air.
      this.world.createCollider(R.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setSensor(true), body);
      this.hazardBodies.push({ def: h, body, baseIdx, size: h.size, angle: 0 });
    }
    // Wind zone bookkeeping: sample index ranges.
    this.windRanges = t.wind.map((w) => ({ a: this.sampleIndexForT(w.t0), b: this.sampleIndexForT(w.t1), force: w.force }));
  }

  /** Wheel rays must never hit other cars' chassis (cars are ghosts to each other). */
  rayFilter = (collider) => { const p = collider.parent(); return !(p && this.carBodyHandles.has(p.handle)); };

  sampleIndexForT(tv) {
    const t = this.track;
    // samples store t; binary-ish linear search (track is built once, cheap)
    let best = 0, bd = Infinity;
    for (let k = 0; k < t.N; k++) {
      let d = Math.abs(t.t[k] - tv);
      d = Math.min(d, t.def.points.length - d);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  /** Adds a car. opts: {id,name,carId,bot,skill,wobble,seed,grid} */
  addCar(opts) {
    const t = this.track;
    const R = RAPIER;
    const spec = CARS[opts.carId] || CARS.bolt;
    const gridIdx = t.grid[opts.grid % t.grid.length];
    const lateral = (opts.grid % 2 === 0 ? -1 : 1) * 2.4;
    const k = gridIdx;
    const q = quatFromBasis([t.rx[k], t.ry[k], t.rz[k]], [t.ux[k], t.uy[k], t.uz[k]], [t.tx[k], t.ty[k], t.tz[k]]);
    const px = t.x[k] + t.rx[k] * lateral, py = t.y[k] + 1.6, pz = t.z[k] + t.rz[k] * lateral;
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(px, py, pz).setRotation(q)
        .setLinearDamping(0.05).setAngularDamping(0.8).setCcdEnabled(true)
    );
    const hx = 0.9, hy = 0.35, hz = 2.0;
    this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(0, 0.2, 0).setDensity(spec.mass / (8 * hx * hy * hz)).setFriction(0.3).setRestitution(0.1).setCollisionGroups(CAR_GROUP), body);
    this.carBodyHandles.add(body.handle);

    const vehicle = this.world.createVehicleController(body);
    const wheelDefs = [
      { x: hx * 0.95, z: 1.3 }, { x: -hx * 0.95, z: 1.3 },
      { x: hx * 0.95, z: -1.3 }, { x: -hx * 0.95, z: -1.3 },
    ];
    for (const w of wheelDefs) {
      vehicle.addWheel({ x: w.x, y: -0.2, z: w.z }, { x: 0, y: -1, z: 0 }, { x: AXLE_SIGN, y: 0, z: 0 }, 0.45, 0.36);
    }
    for (let i = 0; i < 4; i++) {
      vehicle.setWheelSuspensionStiffness(i, spec.stiffness);
      vehicle.setWheelSuspensionCompression(i, 2.2);
      vehicle.setWheelSuspensionRelaxation(i, 2.6);
      vehicle.setWheelMaxSuspensionTravel(i, 0.3);
      vehicle.setWheelMaxSuspensionForce(i, spec.mass * 12);
      vehicle.setWheelFrictionSlip(i, spec.grip * this.track.friction);
      vehicle.setWheelSideFrictionStiffness(i, spec.sideGrip);
    }
    const P0 = wrapSigned(gridIdx, t.N);
    const car = {
      id: opts.id, name: opts.name, carId: spec.id, spec, bot: !!opts.bot,
      brain: opts.bot ? { skill: opts.skill ?? 0.9, wobble: opts.wobble ?? 0.5, seed: opts.seed ?? 1 } : null,
      body, vehicle, idx: gridIdx, P: P0, maxP: P0, lapsDone: 0, nextCp: 1,
      input: { th: 0, br: 0, st: 0, hb: 0, bo: 0 }, boost: 25, lives: this.mode.lives || 0,
      alive: true, finished: false, finishTime: null, score: 0, stunts: 0, bestAir: 0,
      air: null, drift: 0, freezeT: RESPAWN_FREEZE, upsideT: 0, stuckT: 0, wedgeT: 0, lastGoodT: 0,
      lastGood: { idx: gridIdx, P: P0 }, grounded: true, contacts: 4, hitCd: {},
      awardedGaps: new Set(), wheelRot: [0, 0, 0, 0], susp: [0.45, 0.45, 0.45, 0.45], speed: 0, respawns: 0, eliminatedAt: null, grid: opts.grid,
      place: 0,
    };
    this.cars.push(car);
    this.byId.set(car.id, car);
    return car;
  }

  setInput(id, input) {
    const car = this.byId.get(id);
    if (car && !car.bot) car.input = input;
  }

  /** Drop-in lookup of the closest track sample (windowed for speed, full search when lost). */
  nearestSample(car, px, py, pz) {
    const t = this.track, N = t.N;
    let best = car.idx, bd = Infinity;
    const W = 30;
    for (let d = -W; d <= W; d++) {
      const k = (car.idx + d + N) % N;
      const dd = dist2(px, py, pz, t.x[k], t.y[k], t.z[k]);
      if (dd < bd) { bd = dd; best = k; }
    }
    if (bd > 30 * 30) {
      for (let k = 0; k < N; k++) {
        const dd = dist2(px, py, pz, t.x[k], t.y[k], t.z[k]);
        if (dd < bd) { bd = dd; best = k; }
      }
    }
    return best;
  }

  updateProgress(car) {
    const t = this.track, N = t.N;
    const tr = car.body.translation();
    const k = this.nearestSample(car, tr.x, tr.y, tr.z);
    const delta = wrapSigned(k - car.idx, N);
    car.idx = k;
    car.P += delta;
    if (car.P > car.maxP) car.maxP = car.P;
    // Lap + checkpoint state is derived from the furthest point reached (monotone, no shortcuts possible).
    const lap = Math.max(0, Math.floor(car.maxP / N));
    const f = Math.max(0, car.maxP - lap * N);
    let nextCp = 1;
    for (let j = 1; j < t.checkpoints.length; j++) if (t.checkpoints[j] <= f) nextCp = j + 1;
    if (nextCp > car.nextCp) {
      if (car.nextCp < t.checkpoints.length) this.events.push({ k: 'cp', id: car.id, n: car.nextCp });
      car.nextCp = nextCp;
    }
    if (lap > car.lapsDone) {
      car.lapsDone = lap;
      car.nextCp = 1;
      this.events.push({ k: 'lap', id: car.id, lap });
      if (!car.finished && lap >= this.laps && this.mode.id === 'grandprix') this.finishCar(car);
      if (!car.finished && lap >= this.laps && this.mode.id !== 'grandprix') car.lapsDone = lap;
    }
  }

  finishCar(car) {
    car.finished = true;
    car.finishTime = this.raceTime;
    this.finishOrder.push(car.id);
    if (this.firstFinishTime === null) this.firstFinishTime = this.raceTime;
    this.events.push({ k: 'finish', id: car.id, pos: this.finishOrder.length, t: this.raceTime });
  }

  respawn(car, reason) {
    const t = this.track, R = RAPIER;
    if (this.mode.lives) {
      car.lives -= 1;
      if (car.lives <= 0) {
        car.alive = false;
        car.eliminatedAt = this.raceTime;
        this.eliminated.push(car.id);
        this.events.push({ k: 'out', id: car.id, reason });
        car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        car.body.setTranslation({ x: 0, y: -200 - car.grid, z: 0 }, true);
        return;
      }
    }
    // Respawn a few metres behind the last safe point so the car has a run-up.
    let k = car.lastGood.idx;
    let back = 0;
    while (back < 6 && (t.gap[(k - 1 + t.N) % t.N])) { k = (k - 1 + t.N) % t.N; back++; }
    for (let i = 0; i < 6 && !t.gap[(k - 1 + t.N) % t.N]; i++) { k = (k - 1 + t.N) % t.N; back++; }
    const q = quatFromBasis([t.rx[k], t.ry[k], t.rz[k]], [t.ux[k], t.uy[k], t.uz[k]], [t.tx[k], t.ty[k], t.tz[k]]);
    const lateral = (car.grid % 2 === 0 ? -1 : 1) * 1.0;
    car.body.setRotation(q, true);
    car.body.setTranslation({ x: t.x[k] + t.rx[k] * lateral, y: t.y[k] + 1.6, z: t.z[k] + t.rz[k] * lateral }, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    car.idx = k;
    car.P = car.lastGood.P - back;
    car.freezeT = RESPAWN_FREEZE;
    car.upsideT = 0; car.stuckT = 0; car.air = null; car.drift = 0;
    car.respawns += 1;
    this.events.push({ k: 'respawn', id: car.id, reason });
    void R;
  }

  /** Per-car drive model: converts the input into wheel engine/brake/steer + extra forces. */
  drive(car, input, dt) {
    const spec = car.spec, t = this.track, v = car.body.linvel();
    const q = car.body.rotation();
    const fwd = rot(q, [0, 0, 1]);
    const right = rot(q, [1, 0, 0]);
    const up = rot(q, [0, 1, 0]);
    const speedFwd = v.x * fwd[0] + v.y * fwd[1] + v.z * fwd[2];
    const speed = Math.hypot(v.x, v.y, v.z);
    car.speed = speed;
    const veh = car.vehicle;
    const grounded = car.contacts > 0;
    const th = input.th, br = input.br, st = clamp(input.st, -1, 1), hb = input.hb;
    const boosting = input.bo && car.boost > 0 && th > 0 && car.freezeT <= 0;
    const top = boosting ? spec.boostTop : spec.topSpeed;
    let engine = 0, brake = 0;

    if (car.freezeT > 0) {
      brake = spec.brake * 0.5;
    } else {
      if (th > 0) {
        if (speedFwd < -2) brake = th * spec.brake;
        else if (speedFwd < top) {
          const taper = clamp(1 - Math.max(0, speedFwd) / top, 0.12, 1);
          engine = th * spec.engine * taper * (boosting ? spec.boostPower : 1);
        }
      }
      if (br > 0) {
        if (speedFwd > 1.5) { brake = br * spec.brake; engine = 0; }
        else if (th === 0) { engine = -br * spec.engine * 0.55; if (speedFwd < -top * 0.35) engine = 0; }
      }
      if (th === 0 && br === 0) brake = 120;
    }
    const drivenIdx = spec.drive === 'awd' ? [0, 1, 2, 3] : [2, 3];
    const per = engine / drivenIdx.length;
    for (let i = 0; i < 4; i++) {
      veh.setWheelEngineForce(i, drivenIdx.includes(i) ? per : 0);
      veh.setWheelBrake(i, brake);
    }
    // Steering: full lock at low speed, reduced at high speed for stability.
    const lock = spec.maxSteer * lerp(1, 0.42, clamp(speed / spec.topSpeed, 0, 1));
    const steer = st * lock;
    veh.setWheelSteering(0, steer);
    veh.setWheelSteering(1, steer);
    veh.setWheelSteering(2, 0);
    veh.setWheelSteering(3, 0);
    // Handbrake: rear wheels lose grip (drift) and get extra brake.
    const mult = t.friction;
    for (let i = 0; i < 4; i++) {
      const rear = i >= 2;
      const grip = hb && rear ? spec.grip * spec.handbrakeGrip : spec.grip;
      veh.setWheelFrictionSlip(i, grip * mult);
      veh.setWheelSideFrictionStiffness(i, hb && rear ? spec.sideGrip * 0.45 : spec.sideGrip);
      if (hb && rear) veh.setWheelBrake(i, spec.brake * 0.8);
    }
    car.boostingNow = boosting;
    car.steerAngle = steer;
    // Steering assist (human cars only): with no steer input, grounded, not handbraking and moving,
    // damp sideways slip and yaw rate so the car tracks straight instead of drifting or spinning.
    car.assistOn = false;
    if (!car.bot && grounded && !hb && Math.abs(st) < STEER_ASSIST.deadzone && speed > STEER_ASSIST.minSpeed && car.freezeT <= 0) {
      car.assistOn = true;
      const keepLat = Math.exp(-dt / STEER_ASSIST.lateralHalfLife);
      const lat = v.x * right[0] + v.y * right[1] + v.z * right[2];
      const dLat = lat * (1 - keepLat) * -1;          // velocity change along right to remove slip
      const mass = car.body.mass();
      car.body.applyImpulse({ x: right[0] * dLat * mass, y: right[1] * dLat * mass, z: right[2] * dLat * mass }, true);
      const w = car.body.angvel();
      const keepYaw = Math.exp(-dt / STEER_ASSIST.yawHalfLife);
      car.body.setAngvel({ x: w.x, y: w.y * keepYaw, z: w.z }, true);
    }
    if (boosting) car.boost = Math.max(0, car.boost - 22 * dt);

    // Airborne control: small torques so the nose can be steered and pitched in the air.
    if (!grounded) {
      car.body.applyTorqueImpulse({ x: 0, y: st * spec.airYaw * dt, z: 0 }, true);
      const pitch = br * 350 * dt; // only nose-down pitch in the air; throttle does not flip the car
      car.body.applyTorqueImpulse({ x: right[0] * pitch, y: right[1] * pitch, z: right[2] * pitch }, true);
    } else {
      // Downforce grows with speed (keeps high-speed cornering and landings stable).
      const f = spec.downforce * speed * speed * (spec.mass / 1000) * dt;
      car.body.applyImpulse({ x: -up[0] * f, y: -up[1] * f, z: -up[2] * f }, true);
    }
    // Wind zones push the car sideways along the track's right vector.
    if (car.idx !== undefined) {
      for (const w of this.windRanges) {
        const inside = w.a <= w.b ? (car.idx >= w.a && car.idx <= w.b) : (car.idx >= w.a || car.idx <= w.b);
        if (inside) {
          const k = car.idx;
          const wv = (w.force * dt);
          car.body.applyImpulse({ x: t.rx[k] * wv, y: 0, z: t.rz[k] * wv }, true);
        }
      }
    }
    // Light aerodynamic drag on top of the wheel model.
    if (speed > top) {
      const extra = (speed - top) * spec.mass * 0.8 * dt;
      car.body.applyImpulse({ x: -v.x / speed * extra, y: -v.y / speed * extra * 0.2, z: -v.z / speed * extra }, true);
    }
  }

  stepHazards() {
    const t = this.track;
    for (const h of this.hazardBodies) {
      const d = h.def;
      if (d.type === 'bar') {
        // Side-to-side bar across the road
        const k = h.baseIdx;
        const off = Math.sin((this.raceTime / d.period) * Math.PI * 2) * d.amp;
        const px = t.x[k] + t.rx[k] * off, py = t.y[k] + 1.3, pz = t.z[k] + t.rz[k] * off;
        const yaw = Math.atan2(t.tx[k], t.tz[k]);
        h.body.setNextKinematicTranslation({ x: px, y: py, z: pz });
        h.body.setNextKinematicRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
      } else if (d.type === 'spin') {
        // Spinning bar across the road (rotates about the vertical axis)
        const k = h.baseIdx;
        h.angle += d.speed * PHYSICS_DT;
        const yaw = Math.atan2(t.tx[k], t.tz[k]) + h.angle;
        h.body.setNextKinematicTranslation({ x: t.x[k], y: t.y[k] + 1.3, z: t.z[k] });
        h.body.setNextKinematicRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
      }
    }
  }

  /** Stunt scoring: airtime, clean landings, gap clears, drifts. Only valid gameplay produces points. */
  updateStunts(car, dt) {
    const t = this.track;
    const q = car.body.rotation();
    const up = rot(q, [0, 1, 0]);
    const v = car.body.linvel();
    const grounded = car.contacts > 0;
    if (!grounded) {
      if (!car.air) car.air = { t: 0, gaps: new Set() };
      car.air.t += dt;
      const gid = t.gapId[car.idx];
      if (gid) car.air.gaps.add(gid);
      car.bestAir = Math.max(car.bestAir, car.air.t);
    } else if (car.air) {
      const a = car.air;
      car.air = null;
      if (a.t >= 0.5) {
        const upright = up[1];
        let pts = Math.round(a.t * 60);
        let label = `AIR ${a.t.toFixed(1)}s`;
        if (upright > 0.8) { pts += 150; label += ' CLEAN'; this.emitStunt(car, label, pts); car.boost = Math.min(100, car.boost + 12); }
        else if (upright > 0.5) { pts += 40; label += ' OK'; this.emitStunt(car, label, pts); }
        else { this.events.push({ k: 'crash', id: car.id, text: 'BAD LANDING' }); pts = 0; }
        for (const gid of a.gaps) {
          const key = `${car.lapsDone}:${gid}`;
          if (!car.awardedGaps.has(key)) {
            car.awardedGaps.add(key);
            this.emitStunt(car, 'GAP CLEARED', 250);
          }
        }
      }
    }
    // Drift: grounded sideways travel above a minimum speed.
    if (grounded && car.speed > 12) {
      const fwd = rot(q, [0, 0, 1]);
      const hv = Math.hypot(v.x, v.z) || 1;
      const fl = Math.hypot(fwd[0], fwd[2]) || 1;
      const cos = clamp((v.x * fwd[0] + v.z * fwd[2]) / (hv * fl), -1, 1);
      const slip = Math.acos(cos);
      if (slip > 0.25 && up[1] > 0.6) {
        car.drift += dt;
        if (car.drift >= 0.5) {
          car.drift -= 0.5;
          const pts = Math.round(12 * clamp(slip / 0.5, 0.5, 2));
          car.boost = Math.min(100, car.boost + 3);
          this.emitStunt(car, 'DRIFT', pts, true);
        }
      } else car.drift = 0;
    } else car.drift = 0;
  }

  emitStunt(car, text, pts, quiet = false) {
    car.score += pts;
    if (pts > 0 && !quiet) car.stunts += 1;
    this.events.push({ k: 'stunt', id: car.id, text, pts });
  }

  /** Fall / overturn / stuck detection and recovery. */
  checkRecovery(car, dt) {
    const t = this.track;
    const p = car.body.translation();
    const q = car.body.rotation();
    const up = rot(q, [0, 1, 0]);
    if (car.freezeT > 0) car.freezeT -= dt;
    if (p.y < t.killY) { this.respawn(car, 'fell'); return; }
    // Overturned: chassis up-vector points sideways/down for a sustained time (wheels may not touch).
    if (up[1] < 0.1) { car.upsideT += dt; if (car.upsideT > 2.0) { this.respawn(car, 'overturned'); return; } }
    else car.upsideT = 0;
    if (car.input.th > 0.5 && car.speed < 1.5 && car.contacts > 0 && car.freezeT <= 0 && !car.bot) car.stuckT += dt; else car.stuckT = 0;
    if (car.stuckT > 6) { this.respawn(car, 'stuck'); return; }
    if (car.bot && car.freezeT <= 0 && car.contacts > 0 && car.speed < 1.0) car.stuckT += dt; else if (car.bot) car.stuckT = 0;
    if (car.bot && car.stuckT > 5) { this.respawn(car, 'stuck'); return; }
    // Wedged: motionless with no wheel contact (e.g. resting on a hazard or wall edge) — nothing else would reset it.
    if (car.freezeT <= 0 && car.speed < 1.0 && car.contacts === 0) car.wedgeT += dt; else car.wedgeT = 0;
    if (car.wedgeT > 3) { this.respawn(car, 'stuck'); return; }
    // Remember a safe place to respawn (grounded, upright, not over a gap).
    car.lastGoodT += dt;
    if (car.lastGoodT > 0.5 && car.contacts >= 3 && up[1] > 0.7 && !t.gap[car.idx]) {
      car.lastGood = { idx: car.idx, P: car.P };
      car.lastGoodT = 0;
    }
  }

  countContacts(car) {
    let c = 0;
    for (let i = 0; i < 4; i++) if (car.vehicle.wheelIsInContact(i)) c++;
    return c;
  }

  /** Advance the simulation by one fixed step. */
  step() {
    const dt = PHYSICS_DT;
    this.time += dt;
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.phase = 'racing'; this.events.push({ k: 'go' }); }
      // Cars sit on the grid with brakes held; suspension still runs so they settle.
      for (const car of this.cars) {
        car.contacts = this.countContacts(car);
        this.drive(car, NO_INPUT, dt);
      }
      this.stepHazards();
      for (const car of this.cars) car.vehicle.updateVehicle(dt, undefined, undefined, this.rayFilter);
      this.world.step();
      for (const car of this.cars) {
        car.contacts = this.countContacts(car);
        for (let i = 0; i < 4; i++) { car.wheelRot[i] = car.vehicle.wheelRotation(i) || 0; car.susp[i] = car.vehicle.wheelSuspensionLength(i) ?? 0.45; }
      }
      return;
    }
    if (this.phase !== 'racing') return;
    this.raceTime += dt;
    for (const car of this.cars) {
      if (!car.alive || car.finished && this.mode.id === 'grandprix') {
        if (car.finished && this.mode.id === 'grandprix') car.input = { th: 0, br: 0.4, st: 0, hb: 0, bo: 0 };
        if (!car.alive) continue;
      }
      if (car.bot) car.input = this.botDecide(car);
      car.contacts = this.countContacts(car);
      this.drive(car, car.input, dt);
      if (car.finished) car.input = { th: 0, br: 0.4, st: 0, hb: 0, bo: 0 };
    }
    this.stepHazards();
    for (const car of this.cars) if (car.alive) car.vehicle.updateVehicle(dt, undefined, undefined, this.rayFilter);
    this.world.step();
    for (const car of this.cars) {
      if (!car.alive) continue;
      car.contacts = this.countContacts(car);
      const dtc = dt;
      for (let i = 0; i < 4; i++) {
        car.wheelRot[i] = car.vehicle.wheelRotation(i) || 0;
        car.susp[i] = car.vehicle.wheelSuspensionLength(i) ?? 0.45;
      }
      const wasAlive = car.alive;
      this.updateProgress(car);
      this.updateStunts(car, dtc);
      this.checkRecovery(car, dtc);
      // Hazard hits: distance check to bars (physics already pushes the car; this adds a stun + event).
      for (const h of this.hazardBodies) {
        const hp = h.body.translation();
        const cp = car.body.translation();
        const key = h.def.type + h.def.t;
        const cd = (car.hitCd[key] || 0) - dt;
        car.hitCd[key] = cd;
        if (cd <= 0 && dist2(hp.x, hp.y, hp.z, cp.x, cp.y, cp.z) < 3.2 * 3.2) {
          car.hitCd[key] = 1.2;
          car.freezeT = Math.max(car.freezeT, 0.35);
          car.boost = Math.max(0, car.boost - 15);
          this.events.push({ k: 'hit', id: car.id });
        }
      }
      void wasAlive;
    }
    this.checkRaceEnd();
  }

  botDecide(car) {
    const t = this.track, N = t.N, spec = car.spec, b = car.brain;
    const q = car.body.rotation();
    const fwd = rot(q, [0, 0, 1]);
    const right = rot(q, [1, 0, 0]);
    const p = car.body.translation();
    const v = car.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    const k = car.idx;
    // Track-frame errors (Stanley-style steering): heading error + cross-track error.
    const tx = t.tx[k], tz = t.tz[k];
    const thetaE = Math.atan2(tx * right[0] + tz * right[2], tx * fwd[0] + tz * fwd[2]);
    const e = (p.x - t.x[k]) * t.rx[k] + (p.z - t.z[k]) * t.rz[k];
    const vEff = Math.max(speed, 2);
    const delta = thetaE - Math.atan((BOT_STEER_GAIN * e) / vEff);
    const wob = Math.sin(this.raceTime * 0.9 + b.seed) * 0.03 * b.wobble;
    const st = clamp(delta / spec.maxSteer + wob, -1, 1);
    // Racing-line speed cap: v <= sqrt(aLat / curvature) over a preview window (braking before corners).
    const aLat = BOT_LAT_G * (0.85 + 0.15 * b.skill) * 9.0;
    let vCap = spec.topSpeed * (BOT_TOP_BASE + BOT_TOP_SKILL * b.skill);
    let maxKappa = 0;
    for (let d = 0; d <= 40; d += 2) {
      const a = (k + d) % N, c = (k + d + 2) % N;
      const ang = Math.abs(Math.atan2(t.tx[c] * t.tz[a] - t.tz[c] * t.tx[a], t.tx[c] * t.tx[a] + t.tz[c] * t.tz[a]));
      const kappa = ang / (2 * t.step) + 1e-6;
      if (kappa > maxKappa) maxKappa = kappa;
      const vk = Math.sqrt(aLat / kappa);
      if (vk < vCap) vCap = vk;
    }
    const target = vCap;
    let th = 0, br = 0, bo = 0;
    if (speed < target - 1) th = 1;
    else if (speed > target + 3) br = clamp((speed - target) / 8, 0, 0.9);
    else th = 0.35;
    if (Math.abs(thetaE) > 0.9 && speed > 12) { th = 0; br = Math.max(br, 0.3); }
    if (car.boost > 60 && th === 1 && maxKappa < 0.01 && car.contacts > 0) bo = 1;
    return { th, br, st, hb: 0, bo };
  }

  checkRaceEnd() {
    const alive = this.cars.filter((c) => c.alive);
    let end = false;
    if (this.mode.id === 'grandprix') {
      const unfinished = this.cars.filter((c) => !c.finished);
      if (unfinished.length === 0) end = true;
      if (this.firstFinishTime !== null && this.raceTime - this.firstFinishTime > 60) end = true;
      if (this.raceTime >= this.mode.timeLimit) end = true;
    } else if (this.mode.id === 'stunt') {
      if (this.raceTime >= this.mode.timeLimit) end = true;
    } else if (this.mode.id === 'survival') {
      if (alive.length <= 1 && this.cars.length > 1) end = true;
      if (this.raceTime >= this.mode.timeLimit) end = true;
    }
    if (end) this.finish();
  }

  finish() {
    this.phase = 'finished';
    this.events.push({ k: 'finished' });
    this.results = this.standings().map((c, i) => ({
      pos: i + 1, id: c.id, name: c.name, carId: c.carId, bot: c.bot,
      laps: Math.min(this.laps, c.lapsDone), finished: c.finished, time: c.finishTime,
      score: Math.round(c.score), stunts: c.stunts, bestAir: Number(c.bestAir.toFixed(2)), respawns: c.respawns,
    }));
  }

  /** Ordered standings according to the active mode. */
  standings() {
    const cars = this.cars.slice();
    if (this.mode.id === 'grandprix') {
      return cars.sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        return b.maxP - a.maxP;
      });
    }
    if (this.mode.id === 'stunt') return cars.sort((a, b) => b.score - a.score);
    // survival: alive first by distance, then eliminated by most recent elimination time
    return cars.sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (a.alive) return b.maxP - a.maxP;
      return (b.eliminatedAt || 0) - (a.eliminatedAt || 0);
    });
  }

  /** Live positions for HUD (1-based). */
  updatePlaces() {
    const order = this.standings();
    order.forEach((c, i) => { c.place = i + 1; });
  }

  /** Snapshot for network/rendering. Compact arrays keep messages small. */
  snapshot() {
    this.updatePlaces();
    return {
      time: this.time,
      phase: this.phase,
      raceTime: this.raceTime,
      countdown: this.countdown,
      cars: this.cars.map((c) => {
        const p = c.body.translation(), r = c.body.rotation(), v = c.body.linvel();
        return [
          c.id,
          round3(p.x), round3(p.y), round3(p.z),
          round4(r.x), round4(r.y), round4(r.z), round4(r.w),
          round2(c.speed),
          c.wheelRot.map(round2),
          c.susp.map(round2),
          c.contacts,
          c.place,
          c.lapsDone,
          c.nextCp,
          Math.round(c.score),
          Math.round(c.boost),
          c.alive ? 1 : 0,
          c.finished ? 1 : 0,
          c.lives,
          c.boostingNow ? 1 : 0,
          round2(c.steerAngle || 0),
          c.name,
          c.carId,
          c.bot ? 1 : 0,
        ];
      }),
      hazards: this.hazardBodies.map((h) => {
        const p = h.body.translation(), r = h.body.rotation();
        return [round3(p.x), round3(p.y), round3(p.z), round4(r.x), round4(r.y), round4(r.z), round4(r.w)];
      }),
      events: this.events.splice(0),
    };
  }

  dispose() {
    try { this.world.free(); } catch (e) { /* already freed */ }
  }
}

const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;
const round4 = (v) => Math.round(v * 10000) / 10000;
export { rot, quatFromBasis };
