// Race runtime: feeds snapshots (online: interpolated network states; offline: local simulation)
// into the renderer, HUD, effects and audio. Same code path for both modes.
import * as THREE from 'three';
import { World, setLabel } from './render.js';
import { Controls } from './controls.js';
import { Sfx } from './audio.js';
import { initPhysics, Sim } from '../shared/sim.js';
import { getTrack } from '../shared/tracks.js';
import { CARS, CAR_IDS } from '../shared/cars.js';
import { MAX_RACERS, MODES, PHYSICS_DT } from '../shared/constants.js';
import { rot } from '../shared/sim.js';

const INTERP_DELAY_MS = 110;
const BOT_NAMES = ['Nova', 'Kestrel', 'Rook', 'Vega', 'Orbit', 'Zephyr', 'Ember', 'Cobalt', 'Lynx'];
const CAR_TINTS = { bolt: 0xff3b6b, dart: 0x2bff9e, titan: 0xffc83b, viper: 0x3ba7ff };

// snapshot car array indices (see shared/sim.js snapshot())
const I = { id: 0, x: 1, y: 2, z: 3, qx: 4, qy: 5, qz: 6, qw: 7, speed: 8, wheel: 9, susp: 10, contacts: 11, place: 12, lap: 13, cp: 14, score: 15, boost: 16, alive: 17, finished: 18, lives: 19, boosting: 20, steer: 21, name: 22, carId: 23, bot: 24 };

export class Game {
  constructor({ canvas, hud, onFinish, onStatus, quality, sfx, onPause }) {
    this.canvas = canvas;
    this.hud = hud;               // element containing HUD pieces
    this.onFinish = onFinish;     // (results, info) => void
    this.onStatus = onStatus || (() => {});
    this.onPause = onPause || (() => {});
    this.quality = quality || 'high';
    this.sfx = sfx || new Sfx();
    this.world = null;
    this.running = false;
    this.paused = false;
    this.buffer = [];             // online snapshots: {at, msg}
    this.events = [];             // pending events to process
    this.mode = null;             // 'online' | 'offline'
    this.meId = null;
    this.trackId = null;
    this.modeId = null;
    this.sim = null;
    this.accum = 0;
    this.lastFrame = null;
    this.lastT = 0;
    this.prevContacts = new Map();
    this.prevZ = new Map();
    this.toastTimer = null;
    this.finished = false;
    this.controls = null;
    this.lastHudKey = '';
    this.ping = null;
  }

  ensureWorld() {
    if (!this.world) this.world = new World(this.canvas, this.quality);
    return this.world;
  }

  setQuality(q) { this.quality = q; }

  /** Start an online race session: frames arrive via pushState(). */
  startOnline({ trackId, modeId, meIdFn }) {
    this.mode = 'online';
    this.trackId = trackId;
    this.modeId = modeId;
    this.buffer = [];
    this.events = [];
    this.finished = false;
    this.meIdFn = meIdFn;
    this.meId = null;
    this.beginCommon();
  }

  /** Start an offline race with the local simulation. */
  async startOffline({ trackId, modeId, carId, name }) {
    this.mode = 'offline';
    this.trackId = trackId;
    this.modeId = modeId;
    this.finished = false;
    await initPhysics();
    this.sim = new Sim({ trackId, mode: modeId });
    this.meId = 'player';
    this.sim.addCar({ id: 'player', name: name || 'You', carId, bot: false, grid: 0 });
    const others = CAR_IDS.filter((c) => c !== carId);
    for (let g = 1; g < MAX_RACERS; g++) {
      this.sim.addCar({ id: 'bot' + g, name: BOT_NAMES[(g - 1) % BOT_NAMES.length] + ' (AI)', carId: g % 2 ? others[g % others.length] : CAR_IDS[g % CAR_IDS.length], bot: true, skill: 0.9 + (g % 3) * 0.02, wobble: 0.5, seed: g * 7 + 3, grid: g });
    }
    this.accum = 0;
    this.beginCommon();
  }

  beginCommon() {
    const w = this.ensureWorld();
    w.removeAllCars();
    w.loadTrack(this.trackId);
    w.camMode = this.camMode ?? 0;
    this.trackDef = getTrack(this.trackId).def;
    this.buildMinimap();
    this.controls = this.controls || new Controls(document.body);
    this.controls.onKey = (code) => this.handleKey(code);
    this.running = true;
    this.paused = false;
    this.lastT = performance.now();
    this.hud.classList.add('live');
    this.resizeCanvas();
    this.loop = this.loop || ((t) => this.frame(t));
    requestAnimationFrame(this.loop);
    this.setHudMode();
  }

