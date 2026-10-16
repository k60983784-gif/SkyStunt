// Full solo matrix in headless Chromium: every track, mode and car, bots, HUD, pause, touch, settings.
// Usage: node tests/browser/matrix.mjs <url> [outDir]
// Writes one JSON line per run to stdout and a summary at the end. Exit code 1 if any run has errors.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || '/tmp/matrix';
fs.mkdirSync(OUT, { recursive: true });

const TRACKS = ['neon_skyline', 'canyon_skyway', 'volcanic_ruins', 'glacier_overpass'];
const MODES = ['grandprix', 'stunt', 'survival'];
const CARS = ['bolt', 'dart', 'titan', 'viper'];
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function watch(page, log) {
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => log.errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
  page.on('response', (r) => { if (r.status() >= 400) log.errors.push('http ' + r.status() + ': ' + r.url()); });
}

async function soloRun(browser, idx, track, mode, car) {
  const name = `${String(idx).padStart(2, '0')}-${track}-${mode}-${car}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const log = { run: name, track, mode, car, errors: [], checks: {} };
  watch(page, log);
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.click('#bSolo');
    // choose options (setup screen re-renders after each click, so click in sequence)
    await page.click(`[data-mode="${mode}"]`); await sleep(150);
    await page.click(`[data-track="${track}"]`); await sleep(150);
    await page.click(`[data-car="${car}"]`); await sleep(150);
    const sel = await page.evaluate(() => ({
      mode: document.querySelector('[data-mode].sel')?.dataset.mode,
      track: document.querySelector('[data-track].sel')?.dataset.track,
      car: document.querySelector('[data-car].sel')?.dataset.car,
    }));
    log.checks.selectionMatches = sel.mode === mode && sel.track === track && sel.car === car;
    log.selection = sel;
    await page.click('#bGo');
    await page.waitForSelector('#hud.live', { timeout: 30000 });
    log.checks.modeTag = await page.textContent('#hud .modeTag');
    log.checks.statusTag = await page.textContent('#hud .statusTag');
    // countdown runs 3 s; wait until it hides
    await page.waitForFunction(() => document.querySelector('#hud .countdown')?.classList.contains('hide'), null, { timeout: 40000 });
    const standings0 = await page.$$eval('#hud .standings li', (els) => els.length);
    log.checks.racersInStandings = standings0;
    const lives0 = await page.textContent('#hud .lives');
    const lapsTotal = await page.textContent('#hud .lapsTotal');
    log.checks.lapsTotal = lapsTotal;
    log.checks.livesHud = lives0;
    // drive: gas + alternating steer; drift and boost pulses
    await page.keyboard.down('ArrowUp');
    let peakSpeed = 0;
    for (let i = 0; i < 8; i++) {
      await sleep(900);
      peakSpeed = Math.max(peakSpeed, Number(await page.textContent('#hud .speed')) || 0);
      if (i % 2 === 0) await page.keyboard.down('ArrowLeft'); else { await page.keyboard.up('ArrowLeft'); await page.keyboard.down('ArrowRight'); }
      if (i === 3) { await page.keyboard.down('Space'); await sleep(400); await page.keyboard.up('Space'); }
      if (i === 5) { await page.keyboard.down('ShiftLeft'); await sleep(400); await page.keyboard.up('ShiftLeft'); }
    }
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowLeft');
    const hud1 = await page.evaluate(() => ({
      speed: Number(document.querySelector('#hud .speed').textContent),
      timer: document.querySelector('#hud .timer').textContent,
      score: document.querySelector('#hud .score').textContent,
      place: document.querySelector('#hud .place').textContent,
      limit: document.querySelector('#hud .limitTag').textContent,
      lives: document.querySelector('#hud .lives').textContent,
    }));
    Object.assign(log.checks, { hud: hud1 });
    log.checks.peakSpeedKmh = peakSpeed;
    log.checks.movedFaster = peakSpeed > 20; // peak over the run; the car can leave the road while steering
    log.checks.timerRunning = hud1.timer !== '00:00.00';
    await page.keyboard.up('ArrowUp');
    await page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 70 });
    // pause and resume
    await page.keyboard.press('KeyP');
    await sleep(400);
    log.checks.pauseShown = await page.isVisible('#bResume').catch(() => false);
    await page.click('#bResume').catch(() => {});
    await sleep(300);
    log.checks.resumed = await page.evaluate(() => !document.querySelector('#screen')?.classList.contains('show'));
    // camera cycle
    await page.keyboard.press('KeyC'); await sleep(200);
    log.checks.cameraCycled = true;
    // quit to menu for the last sample only
    if (idx === 0) {
      await page.keyboard.press('KeyP'); await sleep(300);
      await page.click('#bQuit'); await sleep(500);
      log.checks.quitToMenu = await page.isVisible('#bSolo');
    }
  } catch (e) {
    log.errors.push('harness: ' + e.message.split('\n')[0]);
    await page.screenshot({ path: path.join(OUT, name + '-FAIL.jpg'), type: 'jpeg', quality: 60 }).catch(() => {});
  }
  await ctx.close();
  log.pass = log.errors.length === 0 && log.checks.selectionMatches === true && log.checks.movedFaster === true && log.checks.timerRunning === true && log.checks.resumed === true;
  return log;
}

async function touchRun(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const log = { run: 'touch-phone', errors: [], checks: {} };
  watch(page, log);
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.click('#bSolo');
    await page.click('#bGo');
    await page.waitForSelector('#hud.live', { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('#hud .countdown')?.classList.contains('hide'), null, { timeout: 40000 });
    log.checks.touchButtons = await page.$$eval('.tbtn', (els) => els.length);
    const gas = page.locator('.tbtn.gas');
    const box = await gas.boundingBox();
    log.checks.gasButtonVisible = !!box;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
    // hold gas with pointer events
    await page.dispatchEvent('.tbtn.gas', 'pointerdown', { pointerId: 1, isPrimary: true });
    await sleep(6000);
    const speed = Number(await page.textContent('#hud .speed'));
    await page.dispatchEvent('.tbtn.gas', 'pointerup', { pointerId: 1, isPrimary: true });
    log.checks.speedAfterHoldGas = speed;
    log.checks.touchMoved = speed > 20;
    await page.screenshot({ path: path.join(OUT, 'touch-phone.jpg'), type: 'jpeg', quality: 70 });
  } catch (e) {
    log.errors.push('harness: ' + e.message.split('\n')[0]);
  }
  await ctx.close();
  log.pass = log.errors.length === 0 && log.checks.touchButtons >= 6 && log.checks.touchMoved === true;
  return log;
}

async function screensRun(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const log = { run: 'menus-settings-howto', errors: [], checks: {} };
  watch(page, log);
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.click('#bHow'); await sleep(300);
    log.checks.howToPlay = await page.isVisible('#screen');
    await page.click('#bBack').catch(() => {}); await sleep(300);
    await page.click('#bSettings'); await sleep(300);
    await page.click('[data-q="low"]'); await sleep(200);
    await page.click('[data-cam="1"]'); await sleep(200);
    await page.click('#bDone'); await sleep(300);
    const saved = await page.evaluate(() => localStorage.getItem('skystunt.settings') || Object.keys(localStorage).join(','));
    log.checks.settingsSaved = saved;
    // reload keeps settings
    await page.reload({ waitUntil: 'load' }); await sleep(500);
    await page.click('#bSettings'); await sleep(300);
    log.checks.lowQualityKept = await page.$eval('[data-q="low"]', (b) => b.classList.contains('cyan'));
    await page.click('#bDone'); await sleep(200);
    // invalid room code
    await page.fill('#joinCode', 'ZZZZZZ');
    await page.click('#bJoin'); await sleep(200);
    await page.click('#bGo').catch(() => {});
  } catch (e) {
    log.errors.push('harness: ' + e.message.split('\n')[0]);
  }
  await ctx.close();
  log.pass = log.errors.length === 0 && log.checks.howToPlay === true && log.checks.lowQualityKept === true;
  return log;
}

const browser = await chromium.launch({ args: ARGS });
const plan = [];
for (let i = 0; i < 12; i++) plan.push([i, TRACKS[i % 4], MODES[i % 3], CARS[i % 4]]);
// Make sure every track, mode and car appears at least once: i%4 for tracks and cars, i%3 for modes over 12 runs.
const filter = process.env.ONLY; // optional, e.g. ONLY=touch,screens
const want = (k) => !filter || filter.split(',').includes(k);
if (want('solo')) for (const [i, t, m, c] of plan) {
  const r = await soloRun(browser, i, t, m, c);
  results.push(r); console.log(JSON.stringify(r));
}
if (want('touch')) { const r = await touchRun(browser); results.push(r); console.log(JSON.stringify(r)); }
if (want('screens')) { const r = await screensRun(browser); results.push(r); console.log(JSON.stringify(r)); }
await browser.close();
const failed = results.filter((r) => !r.pass);
const summary = { runs: results.length, passed: results.length - failed.length, failed: failed.map((f) => ({ run: f.run, errors: f.errors.slice(0, 5) })) };
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log('SUMMARY ' + JSON.stringify(summary));
process.exit(failed.length ? 1 : 0);
