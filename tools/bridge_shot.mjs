import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[err]', e.message));
await page.goto(`${url}/?quality=medium&capture=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });
await page.evaluate(() => {
  const g = window.__GAME;
  g.setupShot({ name: 'bridge', tod: 17.6, weather: 'fair', cam: { pos: 'logbridge', look: 'logbridge', fov: 50 } });
  g.renderFrames(60);
});
const dbg = await page.evaluate(() => {
  const g = window.__GAME;
  const cam = g.engine.camera.position;
  return {
    cam: cam.toArray().map(v => +v.toFixed(1)),
    groundAtCam: +g.ctx.world.getHeight(cam.x, cam.z).toFixed(1),
    wsAtCam: +g.ctx.world.waterSurfaceAt(cam.x, cam.z).toFixed(1),
    submerged: g.ctx.env.cameraSubmerged,
  };
});
console.log('dbg', JSON.stringify(dbg));
await page.screenshot({ path: 'shots/_w4/bridge.png' });
await browser.close(); await server.close(); process.exit(0);
