// Multiplayer joiner matrix against a live URL.
// Covers: private room create + join by code, invite link (?room=CODE), Quick Play joining an open public lobby,
// invalid code, and a full room of 8 humans (2 browser tabs + 6 protocol clients) with a 9th join refused.
// Usage: node tests/browser/joiners.mjs <https-url> [outDir]
import { chromium } from 'playwright';
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || '/tmp/joiners';
fs.mkdirSync(OUT, { recursive: true });
const WS_URL = URL.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const checks = {};
const errors = [];

async function newPage(browser, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  return { p, ctx };
}

// Protocol client (no browser): joins with a join message and records lobby player counts.
function protoClient(join) {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    const rec = { lastPlayers: 0, error: null, welcomed: false, ws };
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name: join.name, car: 'bolt', mode: 'grandprix', track: 'neon_skyline', isPublic: !!join.isPublic, ...join.extra })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.t === 'welcome') rec.welcomed = true;
      if (m.t === 'lobby' && m.players) rec.lastPlayers = m.players.length;
      if (m.t === 'error') rec.error = m.msg || m.error || 'error';
    });
    ws.on('error', (e) => { rec.error = e.message; });
    setTimeout(() => resolve(rec), 2500);
  });
}

const browser = await chromium.launch({ args: ARGS });
try {
  // ---- 1. Private room: host creates, joiner types the code ----
  const host = await newPage(browser, 'host');
  await host.p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await host.p.click('#bPrivate'); await host.p.click('#bGo');
  await host.p.waitForSelector('.codeBig', { timeout: 30000 });
  const code = (await host.p.textContent('.codeBig')).trim();
  checks.privateCode = code;
  checks.privateCodeOk = /^[A-Z0-9]{4,6}$/.test(code);

  const j1 = await newPage(browser, 'joinerTyped');
  await j1.p.goto(URL, { waitUntil: 'load' });
  await j1.p.fill('#joinCode', code);
  await j1.p.click('#bJoin'); await j1.p.click('#bGo');
  await j1.p.waitForSelector('.codeBig', { timeout: 30000 });
  await sleep(1500);
  checks.typedCodeJoinerSees = await j1.p.$$eval('.players li', (e) => e.length).catch(() => -1);
  checks.hostSeesAfterTypedJoin = await host.p.$$eval('.players li', (e) => e.length).catch(() => -1);

  // ---- 2. Invite link: joiner opens ?room=CODE, code is prefilled ----
  const j2 = await newPage(browser, 'joinerLink');
  await j2.p.goto(`${URL}?room=${code}`, { waitUntil: 'load' });
  checks.inviteLinkPrefill = await j2.p.inputValue('#joinCode').catch(() => '');
  checks.inviteLinkPrefillOk = checks.inviteLinkPrefill === code;
  await j2.p.click('#bJoin'); await j2.p.click('#bGo');
  await j2.p.waitForSelector('.codeBig', { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  checks.linkJoinerSees = await j2.p.$$eval('.players li', (e) => e.length).catch(() => -1);
  checks.hostSeesAfterLink = await host.p.$$eval('.players li', (e) => e.length).catch(() => -1);

  // ---- 3. Invalid code: must show an error, not hang on "Connecting" ----
  const bad = await newPage(browser, 'badcode');
  await bad.p.goto(URL, { waitUntil: 'load' });
  await bad.p.fill('#joinCode', 'QQQQQ');
  await bad.p.click('#bJoin'); await bad.p.click('#bGo');
  await sleep(6000);
  const badText = await bad.p.evaluate(() => document.querySelector('#screen')?.innerText || '');
  checks.invalidCodeScreen = badText.slice(0, 120).replace(/\s+/g, ' ');
  checks.invalidCodeShowsError = /not found|no room|unknown|invalid|doesn.t exist|not exist/i.test(badText);
  await bad.p.screenshot({ path: path.join(OUT, 'invalid-code.jpg'), type: 'jpeg', quality: 60 });
  await bad.ctx.close();

  // ---- 4. Quick Play: first player opens a public lobby, second player should land in the same room ----
  const q1 = await newPage(browser, 'quickA');
  await q1.p.goto(URL, { waitUntil: 'load' });
  await q1.p.click('#bQuick'); await q1.p.click('#bGo');
  await q1.p.waitForSelector('.codeBig', { timeout: 30000 });
  const quickCode = (await q1.p.textContent('.codeBig')).trim();
  const q2 = await newPage(browser, 'quickB');
  await q2.p.goto(URL, { waitUntil: 'load' });
  await q2.p.click('#bQuick'); await q2.p.click('#bGo');
  await q2.p.waitForSelector('.codeBig', { timeout: 30000 });
  const quickCode2 = (await q2.p.textContent('.codeBig')).trim();
  checks.quickPlaySameRoom = quickCode === quickCode2;
  checks.quickPlayCodes = [quickCode, quickCode2];
  await sleep(1000);
  checks.quickHostSees = await q1.p.$$eval('.players li', (e) => e.length).catch(() => -1);

  // ---- 5. Full room: 8 humans (2 browsers + 6 protocol clients). A 9th join must be refused. ----
  const full = await newPage(browser, 'fullHost');
  await full.p.goto(URL, { waitUntil: 'load' });
  await full.p.click('#bPrivate'); await full.p.click('#bGo');
  await full.p.waitForSelector('.codeBig', { timeout: 30000 });
  const fullCode = (await full.p.textContent('.codeBig')).trim();
  const fullB = await newPage(browser, 'fullJoinerB');
  await fullB.p.goto(URL, { waitUntil: 'load' });
  await fullB.p.fill('#joinCode', fullCode); await fullB.p.click('#bJoin'); await fullB.p.click('#bGo');
  await fullB.p.waitForSelector('.codeBig', { timeout: 30000 }).catch(() => {});
  const clients = [];
  for (let i = 0; i < 6; i++) clients.push(protoClient({ name: 'P' + (i + 3), extra: { code: fullCode } }));
  const results = await Promise.all(clients);
  await sleep(1500);
  checks.fullRoomHumansHost = await full.p.$$eval('.players li', (e) => e.length).catch(() => -1);
  checks.fullRoomWelcomed = results.filter((r) => r.welcomed).length;
  checks.ninthJoin = await protoClient({ name: 'Ninth', extra: { code: fullCode } }).then((r) => ({ welcomed: r.welcomed, error: r.error }));
  for (const r of results) try { r.ws.close(); } catch { /* ignore */ }
  await full.p.screenshot({ path: path.join(OUT, 'full-room-host.jpg'), type: 'jpeg', quality: 60 });
} catch (e) {
  errors.push('harness: ' + e.message.split('\n')[0]);
}
await browser.close();

const pass =
  errors.length === 0 &&
  checks.privateCodeOk &&
  checks.typedCodeJoinerSees >= 2 && checks.hostSeesAfterTypedJoin >= 2 &&
  checks.inviteLinkPrefillOk && checks.linkJoinerSees >= 2 &&
  checks.invalidCodeShowsError === true &&
  checks.quickPlaySameRoom === true &&
  checks.fullRoomHumansHost === 8 &&
  checks.ninthJoin && checks.ninthJoin.welcomed === false;
console.log(JSON.stringify({ pass, checks, errors: errors.slice(0, 20), errorCount: errors.length }, null, 2));
process.exit(pass ? 0 : 1);
