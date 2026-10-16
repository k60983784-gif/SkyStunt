// Captures one screenshot per camera view (1-7) in a solo race and checks the HUD camera tag changes.
// Usage: node tests/browser/cameras.mjs <url> [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const URL = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || '/tmp/cams';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const report = [];
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.click('#bSolo');
await page.click('#bGo');
await page.waitForSelector('#hud.live', { timeout: 30000 });
await page.waitForFunction(() => document.querySelector('#hud .countdown')?.classList.contains('hide'), null, { timeout: 40000 });
for (let i = 1; i <= 7; i++) {
  await page.keyboard.press('Digit' + i);
  await sleep(1500);
  const tag = await page.textContent('#hud .camTag');
  await page.screenshot({ path: path.join(OUT, `cam-${i}.jpg`), type: 'jpeg', quality: 70 });
  report.push({ key: i, tag });
}
await browser.close();
console.log(JSON.stringify({ views: report, errors: errors.slice(0, 5), errorCount: errors.length }, null, 2));
process.exit(errors.length ? 1 : 0);
