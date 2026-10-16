// A multiplayer race room. The server owns the simulation; clients only send inputs.
import { Sim } from '../shared/sim.js';
import { PHYSICS_DT, SNAPSHOT_HZ, MAX_RACERS, MAX_HUMANS_PER_ROOM, LOBBY_FILL_SECONDS, RESULTS_SECONDS, MODES } from '../shared/constants.js';
import { CARS, CAR_IDS } from '../shared/cars.js';
import { TRACKS } from '../shared/tracks.js';

const BOT_NAMES = ['Nova', 'Kestrel', 'Rook', 'Vega', 'Orbit', 'Zephyr', 'Ember', 'Cobalt', 'Lynx', 'Quartz', 'Mako', 'Surge'];
const RECONNECT_GRACE_MS = 20000;

export class Room {
  constructor({ code, mode, track, isPublic, log }) {
    this.code = code;
    this.mode = MODES[mode] ? mode : 'grandprix';
    this.track = TRACKS[track] ? track : 'neon_skyline';
    this.isPublic = isPublic;
    this.log = log || (() => {});
    this.members = new Map();   // token -> member
    this.phase = 'lobby';       // lobby | racing | finished
    this.sim = null;
    this.lobbyEnd = 0;          // timestamp when the race starts (set by the first human)
    this.resultsEnd = 0;
    this.acc = 0;
    this.snapCounter = 0;
    this.lastTick = Date.now();
    this.createdAt = Date.now();
    this.lastEmptyAt = Date.now();
    this.raceCount = 0;
  }

  get humanCount() { return this.members.size; }
  get connectedCount() { let n = 0; for (const m of this.members.values()) if (m.ws) n++; return n; }

  /** Token-based membership: a player rejoining with their token reclaims the seat. */
  join(ws, msg, token) {
    if (this.members.size >= MAX_HUMANS_PER_ROOM && !this.members.has(token)) return { error: 'Room is full' };
    let m = this.members.get(token);
    let seat = null;
    if (!m && this.phase === 'racing') {
      // Late join: a new human takes over an unfinished AI car (see takeOverBot).
      seat = this.pickBotSeat();
      if (!seat) return { error: 'Race in progress. No AI seat is free.' };
    }
    if (!m) {
      m = { token, id: 'h' + token.slice(0, 8), name: msg.name, car: msg.car, ws: null, disconnectedAt: 0 };
      this.members.set(token, m);
      if (seat) this.takeOverBot(seat, m);
    }
    m.ws = ws;
    m.name = msg.name;
    m.car = msg.car;
    m.disconnectedAt = 0;
    m.gone = false;
    // Public (Quick Play) lobbies start on a timer; private rooms wait for the host so friends can still join by code.
    if (this.phase === 'lobby' && this.lobbyEnd === 0 && this.isPublic) this.lobbyEnd = Date.now() + LOBBY_FILL_SECONDS * 1000;
    this.lastEmptyAt = Date.now();
    this.log('join', this.code, msg.name, this.members.size);
    return { member: m };
  }

  /** Unfinished AI car to hand to a late joiner: the one furthest back on the grid. Null if none. */
  pickBotSeat() {
    if (!this.sim || this.sim.phase !== 'racing') return null;
    const bots = this.sim.cars.filter((c) => c.bot && !c.finished);
    if (!bots.length) return null;
    bots.sort((a, b) => b.grid - a.grid);
    return bots[0];
  }

  /** Hands an AI car to a human. Physics state and race progress are kept; only the controller changes. */
  takeOverBot(car, m) {
    this.sim.byId.delete(car.id);
    car.id = m.id;
    car.name = m.name;
    car.bot = false;
    car.brain = null;
    car.input = { th: 0, br: 0, st: 0, hb: 0, bo: 0 };
    this.sim.byId.set(car.id, car);
    this.log('late-join', this.code, m.name, 'took seat', car.grid);
  }

  /** Connection dropped. The seat stays reserved for a grace period. */
  detach(token) {
    const m = this.members.get(token);
    if (!m) return;
    m.ws = null;
    m.disconnectedAt = Date.now();
  }

  leave(token) {
    const m = this.members.get(token);
    if (!m) return;
    this.members.delete(token);
    if (this.sim) {
      const car = this.sim.byId.get(m.id);
      if (car && !car.bot) this.convertToBot(car, 'left');
    }
    this.lastEmptyAt = Date.now();
    this.log('leave', this.code, m.name);
  }

  convertToBot(car, why) {
    car.bot = true;
    car.brain = { skill: 0.7, wobble: 0.6, seed: car.grid + 3 };
    car.name = car.name.replace(/\s*\(AI\)$/, '') + ' (AI)';
    this.sim.events.push({ k: 'ai', id: car.id, why });
  }

  /** Input from an authenticated member. */
  input(token, inp) {
    const m = this.members.get(token);
    if (!m || !this.sim || this.phase !== 'racing') return;
    this.sim.setInput(m.id, { th: inp.th, br: inp.br, st: inp.st, hb: inp.hb, bo: inp.bo, s: inp.s });
  }

