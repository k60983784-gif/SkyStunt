// App controller: boot checks, menus (title, setup, lobby, pause, settings, results) and mode wiring.
import './style.css';
import { Game, escapeHtml, fmtTime } from './game.js';
import { NetClient } from './net.js';
import { Sfx } from './audio.js';
import { CARS, CAR_IDS } from '../shared/cars.js';
import { TRACKS, TRACK_IDS } from '../shared/tracks.js';
import { MODES } from '../shared/constants.js';

const $ = (sel, root = document) => root.querySelector(sel);
const screenEl = $('#screen');
const badge = $('#badge');
const hud = $('#hud');
const canvas = $('#scene');

// ---------- persisted settings ----------
const SETTINGS_KEY = 'skystunt.settings';
const settings = Object.assign(
  { volume: 0.6, sfx: true, quality: window.matchMedia('(max-width: 760px)').matches ? 'low' : 'high', camera: 0, name: '' },
  JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
);
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

const sfx = new Sfx();
sfx.setVolume(settings.volume);
sfx.setEnabled(settings.sfx);

// ---------- state ----------
const state = {
  screen: 'title',
  mode: 'grandprix',
  track: 'neon_skyline',
  car: 'bolt',
  online: false,
  room: null,
  lobby: null,
  net: null,
  pendingJoin: null,
};
let game = null;

// ---------- boot checks ----------
function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
function showFatal(title, text) {
  screenEl.innerHTML = `<div class="card"><div class="logo" style="font-size:44px">${title}</div><p class="sub">${text}</p><div class="msg info">Try a current version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.</div></div>`;
  screenEl.classList.add('show');
}
if (!webglSupported()) {
  showFatal('WebGL is unavailable', 'SkyStunt.io needs WebGL 2 to draw the 3D world. Your browser or device has it turned off or unsupported.');
  throw new Error('WebGL unsupported');
}
if (!('WebSocket' in window)) {
  // Offline mode still works without WebSocket.
}

// ---------- helpers ----------
const show = (html) => {
  screenEl.innerHTML = html;
  screenEl.classList.add('show');
};
const hide = () => screenEl.classList.remove('show');
const setBadge = (text, kind = '') => {
  badge.textContent = text;
  badge.className = 'badge show ' + kind;
};

function carCard(id, selected) {
  const c = CARS[id];
  const stat = (label, v) => `<div style="font-size:11px;color:var(--dim)">${label}</div><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div>`;
  const speed = (c.topSpeed - 38) / 16;
  const grip = (c.grip - 7.5) / 6;
  const accel = (c.engine - 3800) / 600;
  const steer = (c.maxSteer - 0.4) / 0.25;
  return `<button class="opt ${selected ? 'sel' : ''}" data-car="${id}">
    <h3><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#${c.color.toString(16).padStart(6, '0')};margin-right:8px"></span>${c.name}</h3>
    <p>${c.role}</p>
    <div style="margin-top:10px">${stat('Top speed', Math.min(1, speed))}${stat('Acceleration', Math.max(0.05, Math.min(1, accel)))}${stat('Grip', Math.max(0.05, Math.min(1, grip)))}${stat('Steering', Math.max(0.05, Math.min(1, steer)))}</div>
  </button>`;
}
function modeCard(id, selected) {
  const m = MODES[id];
  return `<button class="opt ${selected ? 'sel' : ''}" data-mode="${id}"><h3>${m.name}</h3><p>${m.desc}</p></button>`;
}
function trackCard(id, selected) {
  const t = TRACKS[id];
  return `<button class="opt ${selected ? 'sel' : ''}" data-track="${id}"><h3>${t.name}</h3><p>${t.tagline}</p><p style="margin-top:6px;color:var(--cyan)">${t.difficulty} · ${t.laps} laps</p></button>`;
}

