import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${url}/?quality=medium&capture=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });

const VARIANTS = [
  { name: 'bisect_scatter_off', tod: 8.0, weather: 'fair', pos: [0, 80, -360], look: [-120, 45, -450], fov: 42, js: "window.__GAME.ctx.scene.traverse(o=>{ if(o.name==='scatter') o.visible=false; })" },
  { name: 'bisect_scatter_on', tod: 8.0, weather: 'fair', pos: [0, 80, -360], look: [-120, 45, -450], fov: 42 },
];
await mkdir('shots/_reframe', { recursive: true });
for (const v of VARIANTS) {
  await page.evaluate((s) => {
    const g = window.__GAME, T = g.THREE;
    const tod = g.ctx.systems.get('timeOfDay');
    if (tod && tod.setTime) tod.setTime(s.tod);
    const w = g.ctx.systems.get('weather');
    if (w && w.setWeather) w.setWeather(s.weather, { instant: true });
    const rig = g.ctx.systems.get('camera');
    const pos = new T.Vector3(...s.pos), look = new T.Vector3(...s.look);
    if (g.ctx.world.ready) {
      const h = g.ctx.world.getHeight(pos.x, pos.z);
      if (pos.y < h + 1.7) pos.y = h + 1.7;
    }
    rig.setFreeCamera(pos, look, s.fov);
    g.ctx.player.position.copy(pos);
    g.ctx.emit('teleport', pos);
    g.renderFrames(48);
    if (s.js) { try { eval(s.js); g.renderFrames(4); } catch (e) { console.log('js fail', e.message); } }
  }, v);
  await page.screenshot({ path: `shots/_reframe/${v.name}.png` });
  console.log(v.name, 'done');
}
await browser.close(); await server.close(); process.exit(0);
