// For each track: opens a solo race, waits until the Kenney kit props are instanced into the scene, checks counts, and saves a screenshot.
// Usage: node tests/browser/track-props.mjs <url> [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const URL = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || '/tmp/track-props';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRACKS = ['neon_skyline', 'canyon_skyway', 'volcanic_ruins', 'glacier_overpass'];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const checks = [];
for (const id of TRACKS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.click('#bSolo');
  await page.click(`[data-track="${id}"]`);
  await page.click('#bGo');
  await page.waitForSelector('#hud.live', { timeout: 30000 });
  // Props load asynchronously; wait until at least one instanced prop mesh with instances exists.
  let stats = null;
  for (let i = 0; i < 60; i++) {
    stats = await page.evaluate(() => {
      const scene = window.skystunt?.game?.world?.scene;
      if (!scene) return null;
      let meshes = 0, instances = 0;
      scene.traverse((o) => { if (o.isInstancedMesh && o.count > 0 && o.userData.kit !== false) { meshes++; instances += o.count; } });
      return { meshes, instances };
    });
    if (stats && stats.instances > 0) break;
    await sleep(500);
  }
  await page.waitForFunction(() => document.querySelector('#hud .countdown')?.classList.contains('hide'), null, { timeout: 40000 }).catch(() => {});
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: 'jpeg', quality: 70 });
  results.push({ track: id, instancedMeshes: stats?.meshes ?? 0, instances: stats?.instances ?? 0, errors: errors.length, firstErrors: errors.slice(0, 3) });
  checks.push({ name: `${id}: kit props in scene`, ok: (stats?.instances ?? 0) > 0 });
  checks.push({ name: `${id}: no console errors`, ok: errors.length === 0 });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
const pass = checks.filter((c) => c.ok).length;
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`);
console.log(`\n${pass}/${checks.length} checks passed`);
process.exit(pass === checks.length ? 0 : 1);