  forceStart(token) {
    if (this.phase !== 'lobby') return false;
    const first = this.members.keys().next().value;
    if (first !== token) return false;
    this.lobbyEnd = Date.now();
    return true;
  }

  startRace() {
    const ids = [];
    this.sim = new Sim({ trackId: this.track, mode: this.mode });
    const humans = [...this.members.values()];
    let grid = 0;
    for (const m of humans) {
      if (grid >= MAX_RACERS) break;
      this.sim.addCar({ id: m.id, name: m.name, carId: CAR_IDS.includes(m.car) ? m.car : 'bolt', bot: false, grid });
      ids.push(m.id); grid++;
    }
    let bi = 0;
    const seed0 = this.raceCount * 97 + 13;
    while (grid < MAX_RACERS) {
      const carId = CAR_IDS[(grid + this.raceCount) % CAR_IDS.length];
      const skill = 0.82 + ((grid * 37 + seed0) % 17) / 100;
      this.sim.addCar({ id: 'bot' + grid, name: BOT_NAMES[(bi + this.raceCount) % BOT_NAMES.length] + ' (AI)', carId, bot: true, skill, wobble: 0.5, seed: grid + seed0, grid });
      bi++; grid++;
    }
    this.raceCount++;
    this.phase = 'racing';
    this.lobbyEnd = 0;
    this.acc = 0;
    this.lastTick = Date.now();
    this.log('start', this.code, this.mode, this.track, 'humans', humans.length);
  }

  finishRace() {
    this.phase = 'finished';
    this.resultsEnd = Date.now() + RESULTS_SECONDS * 1000;
    this.resultsSent = false;
  }

  resetToLobby() {
    if (this.sim) this.sim.dispose();
    this.sim = null;
    this.phase = 'lobby';
    this.lobbyEnd = this.members.size && this.isPublic ? Date.now() + LOBBY_FILL_SECONDS * 1000 : 0;
  }

  /** Called every server tick. */
  tick(now) {
    // Reconnect grace expiry
    for (const [token, m] of this.members) {
      if (!m.ws && m.disconnectedAt && now - m.disconnectedAt > RECONNECT_GRACE_MS) {
        this.members.delete(token);
        if (this.sim) {
          const car = this.sim.byId.get(m.id);
          if (car && !car.bot) this.convertToBot(car, 'timeout');
        }
        this.log('expired', this.code, m.name);
      }
    }
    if (this.phase === 'lobby') {
      if (this.members.size > 0 && this.lobbyEnd && now >= this.lobbyEnd) this.startRace();
      return;
    }
    if (this.phase === 'finished') {
      if (now >= this.resultsEnd) this.resetToLobby();
      return;
    }
    // racing: fixed-step simulation driven by real time (accumulator, capped)
    const dtReal = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.acc += dtReal;
    let steps = 0;
    while (this.acc >= PHYSICS_DT && steps < 20) {
      this.sim.step();
      this.acc -= PHYSICS_DT;
      steps++;
      if (this.sim.phase === 'finished') { this.finishRace(); break; }
    }
    if (this.acc > PHYSICS_DT) this.acc = 0;
    this.snapCounter += 1;
  }

  /** Builds per-recipient messages (state is shared; events drained once). */
  broadcastState(now, shouldSnap) {
    if (!shouldSnap) return;
    if (this.phase === 'lobby' || !this.sim) {
      this.broadcastLobby(now);
      return;
    }
    const snap = this.sim.snapshot();
    const msg = JSON.stringify({ t: 'state', room: this.code, ...snap });
    this.send(msg);
    if (this.phase === 'finished' && !this.resultsSent) {
      this.resultsSent = true;
      this.send(JSON.stringify({ t: 'results', room: this.code, mode: this.mode, track: this.track, results: this.sim.results }));
    }
  }

  broadcastLobby(now) {
    const players = [...this.members.values()].map((m) => ({ id: m.id, name: m.name, car: m.car, connected: !!m.ws }));
    const startsIn = this.lobbyEnd ? Math.max(0, Math.ceil((this.lobbyEnd - now) / 1000)) : null;
    const msg = JSON.stringify({
      t: 'lobby', room: this.code, mode: this.mode, track: this.track, isPublic: this.isPublic,
      phase: this.phase, players, humans: players.length, maxHumans: MAX_HUMANS_PER_ROOM,
      botsWhenStart: Math.max(0, MAX_RACERS - players.length), maxRacers: MAX_RACERS,
      startsIn, results: this.phase === 'finished' && this.sim ? this.sim.results : null,
    });
    this.send(msg);
  }

  send(msg) {
    for (const m of this.members.values()) {
      if (m.ws && m.ws.readyState === 1 && m.ws.bufferedAmount < 1_000_000) m.ws.send(msg);
    }
  }

  sendTo(token, obj) {
    const m = this.members.get(token);
    if (m && m.ws && m.ws.readyState === 1) m.ws.send(JSON.stringify(obj));
  }

  dispose() {
    if (this.sim) this.sim.dispose();
    this.sim = null;
  }
}

export { CARS };