  handleKey(code) {
    if (code === 'KeyC') this.cycleCamera();
    if (code === 'KeyP' || code === 'Escape') this.onPause(!this.paused);
    if (code === 'KeyM') this.onStatus('mute', '');
  }

  cycleCamera() {
    this.camMode = ((this.camMode ?? 0) + 1) % 3;
    if (this.world) this.world.camMode = this.camMode;
    const names = ['Chase camera', 'Cockpit camera', 'High camera'];
    this.toast(names[this.camMode], 'info');
  }

  setPaused(p) {
    this.paused = p;
    if (!p) this.lastT = performance.now();
  }

  stop() {
    this.running = false;
    this.buffer = [];
    if (this.sim) { this.sim.dispose(); this.sim = null; }
    if (this.world) this.world.removeAllCars();
    this.hud.classList.remove('live');
    this.controls && this.controls.destroy();
    this.controls = null;
  }

  resizeCanvas() {
    const w = window.innerWidth, h = window.innerHeight;
    this.ensureWorld().setSize(w, h);
  }

  /** Receives online snapshots (called from the network handler). */
  pushState(msg) {
    this.buffer.push({ at: performance.now(), msg });
    if (this.buffer.length > 40) this.buffer.splice(0, this.buffer.length - 40);
    if (msg.events && msg.events.length) for (const e of msg.events) this.events.push(e);
    if (!this.meId && this.meIdFn) this.meId = this.meIdFn(msg);
  }

