import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${url}/?quality=medium`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });
await page.evaluate(() => {
  const g = window.__GAME, p = g.ctx.systems.get('player');
  const h = g.ctx.get('horse');
  const d = h.group.position.clone().sub(p.group.position);
  p.yaw = Math.atan2(d.x, d.z); p.bodyYaw = p.yaw; p.moveYaw = p.yaw;
});
await page.waitForTimeout(300);
await page.keyboard.press('e');
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const g = window.__GAME, p = g.ctx.systems.get('player'), T = g.THREE;
  const rig = g.ctx.systems.get('camera');
  const P = p.group.position;
  const yaw = p.yaw;
  // camera: side-on, 3.2m out, at saddle height
  const side = yaw + Math.PI * 0.5;
  const pos = new T.Vector3(P.x + Math.sin(side) * 3.4, P.y + 1.6, P.z + Math.cos(side) * 3.4);
  const look = new T.Vector3(P.x, P.y + 1.1, P.z);
  rig.setFreeCamera(pos, look, 42);
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/_check/saddle_side.png' });
await page.evaluate(() => {
  const g = window.__GAME, p = g.ctx.systems.get('player'), T = g.THREE;
  const rig = g.ctx.systems.get('camera');
  const P = p.group.position;
  const yaw = p.yaw;
  const back = yaw + Math.PI;
  const pos = new T.Vector3(P.x + Math.sin(back) * 3.0, P.y + 1.9, P.z + Math.cos(back) * 3.0);
  const look = new T.Vector3(P.x, P.y + 1.0, P.z);
  rig.setFreeCamera(pos, look, 44);
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/_check/saddle_back.png' });
await browser.close(); await server.close(); process.exit(0);
