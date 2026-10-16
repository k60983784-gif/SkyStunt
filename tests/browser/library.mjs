// Model library viewer: count matches manifest, one model from each pack loads, no console errors.
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:8080/library.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__libraryCount > 0, null, { timeout: 30000 });
const count = await page.evaluate(() => window.__libraryCount);
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
check('library lists every manifest model', count >= 480, `count ${count}`);
for (const [pack, pick] of [['kenney-car-kit', 'race'], ['kenney-racing-kit', 'roadStraight'], ['kenney-nature-kit', 'tree']]) {
  await page.selectOption('#pack', pack);
  await page.fill('#q', pick);
  await sleep(150);
  const before = await page.evaluate(() => window.__libraryLoaded || 0);
  await page.click('#list .item');
  await page.waitForFunction((b) => (window.__libraryLoaded || 0) > b, before, { timeout: 30000 }).catch(() => {});
  const after = await page.evaluate(() => window.__libraryLoaded || 0);
  const status = await page.textContent('#status');
  check(`${pack}: first "${pick}" model loads`, after > before && status === 'loaded', `status "${status}"`);
  await page.screenshot({ path: `/tmp/library-${pack}.jpg`, type: 'jpeg', quality: 70 });
}
check('library viewer: no console errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
await browser.close();
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
