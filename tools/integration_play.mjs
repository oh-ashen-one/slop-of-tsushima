/**
 * Integration playthrough: spawn -> walk -> mount -> long ride -> shrine -> bridge.
 * Screenshots throughout; logs HUD state, region names, saddle contact, errors.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const outDir = path.resolve(ROOT, 'shots/_integr');
await mkdir(outDir, { recursive: true });

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${url}/?quality=medium`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });

const hud = await page.evaluate(() => {
  const g = window.__GAME, p = g.ctx.systems.get('player');
  return {
    region: g.ctx.systems.get('regions') && g.ctx.systems.get('regions').current,
    mode: p.mode, pos: p.state.position.toArray().map(v => +v.toFixed(0)),
  };
});
console.log('spawn', JSON.stringify(hud));

async function shot(name, ms = 0) {
  if (ms) await page.waitForTimeout(ms);
  await page.screenshot({ path: path.join(outDir, name + '.png') });
  const st = await page.evaluate(() => {
    const g = window.__GAME, p = g.ctx.systems.get('player');
    return { mode: p.mode, pos: p.state.position.toArray().map(v => +v.toFixed(0)) };
  });
  console.log(name, JSON.stringify(st));
}

// walk toward horse
await shot('01_spawn', 1500);
await page.evaluate(() => {
  const g = window.__GAME, p = g.ctx.systems.get('player');
  const h = p._horse;
  if (h) { const d = h.group.position.clone().sub(p.group.position); p.yaw = Math.atan2(d.x, d.z); p.bodyYaw = p.yaw; p.moveYaw = p.yaw; }
});
await page.keyboard.down('w');
await shot('02_walk', 1800);
await page.keyboard.up('w');
await page.keyboard.press('e');
await shot('03_mount', 1500);
// long ride through the field
await page.keyboard.down('w');
await page.keyboard.down('Shift');
await shot('04_gallop', 2600);
await shot('05_gallop', 2600);
await shot('06_gallop', 2600);
await page.keyboard.up('Shift');
await page.keyboard.up('w');
// ride toward the shrine
await page.evaluate(() => {
  const g = window.__GAME, p = g.ctx.systems.get('player');
  const t = g.ctx.poi.get('town_center');
  const tp = t ? (t.pos || t) : null;
  if (tp) {
    const d = tp.clone().sub(p.group.position);
    p.yaw = Math.atan2(d.x, d.z); p.bodyYaw = p.yaw; p.moveYaw = p.yaw;
  }
});
await page.keyboard.down('w');
await shot('07_to_shrine', 3500);
await shot('08_to_shrine', 3500);
await page.keyboard.up('w');
await page.keyboard.press('e'); // dismount
await shot('09_dismount', 1800);
// stand before the shrine
await shot('10_shrine_stand', 800);

const tail = await page.evaluate(() => {
  const g = window.__GAME;
  return {
    stats: g.stats(),
    region: g.ctx.systems.get('regions') && g.ctx.systems.get('regions').current,
  };
});
console.log('final', JSON.stringify(tail.stats ? { draws: tail.stats.drawCalls, frameMs: tail.stats.frameMs, failed: tail.stats.failedSystems } : null));
console.log('region', JSON.stringify(tail.region));
console.log('errors', JSON.stringify(errors.slice(0, 10)));
await browser.close(); await server.close(); process.exit(0);
