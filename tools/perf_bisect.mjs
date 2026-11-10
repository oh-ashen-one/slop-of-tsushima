import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${url}/?quality=ultra&capture=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });

const SHOT = { name: 'forest_interior', tod: 9.3, weather: 'fair', cam: { pos: 'forest', look: 'forest_fwd', fov: 60 } };
async function measure(name, js) {
  await page.evaluate((s) => window.__GAME.setupShot(s), SHOT);
  if (js) await page.evaluate(js);
  await page.evaluate((n) => window.__GAME.renderFrames(n), 40);
  const ms = await page.evaluate(() => {
    const g = window.__GAME;
    const gl = g.engine.renderer.getContext();
    g.renderFrames(4);
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    g.renderFrames(30);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return (performance.now() - t0) / 30;
  });
  console.log(name.padEnd(18), ms.toFixed(1), 'ms');
  return ms;
}
await measure('baseline', '');
await measure('no-ssao-ssr', 'const pf=window.__GAME.ctx.systems.get("postfx"); if(pf){pf.useAO=false;pf.useSSR=false;pf._aoStrength=0;}');
await measure('no-taa', 'const pf=window.__GAME.ctx.systems.get("postfx"); if(pf){pf.useTAA=false;pf.taaEnabled=false;}');
await measure('no-vol', 'const pf=window.__GAME.ctx.systems.get("postfx"); if(pf) pf.useVol=false;');
await measure('no-csm', 'const L=window.__GAME.ctx.systems.get("lighting"); if(L&&L.csm){L.csm.strength=0; L.csm.update=()=>{};}');
await measure('no-shadows-first', 'window.__GAME.engine.renderer.shadowMap.enabled=false;');
await measure('baseline2', 'window.__GAME.engine.renderer.shadowMap.enabled=true;');
await measure('no-grass', 'window.__GAME.ctx.scene.traverse(o=>{if(o.name&&o.name.startsWith("grass_band"))o.visible=false;})');
await measure('no-trees', 'window.__GAME.ctx.scene.traverse(o=>{if(o.name&&/veg|tree|forest/i.test(o.name))o.visible=false;})');
await measure('no-clouds', 'window.__GAME.ctx.scene.traverse(o=>{if(o.name&&/cloud/i.test(o.name))o.visible=false;})');
await measure('no-terrain', 'window.__GAME.ctx.scene.traverse(o=>{if(o.name&&/terrain/i.test(o.name))o.visible=false;})');
await measure('no-shadows', 'window.__GAME.engine.renderer.shadowMap.enabled=false;');
await measure('lowres', 'window.__GAME.engine.renderer.setPixelRatio(0.6);');
await measure('no-postfx-off', 'const pf=window.__GAME.ctx.systems.get("postfx"); if(pf){pf.volumetrics=false; pf.film&&Object.assign(pf.film,{bloom:0,dof:false});}');
await browser.close(); await server.close(); process.exit(0);
