import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[err]', e.message));
await page.goto(`${url}/?quality=medium`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });
const setup = await page.evaluate(() => {
  const g = window.__GAME, p = g.ctx.systems.get('player'), t = g.ctx.systems.get('town');
  const b = t.bridge;
  // teleport to one end of the deck, facing across
  const site = b.axis; // [qx, qz] span dir
  const start = { x: b.pos.x - site[0] * 14, z: b.pos.z - site[1] * 14 };
  p.group.position.set(start.x, g.ctx.world.getHeight(start.x, start.z) + 0.1, start.z);
  p.yaw = Math.atan2(site[0], site[1]); p.bodyYaw = p.yaw; p.moveYaw = p.yaw;
  p.state.position.copy(p.group.position);
  return { start, deckY: b.pos.y, axis: site };
});
console.log('setup', JSON.stringify(setup));
await page.waitForTimeout(400);
await page.keyboard.down('w');
const ys = [];
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => {
    const g = window.__GAME, p = g.ctx.systems.get('player');
    return {
      pos: p.state.position.toArray().map(v => +v.toFixed(2)),
      mode: p.mode,
      grounded: p.state.grounded,
      gy: +g.ctx.world.getHeight(p.state.position.x, p.state.position.z).toFixed(2),
      solid: g.ctx.systems.get('physics')
        ? +g.ctx.systems.get('physics').groundAt(p.state.position.x, p.state.position.z, p.state.position.y + 0.5, 0.3).toFixed(2)
        : null,
    };
  });
  ys.push(st);
  if (i === 5) await page.screenshot({ path: 'shots/_w4/bridge_walk.png' });
}
await page.keyboard.up('w');
console.log(ys.map(s => `${s.pos[0]},${s.pos[1]},${s.pos[2]} ${s.mode} gy=${s.gy} solid=${s.solid} gr=${s.grounded}`).join('\n'));
await page.screenshot({ path: 'shots/_w4/bridge_walk_end.png' });
await browser.close(); await server.close(); process.exit(0);
