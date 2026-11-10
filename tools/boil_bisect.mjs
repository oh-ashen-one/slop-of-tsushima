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
await mkdir('shots/_boil', { recursive: true });

const SHOT = { name: 'forest_interior', tod: 9.3, weather: 'fair', cam: { pos: 'forest', look: 'forest_fwd', fov: 60 } };
const VARIANTS = [
  ['base', ''],
  ['nowind', 'const w=window.__GAME.ctx.systems.get("weather"); if(w){w.cur.wind=0;w.cur.gust=0; window.__GAME.ctx.env.windStrength=0; window.__GAME.ctx.env.windGust=0;}'],
  ['norays', 'const g=window.__GAME; const pf=g.ctx.systems.get("postfx"); if(pf&&pf.film){pf.film.godrays=0;} g.ctx.scene.traverse(o=>{if(o.name&&/god|shaft|ray/i.test(o.name))o.visible=false;});'],
  ['nowind_norays', 'const w=window.__GAME.ctx.systems.get("weather"); if(w){w.cur.wind=0;w.cur.gust=0; window.__GAME.ctx.env.windStrength=0; window.__GAME.ctx.env.windGust=0;} const pf=window.__GAME.ctx.systems.get("postfx"); if(pf&&pf.film){pf.film.godrays=0;}'],
  ['notaa', 'const pf=window.__GAME.ctx.systems.get("postfx"); if(pf){pf.taa=false; pf._taaEnabled=false;}'],
];
for (const [name, js] of VARIANTS) {
  await page.evaluate((s) => window.__GAME.setupShot(s), SHOT);
  if (js) await page.evaluate(js);
  await page.evaluate((n) => window.__GAME.renderFrames(n), 48);
  const dir = `shots/_boil/${name}`;
  await mkdir(dir, { recursive: true });
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => window.__GAME.renderFrames(1));
    await page.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png` });
  }
  console.log(name, 'done');
}
await browser.close(); await server.close(); process.exit(0);
