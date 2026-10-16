// Online checks in headless Chromium: Quick Play with bot fill, private room + join by code,
// invalid code, leave, and a 2-human race start. Usage: node tests/browser/online-matrix.mjs <url> [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || '/tmp/matrix';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const out = { checks: {}, errors: [] };

function watch(page, tag) {
  page.on('console', (m) => { if (m.type() === 'error') out.errors.push(`${tag} console: ${m.text()}`); });
  page.on('pageerror', (e) => out.errors.push(`${tag} pageerror: ${e.message}`));
  page.on('requestfailed', (r) => out.errors.push(`${tag} requestfailed: ${r.url()}`));
}

const browser = await chromium.launch({ args: ARGS });
try {
  // --- A: Quick Play, one human, bots fill to 8 ---
  const ca = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const a = await ca.newPage(); watch(a, 'A');
  await a.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await a.click('#bQuick');
  await a.click('#bGo');
  await a.waitForSelector('#bStartNow', { timeout: 30000 });
  out.checks.lobbyShown = true;
  out.checks.roomCodeA = await a.textContent('.codeBig');
  out.checks.lobbyHumansA = await a.textContent('.section h4');
  await a.screenshot({ path: path.join(OUT, 'online-lobby-quick.jpg'), type: 'jpeg', quality: 70 });
  // wait for bots to fill and the race to start (LOBBY_FILL_SECONDS = 12, countdown 3)
  await a.waitForSelector('#hud.live', { timeout: 60000 });
  await a.waitForFunction(() => document.querySelector('#hud .countdown')?.classList.contains('hide'), null, { timeout: 40000 });
  out.checks.statusTagOnline = await a.textContent('#hud .statusTag');
  out.checks.racersOnStandings = await a.$$eval('#hud .standings li', (els) => els.length);
  const names = await a.$$eval('#hud .standings li', (els) => els.map((e) => e.textContent.trim()));
  out.checks.standingNames = names.slice(0, 8);
  await a.keyboard.down('ArrowUp'); await sleep(8000); await a.keyboard.up('ArrowUp');
  out.checks.speedOnline = Number(await a.textContent('#hud .speed'));
  await a.screenshot({ path: path.join(OUT, 'online-race-bots.jpg'), type: 'jpeg', quality: 70 });
  await ca.close();

  // --- B: private room, second human joins by code ---
  const cb = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const b = await cb.newPage(); watch(b, 'B');
  await b.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await b.click('#bPrivate');
  await b.click('#bGo');
  await b.waitForSelector('.codeBig', { timeout: 30000 });
  const code = (await b.textContent('.codeBig')).trim();
  out.checks.privateCode = code;
  out.checks.privateCodeLength = code.length;

  const cc = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const c = await cc.newPage(); watch(c, 'C');
  await c.goto(URL, { waitUntil: 'load', timeout: 60000 });
  // invalid code first
  await c.fill('#joinCode', 'ZZZZZZ');
  await c.click('#bJoin');
  await c.click('#bGo').catch(() => {});
  await sleep(4000);
  out.checks.invalidCodeMessage = await c.evaluate(() => document.querySelector('#screen')?.innerText.slice(0, 200) || '');
  // valid code
  await c.goto(URL, { waitUntil: 'load' });
  await c.fill('#joinCode', code);
  await c.click('#bJoin');
  await c.click('#bGo').catch(() => {});
  await c.waitForSelector('.codeBig', { timeout: 30000 });
  await sleep(1500);
  out.checks.humansSeenByHost = await b.$$eval('.players li', (els) => els.length).catch(() => -1);
  out.checks.humansSeenByJoiner = await c.$$eval('.players li', (els) => els.length).catch(() => -1);
  await b.screenshot({ path: path.join(OUT, 'online-private-host.jpg'), type: 'jpeg', quality: 70 });
  // host starts now
  await b.click('#bStartNow');
  await b.waitForSelector('#hud.live', { timeout: 40000 });
  await b.waitForFunction(() => document.querySelector('#hud .countdown')?.classList.contains('hide'), null, { timeout: 40000 });
  out.checks.racersAfterStart = await b.$$eval('#hud .standings li', (els) => els.length);
  await c.waitForSelector('#hud.live', { timeout: 40000 }).catch(() => {});
  out.checks.joinerInRace = await c.isVisible('#hud.live').catch(() => false);
  await cb.close(); await cc.close();
} catch (e) {
  out.errors.push('harness: ' + e.message.split('\n')[0]);
}
await browser.close();
const pass = out.errors.length === 0 && out.checks.racersOnStandings === 8 && out.checks.privateCodeLength === 5 && out.checks.joinerInRace === true;
console.log(JSON.stringify({ pass, ...out }, null, 2));
process.exit(pass ? 0 : 1);