// ---------- screens ----------
function renderTitle() {
  state.screen = 'title';
  show(`<div class="card" style="text-align:center">
    <div class="logo">SkyStunt.io</div>
    <p class="sub">Stunt racing across neon skylines, canyon skyways, volcanic ruins and glacier overpasses. Real vehicle physics. Bots that race you. Online rooms with friends.</p>
    <div class="row" style="justify-content:center">
      <button class="btn big" id="bQuick">⚡ Quick Play (online)</button>
      <button class="btn cyan big" id="bPrivate">🔒 Create private room</button>
    </div>
    <div class="row" style="justify-content:center;margin-top:12px">
      <input type="text" id="joinCode" maxlength="6" placeholder="ROOM CODE" style="text-transform:uppercase;letter-spacing:.2em;width:180px;text-align:center" />
      <button class="btn alt" id="bJoin">Join room</button>
    </div>
    <div class="row" style="justify-content:center;margin-top:18px">
      <button class="btn alt" id="bSolo">🏁 Solo vs AI (offline)</button>
      <button class="btn alt" id="bSettings">⚙ Settings</button>
      <button class="btn alt" id="bHow">? How to play</button>
    </div>
    <p class="sub" style="margin-top:18px;font-size:12px">Racing works in offline mode even when the multiplayer server is unreachable.</p>
  </div>`);
  $('#bQuick').onclick = () => { sfx.init(); toSetup({ online: true, action: 'quick' }); };
  $('#bPrivate').onclick = () => { sfx.init(); toSetup({ online: true, action: 'create' }); };
  $('#bJoin').onclick = () => {
    sfx.init();
    const code = $('#joinCode').value.trim().toUpperCase();
    if (code.length < 4) { $('#joinCode').focus(); return; }
    toSetup({ online: true, action: 'join', code });
  };
  $('#joinCode').onkeydown = (e) => { if (e.key === 'Enter') $('#bJoin').click(); };
  $('#bSolo').onclick = () => { sfx.init(); toSetup({ online: false, action: 'solo' }); };
  $('#bSettings').onclick = () => renderSettings(() => renderTitle());
  $('#bHow').onclick = () => renderHow();
  const params = new URLSearchParams(location.search);
  if (params.get('room') && !state.pendingJoinChecked) {
    state.pendingJoinChecked = true;
    $('#joinCode').value = params.get('room').toUpperCase().slice(0, 6);
  }
}

function renderHow() {
  show(`<div class="card">
    <h2>How to play</h2>
    <p class="sub">Drive with the keyboard or touch controls. Keep the car on the road: jumps need speed and a straight line, drifts and clean landings earn points.</p>
    <div class="two">
      <div class="section"><h4>Keyboard</h4>
        <p><span class="kbd">W</span>/<span class="kbd">↑</span> gas &nbsp; <span class="kbd">S</span>/<span class="kbd">↓</span> brake or reverse</p>
        <p><span class="kbd">A</span>/<span class="kbd">D</span> steer &nbsp; <span class="kbd">Space</span> handbrake (drift)</p>
        <p><span class="kbd">Shift</span> or <span class="kbd">E</span> boost (uses the boost bar) &nbsp; <span class="kbd">C</span> camera &nbsp; <span class="kbd">P</span> pause</p>
      </div>
      <div class="section"><h4>Touch</h4><p>Left side: steer. Right side: brake, drift, boost and gas.</p></div>
    </div>
    <div class="section"><h4>Modes</h4>
      <p><b>Grand Prix</b>: finish all laps first. <b>Stunt Challenge</b>: highest points after the timer. <b>Survival Rush</b>: three lives, last racer standing.</p>
      <p>Falling off the track, or flipping over, respawns you at the last safe point after a short delay.</p>
    </div>
    <div class="row"><button class="btn" id="bBack">Back</button></div>
  </div>`);
  $('#bBack').onclick = renderTitle;
}

