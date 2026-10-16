// Touch and layout test. Phone landscape (touch), phone portrait (rotate hint), desktop (keyboard).
// Multi-touch uses CDP Input.dispatchTouchEvent so two fingers can be down at once.
// Usage: node tests/browser/mobile-ui.mjs [url] [outDir]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const URL = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || '/tmp/mobile-ui';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function startSolo(page) {
  await page.click('#bSolo');
  await page.click('[data-car="bolt"]'); await sleep(200);
  await page.click('#bGo');
  await page.waitForSelector('#hud.live', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#hud .countdown')?.classList.contains('hide'), null, { timeout: 40000 });
  await sleep(500);
}
const center = async (page, sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
const touchOps = async (cdp, type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

// ---- Phone, landscape (844x390, touch) ----
{
  const errors = [];
  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  const cls = await page.evaluate(() => document.body.className + ' | ' + document.body.dataset.device);
  check('phone landscape: body classes detect touch + phone + landscape', /is-touch/.test(cls) && /is-phone/.test(cls) && /is-landscape/.test(cls), cls);
  await startSolo(page);
  const touchShown = await page.$eval('.touch', (el) => getComputedStyle(el).display !== 'none').catch(() => false);
  check('phone race: touch controls shown', touchShown);
  const boxes = {};
  for (const sel of ['.wheel', '.tbtn.gas', '.tbtn.brake', '.tbtn.boost', '.tbtn.drift', '.tcamBtn.cur']) {
    boxes[sel] = await center(page, sel);
  }
  const inside = Object.values(boxes).every((b) => b.x > 0 && b.y > 0 && b.x < 844 && b.y < 390 && b.w >= 40);
  check('phone race: all controls inside the 844x390 screen and at least 40 px', inside);
  const overlap = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
  const names = Object.keys(boxes);
  const clashes = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (overlap(boxes[names[i]], boxes[names[j]])) clashes.push(names[i] + '/' + names[j]);
  check('phone race: controls do not overlap', clashes.length === 0, clashes.join(', ') || 'none');
  await page.screenshot({ path: path.join(OUT, 'phone-landscape.jpg'), type: 'jpeg', quality: 80 });

  // Two-finger test: gas (finger 0) + boost (finger 1); lift gas, keep boost. Boost must keep the car accelerating.
  const cdp = await page.context().newCDPSession(page);
  const g = boxes['.tbtn.gas'], b = boxes['.tbtn.boost'];
  await touchOps(cdp, 'touchStart', [{ x: g.x, y: g.y, id: 0 }]);
  await sleep(100);
  await touchOps(cdp, 'touchStart', [{ x: g.x, y: g.y, id: 0 }, { x: b.x, y: b.y, id: 1 }]);
  await sleep(80);
  const both = await page.evaluate(() => skystunt.game.controls.read(0.016));
  check('two fingers: gas + boost gives throttle and boost', both.th === 1 && both.bo === 1, JSON.stringify(both));
  await touchOps(cdp, 'touchEnd', [{ x: g.x, y: g.y, id: 0 }]);   // lift the GAS finger, keep boost held
  await sleep(80);
  const boostOnly = await page.evaluate(() => skystunt.game.controls.read(0.016));
  check('boost alone (gas released): boost still sets throttle', boostOnly.th === 1 && boostOnly.bo === 1, JSON.stringify(boostOnly));
  await touchOps(cdp, 'touchStart', [{ x: b.x, y: b.y, id: 1 }]);   // re-press boost with gas already released
  await sleep(80);
  const boostNoGas = await page.evaluate(() => skystunt.game.controls.read(0.016));
  check('press boost without gas: throttle and boost both on', boostNoGas.th === 1 && boostNoGas.bo === 1, JSON.stringify(boostNoGas));
  await touchOps(cdp, 'touchEnd', [{ x: b.x, y: b.y, id: 1 }]);
  await sleep(80);
  // Hold gas for 2.5 s; the sim must receive throttle and the car must reach speed (peak speed sampled).
  await touchOps(cdp, 'touchStart', [{ x: g.x, y: g.y, id: 0 }]);
  let peak = 0, simTh = 0;
  for (let i = 0; i < 12; i++) {
    await sleep(200);
    const s = await page.evaluate(() => {
      const g2 = skystunt.game;
      const car = g2.sim && g2.sim.byId ? g2.sim.byId.get('player') : null;
      const f = g2.lastFrame && g2.lastFrame.cars.find((c) => c[0] === g2.meId);
      return { th: car ? car.input.th : -1, v: f ? f[8] : 0 };
    });
    peak = Math.max(peak, s.v); simTh = Math.max(simTh, s.th);
  }
  await touchOps(cdp, 'touchEnd', [{ x: g.x, y: g.y, id: 0 }]);
  check('gas pedal reaches the sim as throttle and speeds the car (touch)', simTh === 1 && peak > 3, `sim throttle ${simTh}, peak speed ${peak.toFixed(1)} m/s`);

  // Steering wheel: drag from 3 o'clock to 12 o'clock (counter-clockwise) = steer left (negative).
  const w = boxes['.wheel'];
  const R = w.w / 2 - 10;
  await touchOps(cdp, 'touchStart', [{ x: w.x + R, y: w.y, id: 2 }]);
  await sleep(60);
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    await touchOps(cdp, 'touchMove', [{ x: w.x + R * Math.cos(a), y: w.y - R * Math.sin(a), id: 2 }]);
    await sleep(16);
  }
  const wheelDown = await page.evaluate(() => skystunt.game.controls.touch.wheel);
  const stDuring = await page.evaluate(() => skystunt.game.controls.read(0.016).st);
  check('wheel drag left 90 degrees steers left', wheelDown < -0.5 && stDuring < -0.3, `wheel ${wheelDown.toFixed(2)}, st ${stDuring.toFixed(2)}`);
  await touchOps(cdp, 'touchEnd', [{ x: w.x, y: w.y - R, id: 2 }]);
  await sleep(60);
  const wheelUp = await page.evaluate(() => skystunt.game.controls.touch.wheel);
  check('wheel returns to centre on release', wheelUp === 0, `wheel ${wheelUp}`);

  // Camera buttons: next changes the camera mode, previous goes back.
  const c0 = await page.evaluate(() => skystunt.game.camMode);
  const nx = await center(page, '.tcamBtn.next');
  await touchOps(cdp, 'touchStart', [{ x: nx.x, y: nx.y, id: 3 }]); await touchOps(cdp, 'touchEnd', [{ x: nx.x, y: nx.y, id: 3 }]);
  await sleep(80);
  const c1 = await page.evaluate(() => skystunt.game.camMode);
  const pv = await center(page, '.tcamBtn.prev');
  await touchOps(cdp, 'touchStart', [{ x: pv.x, y: pv.y, id: 4 }]); await touchOps(cdp, 'touchEnd', [{ x: pv.x, y: pv.y, id: 4 }]);
  await sleep(80);
  const c2 = await page.evaluate(() => skystunt.game.camMode);
  check('camera buttons: next then previous change the view', c1 === (c0 + 1) % 7 && c2 === c0, `${c0} -> ${c1} -> ${c2}`);
  check('phone race: no console errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  await ctx.close();
}

// ---- Phone, portrait: rotate hint ----
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await startSolo(page);
  const disp = await page.$eval('#rotate', (el) => getComputedStyle(el).display);
  check('phone portrait during race: rotate hint is shown', disp === 'flex', `display ${disp}`);
  await page.screenshot({ path: path.join(OUT, 'phone-portrait.jpg'), type: 'jpeg', quality: 80 });
  check('phone portrait: no page errors', errors.length === 0, errors.join(' | ') || 'none');
  await ctx.close();
}

// ---- Desktop (1280x720, mouse + keyboard) ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'load' });
  const cls = await page.evaluate(() => document.body.className);
  check('desktop: body classes detect keyboard + desktop + landscape', /is-keyboard/.test(cls) && /is-desktop/.test(cls) && /is-landscape/.test(cls), cls);
  await startSolo(page);
  const touchCount = await page.$$eval('.touch', (els) => els.length);
  check('desktop race: no touch controls rendered', touchCount === 0, `count ${touchCount}`);
  await page.screenshot({ path: path.join(OUT, 'desktop.jpg'), type: 'jpeg', quality: 80 });
  check('desktop: no console errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  await ctx.close();
}

await browser.close();
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
