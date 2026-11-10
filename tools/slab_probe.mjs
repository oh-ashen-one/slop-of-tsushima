import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', e => console.log('[err]', e.message));
await page.goto(`${url}/?quality=medium&capture=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });
const out = await page.evaluate(() => {
  const g = window.__GAME, PH = g.ctx.systems.get('physics'), t = g.ctx.systems.get('town');
  const b = t.bridge;
  const found = [];
  if (PH && PH._grid) {
    // dump every static collider near the bridge
    const cells = PH._grid.cells || new Map();
    for (const arr of cells.values()) {
      for (const c of arr) {
        const d = Math.hypot(c.position.x - b.pos.x, c.position.z - b.pos.z);
        if (d < 30) found.push({
          tag: c.tag, shape: c.shape,
          pos: c.position.toArray().map(v => +v.toFixed(2)),
          hx: c.hx, hy: c.hy, hz: c.hz, ux: c.ux, uz: c.uz,
          minX: +c.minX.toFixed(1), maxX: +c.maxX.toFixed(1),
          minY: +c.minY.toFixed(2), maxY: +c.maxY.toFixed(2),
        });
      }
    }
  }
  return {
    bridge: b.pos.toArray().map(v => +v.toFixed(2)),
    gridCount: PH && PH._grid ? PH._grid.count : -1,
    near: found.slice(0, 12),
    groundAtMid: PH ? +PH.groundAt(b.pos.x, b.pos.z, b.pos.y + 0.5, 0.3).toFixed(2) : null,
    groundAtEnd: PH ? +PH.groundAt(b.pos.x - 13, b.pos.z, b.pos.y + 0.5, 0.3).toFixed(2) : null,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close(); await server.close(); process.exit(0);