function renderSettings(back) {
  show(`<div class="card">
    <h2>Settings</h2>
    <p class="sub">Saved on this device.</p>
    <div class="section"><h4>Audio</h4>
      <label>Volume <input type="range" min="0" max="1" step="0.05" id="vol" value="${settings.volume}" /></label>
      <div class="row"><label><input type="checkbox" id="sfxOn" ${settings.sfx ? 'checked' : ''}/> Sound effects and engine</label></div>
    </div>
    <div class="section"><h4>Graphics</h4>
      <div class="row">
        <button class="btn ${settings.quality === 'high' ? 'cyan' : 'alt'}" data-q="high">High</button>
        <button class="btn ${settings.quality === 'low' ? 'cyan' : 'alt'}" data-q="low">Low (faster)</button>
      </div>
      <p class="sub" style="font-size:12px;margin-top:8px">Low lowers the pixel ratio, antialiasing and scenery density. Applies to the next race.</p>
    </div>
    <div class="section"><h4>Camera</h4>
      <div class="row">${['Chase', 'Cockpit', 'High'].map((n, i) => `<button class="btn ${settings.camera === i ? 'cyan' : 'alt'}" data-cam="${i}">${n}</button>`).join('')}</div>
    </div>
    <div class="section"><h4>Player name</h4>
      <input type="text" id="pname" maxlength="16" value="${escapeHtml(settings.name)}" placeholder="Racer" />
    </div>
    <div class="row"><button class="btn" id="bDone">Done</button></div>
  </div>`);
  $('#vol').oninput = (e) => { settings.volume = Number(e.target.value); sfx.setVolume(settings.volume); saveSettings(); };
  $('#sfxOn').onchange = (e) => { settings.sfx = e.target.checked; sfx.setEnabled(settings.sfx); saveSettings(); };
  screenEl.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { settings.quality = b.dataset.q; saveSettings(); renderSettings(back); });
  screenEl.querySelectorAll('[data-cam]').forEach((b) => b.onclick = () => { settings.camera = Number(b.dataset.cam); saveSettings(); renderSettings(back); });
  $('#pname').onchange = (e) => { settings.name = e.target.value.trim().slice(0, 16); saveSettings(); };
  $('#bDone').onclick = () => { if ($('#pname')) { settings.name = $('#pname').value.trim().slice(0, 16); saveSettings(); } back(); };
}

function toSetup({ online, action, code }) {
  state.online = online;
  state.pendingAction = { action, code };
  state.screen = 'setup';
  const wantsCreate = action === 'create';
  show(`<div class="card">
    <div class="row" style="justify-content:space-between"><h2>${online ? (action === 'join' ? `Join room ${escapeHtml(code)}` : action === 'quick' ? 'Quick Play' : 'Private room') : 'Solo vs AI'}</h2>
      <button class="btn alt" id="bBack">← Back</button></div>
    <p class="sub">${online ? 'Your race joins a live room. Empty seats are filled with AI racers when the countdown starts.' : 'Offline mode: a local simulation with seven AI racers. No server needed.'}</p>
    ${online && action === 'quick' ? '<div class="msg info" style="margin:0 0 10px">Quick Play joins the fullest open lobby for this mode. If none is open, a new room starts.</div>' : ''}
    <div class="section"><h4>Racer name</h4><input type="text" id="pname" maxlength="16" value="${escapeHtml(settings.name)}" placeholder="Racer" /></div>
    <div class="section"><h4>Game mode</h4><div class="grid">${Object.keys(MODES).map((m) => modeCard(m, m === state.mode)).join('')}</div></div>
    <div class="section"><h4>Track</h4><div class="grid">${TRACK_IDS.map((t) => trackCard(t, t === state.track)).join('')}</div></div>
    <div class="section"><h4>Car</h4><div class="grid">${CAR_IDS.map((c) => carCard(c, c === state.car)).join('')}</div></div>
    <div class="row"><button class="btn big" id="bGo">${online ? (wantsCreate ? 'Create room' : action === 'join' ? 'Join race' : 'Find race') : 'Start race'}</button>
      <span class="sub">Physics: 60 Hz server-authoritative ${online ? 'online' : 'local'} simulation</span></div>
    <div id="setupErr"></div>
  </div>`);
  $('#bBack').onclick = renderTitle;
  screenEl.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { state.mode = b.dataset.mode; toSetup({ online, action, code }); });
  screenEl.querySelectorAll('[data-track]').forEach((b) => b.onclick = () => { state.track = b.dataset.track; toSetup({ online, action, code }); });
  screenEl.querySelectorAll('[data-car]').forEach((b) => b.onclick = () => { state.car = b.dataset.car; toSetup({ online, action, code }); });
  $('#bGo').onclick = () => {
    settings.name = ($('#pname').value.trim() || 'Racer').slice(0, 16);
    saveSettings();
    if (online) startOnlineFlow(action, code); else startOffline();
  };
}

