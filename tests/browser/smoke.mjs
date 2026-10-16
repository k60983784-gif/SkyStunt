// Browser smoke test: loads the production build, checks console/page errors and WebGL, takes a screenshot.
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:8080/';
const out = process.argv[3] || '/tmp/smoke-title.png';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForSelector('#bSolo', { timeout: 15000 });
const webgl = await page.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); });
await page.screenshot({ path: out });
console.log(JSON.stringify({ title: await page.title(), webgl2: webgl, errors }, null, 2));
await browser.close();
