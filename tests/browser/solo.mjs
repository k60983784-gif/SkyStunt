// Solo (offline) race test in headless Chromium: start a race, drive with the keyboard, read HUD, screenshot.
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:8080/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.click('#bSolo');
await page.click('#bGo');
await page.waitForSelector('#hud.live', { timeout: 15000 });
const badge = await page.textContent('#hud .statusTag');
await page.waitForTimeout(9000); // countdown (software GL is slow)
const cd = await page.textContent('#hud .countdown');
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(25000);
const speed = await page.textContent('#hud .speed');
const place = await page.textContent('#hud .place');
const timer = await page.textContent('#hud .timer');
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(800);
await page.keyboard.up('ArrowLeft');
await page.screenshot({ path: '/tmp/solo-race.png' });
await page.keyboard.up('ArrowUp');
const stats = await page.evaluate(() => ({ fps: null }));
console.log(JSON.stringify({ statusTag: badge, countdownSeen: cd, speedKmh: speed, place, timer, errors: errors.slice(0, 10), errorCount: errors.length }, null, 2));
await browser.close();