// ---------- offline ----------
async function startOffline() {
  hide();
  state.online = false;
  setBadge('OFFLINE MODE — no server connection', 'warn');
  const g = ensureGame();
  g.sendNet = null;
  g.meId = 'player';
  g.camMode = settings.camera;
  await g.startOffline({ trackId: state.track, modeId: state.mode, carId: state.car, name: settings.name });
  g.setQuality(settings.quality);
}

// ---------- online ----------
function ensureGame() {
  if (!game) {
    game = new Game({
      canvas,
      hud,
      quality: settings.quality,
      sfx,
      onFinish: (results, info) => showResults(results, info),
      onPause: (p) => (p ? showPause() : resume()),
    });
    game.camMode = settings.camera;
    $('#hud .pauseBtn').onclick = () => showPause();
    window.addEventListener('resize', () => game.resizeCanvas());
  }
  return game;
}

function startOnlineFlow(action, code) {
  hide();
  const g = ensureGame();
  if (state.net) state.net.disconnect();
  const net = new NetClient({
    onStatus: (status, detail) => {
      const map = { connecting: ['connecting…', 'warn'], connected: ['ONLINE', 'ok'], reconnecting: ['reconnecting… ' + detail, 'warn'], offline: ['OFFLINE — ' + detail, 'bad'], closed: ['', ''] };
      const [t, k] = map[status] || ['', ''];
      if (status === 'connected' || status === 'connecting' || status === 'reconnecting') setBadge(t, k);
      if (status === 'offline') {
        setBadge('OFFLINE — server unreachable', 'bad');
        if (state.screen === 'lobby') showOfflineChoice(detail);
      }
    },
    onWelcome: (m) => {
      state.room = m.room;
      state.mode = m.mode; state.track = m.track;
      g.meId = 'h' + m.token.slice(0, 8);
      g.trackId = m.track;
      setBadge(`ONLINE · room ${m.room}`, 'ok');
      history.replaceState(null, '', `?room=${m.room}`);
    },
    onLobby: (m) => {
      if (m.phase === 'racing' || m.phase === 'lobby') {
        state.lobby = m;
        if (state.screen !== 'race') renderLobby(m);
      }
    },
    onState: (m) => {
      if (!g.running || g.mode !== 'online' || g.trackId !== m.track && m.track) {
        if (!g.running || g.mode !== 'online') {
          g.startOnline({ trackId: state.track, modeId: state.mode, meIdFn: () => g.meId });
          g.sendNet = (o) => state.net && state.net.send(o);
          hide();
          state.screen = 'race';
        }
      }
      g.pushState(m);
      if (m.phase === 'racing' || m.phase === 'countdown') setBadge(`ONLINE · room ${state.room} · ${m.cars.length} racers`, 'ok');
    },
    onResults: (m) => {
      showResults(m.results, { mode: 'online', modeId: m.mode, trackId: m.track, meId: g.meId });
    },
    onError: (m) => {
      if (state.screen === 'lobby' || state.screen === 'setup') showMsg(m.msg);
      else g.toast(m.msg, 'bad');
    },
    onNotice: () => {},
    onPing: (ms) => {
      if (state.online && g.mode === 'online') setBadge(`ONLINE · room ${state.room || ''} · ${ms} ms`, 'ok');
    },
  });
  state.net = net;
  state.online = true;
  state.screen = 'connecting';
  show(`<div class="card" style="text-align:center"><h2>Connecting…</h2><p class="sub">Reaching the SkyStunt server</p><div class="row" style="justify-content:center"><button class="btn alt" id="bCancel">Cancel</button></div></div>`);
  $('#bCancel').onclick = () => { net.disconnect(); renderTitle(); };
  const join = { t: 'join', name: settings.name || 'Racer', car: state.car, mode: state.mode, track: state.track, isPublic: action !== 'create' };
  if (action === 'quick') join.quick = true;
  if (action === 'create') join.create = true;
  if (action === 'join') join.code = code;
  net.connect(join);
  // lobby appears when the welcome/lobby messages arrive
  setTimeout(() => { if (state.screen === 'connecting' && !state.room) showOfflineChoice('Could not reach the server.'); }, 9000);
}

