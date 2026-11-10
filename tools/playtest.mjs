/**
 * Scripted playtest: walk, approach horse, mount, ride — screenshot each phase.
 *   node tools/playtest.mjs --out shots/_play
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const outDir = path.resolve(ROOT, process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1] : 'shots/_play');
await mkdir(outDir, { recursive: true });

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${url}/?quality=medium`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });

const info = await page.evaluate(() => {
  const g = window.__GAME, p = g.ctx.systems.get('player');
  const horses = [];
  g.ctx.scene.traverse((o) => { if (o.name && /horse/i.test(o.name) && horses.length < 4) horses.push(o.name); });
  return {
    mode: p.mode, pos: p.group.position.toArray().map(v => +v.toFixed(1)),
    horse: p._horse ? p._horse.group.position.toArray().map(v => +v.toFixed(1)) : null,
    horses,
  };
});
console.log('start', JSON.stringify(info));

async function shot(name, waitMs = 0) {
  if (waitMs) await page.waitForTimeout(waitMs);
  await page.screenshot({ path: path.join(outDir, name + '.png') });
  const st = await page.evaluate(() => {
    const p = window.__GAME.ctx.systems.get('player');
    return { mode: p.mode, trans: p.trans ? p.trans.kind : null };
  });
  console.log(name, JSON.stringify(st));
}

// face the horse and walk toward it
await shot('00_spawn', 1500);
await page.evaluate(() => {
  const g = window.__GAME, p = g.ctx.systems.get('player');
  const h = p._horse;
  if (h) {
    const d = h.group.position.clone().sub(p.group.position);
    p.yaw = Math.atan2(d.x, d.z); p.bodyYaw = p.yaw; p.moveYaw = p.yaw;
  }
});
await page.keyboard.down('w');
await shot('01_walk', 1600);
await shot('02_walk', 1400);
await page.keyboard.up('w');
// mount
await page.keyboard.press('e');
await shot('03_mounting', 700);
await shot('04_mounted', 1600);
// ride
await page.keyboard.down('w');
await shot('05_ride', 1800);
await shot('06_ride', 1800);
await page.keyboard.up('w');
await browser.close(); await server.close(); process.exit(0);
