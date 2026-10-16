// Solo race with each car: chase (1) and front (3) screenshots, plus console/page errors and model-load warnings.
// Usage: node tests/browser/car-models.mjs <url> [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const URL = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || '/tmp/car-models';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = [];
for (const car of (process.env.CARS || 'bolt,dart,titan,viper').split(',')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.click('#bSolo');
  await page.click(`[data-car="${car}"]`); await sleep(200);
  await page.click('#bGo');
  await page.waitForSelector('#hud.live', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#hud .countdown')?.classList.contains('hide'), null, { timeout: 40000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(OUT, `${car}-chase.jpg`), type: 'jpeg', quality: 75 });
  await page.keyboard.press('Digit3'); await sleep(2500);
  await page.screenshot({ path: path.join(OUT, `${car}-front.jpg`), type: 'jpeg', quality: 75 });
  report.push({ car, errors: errors.slice(0, 6), errorCount: errors.length });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(report.some((r) => r.errorCount) ? 1 : 0);