function showMsg(text) {
  const el = $('#setupErr') || $('#lobbyMsg');
  if (el) el.innerHTML = `<div class="msg">${escapeHtml(text)}</div>`;
}

function showOfflineChoice(detail) {
  if (state.screen === 'race') return;
  show(`<div class="card" style="text-align:center"><h2>Multiplayer unavailable</h2><p class="sub">${escapeHtml(detail || 'The server did not respond.')}</p>
    <div class="msg info">You can still race offline against AI in a local simulation.</div>
    <div class="row" style="justify-content:center"><button class="btn" id="bSoloNow">Race offline (AI)</button><button class="btn alt" id="bRetry">Try again</button><button class="btn alt" id="bBackT">Back</button></div></div>`);
  $('#bSoloNow').onclick = () => { if (state.net) state.net.disconnect(); state.online = false; toSetup({ online: false, action: 'solo' }); };
  $('#bRetry').onclick = () => { if (state.net) state.net.disconnect(); renderTitle(); };
  $('#bBackT').onclick = () => { if (state.net) state.net.disconnect(); renderTitle(); };
}

function renderLobby(m) {
  state.screen = 'lobby';
  const dots = m.players.map((p, i) => `<li><span class="dot ${p.connected ? '' : 'off'}"></span><b>${escapeHtml(p.name)}</b> <span class="sub" style="margin:0">${CARS[p.car]?.name || ''}${i === 0 ? ' · host' : ''}${p.connected ? '' : ' · reconnecting'}</span></li>`).join('');
  const ai = Math.max(0, m.maxRacers - m.players.length);
  const url = `${location.origin}${location.pathname}?room=${m.room}`;
  show(`<div class="card">
    <div class="row" style="justify-content:space-between"><div><div class="sub" style="margin:0">ROOM CODE</div><div class="codeBig">${m.room}</div></div>
      <div style="text-align:right"><div>${MODES[m.mode].name} · ${TRACKS[m.track].name}</div><div class="sub" style="margin:0">${m.isPublic ? 'Public (Quick Play can find it)' : 'Private — share the code'}</div></div></div>
    <div class="section"><h4>Racers (${m.players.length}/${m.maxHumans} humans · ${ai} AI will fill to ${m.maxRacers})</h4><ul class="players">${dots}</ul></div>
    <div class="section"><div class="msg info" style="margin:0">${m.startsIn != null ? `Race starts in <b>${m.startsIn}s</b>. AI racers fill the remaining seats.` : 'Waiting for players…'}</div></div>
    <div class="row">
      <button class="btn cyan" id="bStartNow">Start now</button>
      <button class="btn alt" id="bCopy">Copy invite link</button>
      <button class="btn alt" id="bLeave">Leave room</button>
    </div>
    <div id="lobbyMsg"></div>
  </div>`);
  $('#bStartNow').onclick = () => state.net && state.net.send({ t: 'start' });
  $('#bCopy').onclick = async () => { try { await navigator.clipboard.writeText(url); $('#bCopy').textContent = 'Copied!'; } catch { $('#bCopy').textContent = url; } };
  $('#bLeave').onclick = () => { if (state.net) state.net.disconnect(); state.room = null; history.replaceState(null, '', location.pathname); renderTitle(); };
}