  // ---------- frame building ----------
  framesFromOnline(now) {
    const target = now - INTERP_DELAY_MS;
    const buf = this.buffer;
    if (!buf.length) return null;
    let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].at <= target && buf[i + 1].at >= target) { a = buf[i]; b = buf[i + 1]; break; }
    }
    if (target >= buf[buf.length - 1].at) { a = b = buf[buf.length - 1]; }
    const span = Math.max(1, b.at - a.at);
    const alpha = a === b ? 1 : Math.min(1, Math.max(0, (target - a.at) / span));
    const bm = b.msg, am = a.msg;
    const bById = new Map(bm.cars.map((c) => [c[0], c]));
    const cars = bm.cars.map((cb) => {
      const ca = am.cars.find((c) => c[0] === cb[0]);
      if (!ca || a === b) return cb;
      const out = cb.slice();
      out[I.x] = lerp(ca[1], cb[1], alpha); out[I.y] = lerp(ca[2], cb[2], alpha); out[I.z] = lerp(ca[3], cb[3], alpha);
      const qa = new THREE.Quaternion(ca[4], ca[5], ca[6], ca[7]);
      const qb = new THREE.Quaternion(cb[4], cb[5], cb[6], cb[7]);
      qa.slerp(qb, alpha);
      out[I.qx] = qa.x; out[I.qy] = qa.y; out[I.qz] = qa.z; out[I.qw] = qa.w;
      out[I.wheel] = cb[I.wheel].map((v, i) => lerp(ca[I.wheel][i], v, alpha));
      out[I.susp] = cb[I.susp].map((v, i) => lerp(ca[I.susp][i], v, alpha));
      out[I.steer] = lerp(ca[I.steer], cb[I.steer], alpha);
      return out;
    });
    void bById;
    return { phase: bm.phase, raceTime: bm.raceTime, countdown: bm.countdown, cars, hazards: bm.hazards, time: bm.time, msgRaw: bm };
  }

  framesFromOffline() {
    const s = this.sim;
    const snap = s.snapshot();
    snap.events.forEach((e) => this.events.push(e));
    return { phase: snap.phase, raceTime: snap.raceTime, countdown: snap.countdown, cars: snap.cars, hazards: snap.hazards, time: snap.time };
  }

  // ---------- main loop ----------
  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dtReal = Math.min(0.25, (now - this.lastT) / 1000);
    this.lastT = now;
    const dt = dtReal;
    if (this.paused) { this.render(dt); return; }

    let frame = null;
    if (this.mode === 'offline') {
      this.accum += dt;
      let steps = 0;
      while (this.accum >= PHYSICS_DT && steps < 16) {
        const inp = this.controls.read(PHYSICS_DT);
        this.sim.setInput('player', inp);
        this.sim.step();
        this.accum -= PHYSICS_DT;
        steps++;
        if (this.sim.phase === 'finished') break;
      }
      if (this.accum > PHYSICS_DT) this.accum = 0;
      frame = this.framesFromOffline();
      if (this.sim.phase === 'finished' && !this.finished) this.finishRace(this.sim.results);
    } else {
      frame = this.framesFromOnline(now);
      if (!this.meId && this.meIdFn && this.buffer.length) this.meId = this.meIdFn(this.buffer[this.buffer.length - 1].msg);
      if (frame && this.controls) this.sendInputMaybe(now);
    }
    if (!frame) { this.render(dt); return; }
    this.lastFrame = frame;
    this.processEvents();
    this.render(dt, frame);
    this.updateHud(frame);
  }

  sendInputMaybe(now) {
    if (!this.sendNet || now - (this.lastSend || 0) < 33) return;
    this.lastSend = now;
    this.inputSeq = (this.inputSeq || 0) + 1;
    const inp = this.controls.read(0.033);
    this.sendNet({ t: 'input', s: this.inputSeq, ...inp });
  }

  processEvents() {
    const me = this.meId;
    for (const e of this.events.splice(0)) {
      switch (e.k) {
        case 'go': this.toast('GO!', 'big'); this.sfx.chime(988, 0.3); break;
        case 'stunt':
          if (e.id === me) { this.toast(`${e.text}  +${e.pts}`, 'stunt'); if (e.pts >= 100) this.sfx.chime(1200, 0.25); }
          break;
        case 'crash': if (e.id === me) { this.toast('BAD LANDING', 'bad'); this.sfx.impact(0.8); } break;
        case 'hit': if (this.world) this.sparks(e.id); this.sfx.impact(0.5); if (e.id === me) this.world.shake = 0.25; break;
        case 'lap': if (e.id === me) { this.toast(`LAP ${e.lap}`, 'info'); this.sfx.chime(660, 0.3); } break;
        case 'cp': break;
        case 'finish': if (e.id === me) { this.toast(`FINISHED — P${e.pos}`, 'big'); this.sfx.chime(880, 0.6); } break;
        case 'respawn': if (e.id === me) this.toast(e.reason === 'fell' ? 'FELL OFF — RESPAWN' : e.reason === 'overturned' ? 'FLIPPED — RESPAWN' : 'RESPAWN', 'bad'); break;
        case 'out': if (e.id === me) this.toast('ELIMINATED', 'bad'); break;
        case 'ai': if (e.id === me) this.toast('Connection lost — AI is driving your car', 'bad'); break;
        case 'finished': break;
        default: break;
      }
    }
  }

  sparks(carId) {
    const car = this.world.cars.get(carId);
    if (!car) return;
    const p = car.car.position;
    for (let i = 0; i < 14; i++) {
      this.world.particles.emit(p.x, p.y + 0.4, p.z, { vx: (Math.random() - 0.5) * 12, vy: 3 + Math.random() * 6, vz: (Math.random() - 0.5) * 12, life: 0.5, size: 0.5, r: 1, g: 0.8, b: 0.3 });
    }
  }

  render(dt, frame) {
    const w = this.world;
    if (!w) return;
    if (!frame) { w.render(dt); return; }
    const hz = frame.hazards || [];
    w.hazards.forEach((h, i) => {
      const a = hz[i];
      if (!a) return;
      h.position.set(a[0], a[1], a[2]);
      h.quaternion.set(a[3], a[4], a[5], a[6]);
    });
    let focus = null;
    const ps = w.particles;
    for (const arr of frame.cars) {
      const id = arr[I.id];
      const color = CAR_TINTS[arr[I.carId]] ?? CARS[arr[I.carId]]?.color ?? 0xffffff;
      const q = new THREE.Quaternion(arr[I.qx], arr[I.qy], arr[I.qz], arr[I.qw]);
      const pose = { x: arr[I.x], y: arr[I.y], z: arr[I.z], q, wheelRot: arr[I.wheel], susp: arr[I.susp], steer: arr[I.steer] };
      const car = w.applyPose(id, arr[I.carId], pose, color, false);
      const isMe = id === this.meId;
      const label = (arr[I.name] || 'Racer') + (isMe ? ' ★' : '');
      setLabel(car.label, label, isMe ? '#ffe36b' : '#ffffff');
      car.label.sprite.visible = !isMe;
      if (!arr[I.alive]) car.car.visible = false; else car.car.visible = true;
      // effects
      const prev = this.prevZ.get(id);
      const pos = car.car.position;
      let slip = 0;
      if (prev && dt > 0) {
        const vx = (pos.x - prev.x) / dt, vz = (pos.z - prev.z) / dt;
        const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        const r = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        const lat = Math.abs(vx * r.x + vz * r.z), sp = Math.hypot(vx, vz) || 1;
        slip = lat / sp;
        if (arr[I.speed] > 10 && slip > 0.18 && arr[I.contacts] > 0) {
          for (const k of [2, 3]) {
            const back = new THREE.Vector3(0, 0, -1.3 * (k === 2 ? 1 : 1)).applyQuaternion(q);
            ps.emit(pos.x + back.x * 0.5 + (k === 2 ? r.x : -r.x) * 0.85, pos.y + 0.1, pos.z + back.z * 0.5 + (k === 2 ? r.z : -r.z) * 0.85,
              { vx: -vx * 0.1 + (Math.random() - 0.5), vy: 1.2 + Math.random(), vz: -vz * 0.1 + (Math.random() - 0.5), life: 0.9, size: 1.6, grow: 2.2, r: 0.8, g: 0.8, b: 0.85 });
          }
        }
        if (arr[I.boosting]) {
          const back = new THREE.Vector3(0, 0.35, -2.3).applyQuaternion(q);
          for (let i = 0; i < 2; i++) ps.emit(pos.x + back.x, pos.y + back.y, pos.z + back.z, { vx: -f.x * 14 + (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5), vz: -f.z * 14, life: 0.25, size: 1.0, grow: -1.5, r: 0.4, g: 0.8, b: 1 });
        }
        // landing dust
        const wasAir = this.prevContacts.get(id) === 0;
        if (wasAir && arr[I.contacts] > 0 && arr[I.speed] > 6) {
          for (let i = 0; i < 10; i++) ps.emit(pos.x + (Math.random() - 0.5) * 2, pos.y - 0.4, pos.z + (Math.random() - 0.5) * 2, { vx: (Math.random() - 0.5) * 5, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 5, life: 0.7, size: 2, grow: 3, r: 0.7, g: 0.6, b: 0.45 });
          if (id === this.meId) w.shake = Math.max(w.shake, 0.4);
        }
      }
      this.prevZ.set(id, { x: pos.x, z: pos.z });
      this.prevContacts.set(id, arr[I.contacts]);
      if (id === this.meId) {
        focus = { x: pos.x, y: pos.y, z: pos.z, q };
        this.localCar = arr;
        this.localSlip = slip;
      }
    }
    // remove cars that disappeared from the frame
    for (const id of [...w.cars.keys()]) {
      if (!frame.cars.find((c) => c[I.id] === id)) { w.scene.remove(w.cars.get(id).car); w.cars.delete(id); }
    }
    w.update(dt);
    const speed = this.localCar ? this.localCar[I.speed] : 0;
    if (focus) w.followCamera(focus, dt, speed);
    w.render(dt);
    if (this.localCar) {
      this.sfx.update(speed, this.controls ? this.controls.read(0).th : 0, this.localSlip || 0, !!this.localCar[I.boosting]);
    }
    this.drawMinimap(frame);
  }

  // ---------- HUD ----------
  setHudMode() {
    const el = this.hud;
    el.dataset.mode = this.modeId;
    el.querySelector('.modeTag').textContent = `${MODES[this.modeId].name} · ${getTrack(this.trackId).def.name}`;
    el.querySelector('.statusTag').textContent = this.mode === 'offline' ? 'OFFLINE MODE — solo vs AI (no server)' : 'ONLINE RACE';
    el.querySelector('.statusTag').classList.toggle('off', this.mode === 'offline');
    el.querySelector('.lapsTotal').textContent = getTrack(this.trackId).laps;
    if (this.controls && window.matchMedia('(pointer: coarse)').matches) this.controls.enableTouch();
  }

  updateHud(frame) {
    const h = this.hud;
    const me = this.localCar;
    const cdEl = h.querySelector('.countdown');
    if (frame.phase === 'countdown') {
      const n = Math.ceil(frame.countdown);
      cdEl.textContent = n > 0 ? String(n) : 'GO';
      cdEl.classList.remove('hide');
    } else if (this.cdShown !== false) {
      cdEl.classList.add('hide');
    }
    if (!me) return;
    const kmh = Math.round(me[I.speed] * 3.6);
    const place = me[I.place];
    const total = frame.cars.length;
    const key = [kmh, place, me[I.lap], me[I.boost], Math.round(frame.raceTime), me[I.score], me[I.lives], total].join('|');
    if (key === this.lastHudKey) return;
    this.lastHudKey = key;
    h.querySelector('.speed').textContent = kmh;
    h.querySelector('.place').textContent = `P${place}`;
    h.querySelector('.placeTotal').textContent = `/ ${total}`;
    h.querySelector('.lap').textContent = Math.min(getTrack(this.trackId).laps, me[I.lap] + 1);
    h.querySelector('.timer').textContent = fmtTime(frame.raceTime);
    h.querySelector('.boostFill').style.width = `${Math.round(me[I.boost])}%`;
    h.querySelector('.boostBox').classList.toggle('ready', me[I.boost] >= 100);
    h.querySelector('.score').textContent = me[I.score];
    h.querySelector('.lives').textContent = this.modeId === 'survival' ? '♥'.repeat(Math.max(0, me[I.lives])) || '✖' : '';
    h.querySelector('.scoreBox').style.display = this.modeId === 'stunt' ? '' : 'none';
    h.querySelector('.livesBox').style.display = this.modeId === 'survival' ? '' : 'none';
    h.querySelector('.timerBox').style.display = this.modeId === 'grandprix' ? 'none' : '';
    h.querySelector('.limitTag').textContent = this.modeId === 'stunt' || this.modeId === 'survival' ? `TIME ${fmtTime(Math.max(0, MODES[this.modeId].timeLimit - frame.raceTime))}` : '';
    h.querySelector('.standings').innerHTML = frame.cars
      .slice().sort((a, b) => a[I.place] - b[I.place]).slice(0, 8)
      .map((c) => `<li class="${c[I.id] === this.meId ? 'me' : ''} ${c[I.alive] ? '' : 'out'}"><b>${c[I.place]}</b> ${escapeHtml(c[I.name] || '')}${this.modeId === 'stunt' ? ` <i>${c[I.score]}</i>` : ''}</li>`).join('');
  }

  toast(text, kind = 'info') {
    const box = this.hud.querySelector('.toasts');
    if (!box) return;
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.textContent = text;
    box.appendChild(d);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => d.remove(), kind === 'big' ? 2200 : 1600);
  }

  buildMinimap() {
    const t = getTrack(this.trackId);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let k = 0; k < t.N; k++) {
      minX = Math.min(minX, t.x[k]); maxX = Math.max(maxX, t.x[k]);
      minZ = Math.min(minZ, t.z[k]); maxZ = Math.max(maxZ, t.z[k]);
    }
    this.mm = { t, minX, maxX, minZ, maxZ, canvas: this.hud.querySelector('.minimap'), frameCount: 0 };
    this.mm.ctx = this.mm.canvas.getContext('2d');
    this.mm.canvas.width = 220;
    this.mm.canvas.height = 220;
    this.mm.bg = null;
    this.drawMinimap = (frame) => this.drawMinimapImpl(frame);
  }

  drawMinimapImpl(frame) {
    const m = this.mm;
    if (!m) return;
    m.frameCount++;
    if (m.frameCount % 3) return;
    const { ctx, t, minX, maxX, minZ, maxZ } = m;
    const W = 220, pad = 14;
    const s = (W - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    const X = (x) => pad + (x - minX) * s;
    const Y = (z) => pad + (z - minZ) * s;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(6,8,22,0.55)';
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = '#ff5ae0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let k = 0; k < t.N; k++) {
      if (t.gap[k]) { ctx.stroke(); ctx.beginPath(); continue; }
      const px = X(t.x[k]), py = Y(t.z[k]);
      if (k === 0 || t.gap[k - 1]) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!frame) return;
    for (const c of frame.cars) {
      const isMe = c[I.id] === this.meId;
      ctx.fillStyle = isMe ? '#ffe36b' : (c[I.bot] ? '#7fa8ff' : '#7dffb0');
      ctx.beginPath();
      ctx.arc(X(c[I.x]), Y(c[I.z]), isMe ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  setFinishHandler() {}

  finishRace(results) {
    this.finished = true;
    this.onFinish(results, { mode: this.mode, modeId: this.modeId, trackId: this.trackId, meId: this.meId });
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
export function fmtTime(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`;
}
export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export { rot };