// ---------- pause / results ----------
function showPause() {
  if (!game || !game.running) return;
  game.setPaused(true);
  show(`<div class="card" style="text-align:center;max-width:460px"><h2>Paused</h2>
    <div class="row" style="justify-content:center"><button class="btn big" id="bResume">Resume</button></div>
    <div class="section"><div class="row" style="justify-content:center">
      <button class="btn alt" id="bSet">Settings</button>
      <button class="btn alt" id="bQuit">Quit to menu</button></div></div></div>`);
  $('#bResume').onclick = resume;
  $('#bSet').onclick = () => renderSettings(showPause);
  $('#bQuit').onclick = quitToMenu;
}
function resume() {
  if (!game) return;
  hide();
  game.setPaused(false);
}
function quitToMenu() {
  if (game) game.stop();
  if (state.net) state.net.disconnect();
  state.net = null;
  setBadge('', '');
  badge.className = 'badge';
  renderTitle();
}

function showResults(results, info) {
  if (!results) return;
  if (game) game.setPaused(true);
  const me = info.meId;
  const isStunt = info.modeId === 'stunt';
  const rows = results.map((r) => {
    const mine = r.id === me;
    const time = r.time != null ? fmtTime(r.time) : (r.finished ? '—' : 'DNF');
    return `<tr class="${mine ? 'me' : ''}"><td>${r.pos}</td><td>${escapeHtml(r.name)}</td><td>${CARS[r.carId]?.name || ''}</td><td>${info.modeId === 'grandprix' ? time : ''}${info.modeId === 'grandprix' ? '' : ''}${isStunt ? r.score + ' pts' : ''}</td><td>${r.stunts ?? 0}</td><td>${r.bestAir != null ? r.bestAir.toFixed(1) + 's' : ''}</td></tr>`;
  }).join('');
  const mine = results.find((r) => r.id === me);
  const headline = mine ? (mine.pos === 1 ? 'VICTORY!' : `Finished P${mine.pos}`) : 'Race over';
  const online = info.mode === 'online';
  show(`<div class="card">
    <div class="logo" style="font-size:52px">${headline}</div>
    <p class="sub">${MODES[info.modeId].name} · ${TRACKS[info.trackId].name}</p>
    <table class="results"><thead><tr><th>#</th><th>Racer</th><th>Car</th><th>${info.modeId === 'grandprix' ? 'Time' : ''}${isStunt ? 'Points' : ''}</th><th>Stunts</th><th>Best air</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="row">
      ${online ? '<button class="btn" id="bAgain">Back to lobby</button>' : '<button class="btn" id="bAgain">Race again</button>'}
      <button class="btn alt" id="bMenu">Menu</button>
    </div>
    ${online ? '<p class="sub" style="font-size:13px">The room returns to its lobby automatically for the next race.</p>' : ''}
  </div>`);
  $('#bAgain').onclick = () => {
    if (online) {
      if (game) game.stop();
      if (state.net) {
        state.screen = 'connecting';
        const j = state.net.join;
        state.net.disconnect();
        state.net = null;
        startOnlineFlow('join', state.room || j.code);
      }
    } else {
      if (game) game.stop();
      startOffline();
    }
  };
  $('#bMenu').onclick = quitToMenu;
  state.screen = 'results';
}

// ---------- routing ----------
const params = new URLSearchParams(location.search);
renderTitle();
if (params.get('room')) {
  const code = params.get('room').toUpperCase().slice(0, 6);
  $('#joinCode') && ($('#joinCode').value = code);
}
window.addEventListener('beforeunload', () => { if (state.net) state.net.disconnect(); });
setBadge('', '');
badge.className = 'badge';
export { state };
