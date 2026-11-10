import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto(`${url}/?quality=medium&capture=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });
const out = await page.evaluate(() => {
  const g = window.__GAME, e = g.ctx.env, L = g.ctx.systems.get('lighting');
  g.setupShot({ name: 'player_third_person', tod: 17.2, weather: 'fair', cam: { pos: 'player_ots', look: 'player_fwd', fov: 48 } });
  g.renderFrames(30);
  const p = g.ctx.systems.get('postfx');
  const pf = (() => {
    const pl = g.ctx.systems.get('player');
    let head = null, front = null, hips = null;
    pl.group.traverse(o => { if (o.name === 'Head') head = o; if (o.name === 'headfront') front = o; if (o.name === 'Hips') hips = o; });
    if (!head || !front) return { ronin: !!pl.ronin, found: false };
    const T = g.THREE;
    const hw = head.getWorldPosition(new T.Vector3());
    const fw = front.getWorldPosition(new T.Vector3());
    const d = fw.clone().sub(hw); d.y = 0; d.normalize();
    const gq = pl.group.getWorldQuaternion(new T.Quaternion());
    const gf = new T.Vector3(0, 0, 1).applyQuaternion(gq);
    const hp = hips ? hips.getWorldPosition(new T.Vector3()) : null;
    return {
      ronin: !!pl.ronin, found: true,
      faceDir: { x: +d.x.toFixed(3), z: +d.z.toFixed(3) },
      groupFwd: { x: +gf.x.toFixed(3), z: +gf.z.toFixed(3) },
      hipsY: hp ? +hp.y.toFixed(3) : null,
      groupY: +pl.group.position.y.toFixed(3),
      groundY: +g.ctx.world.getHeight(pl.group.position.x, pl.group.position.z).toFixed(3),
    };
  })();
  const bi = (() => {
    const t = g.ctx.systems.get('town');
    const b = t && t.bridge;
    if (!b) return { bridge: false };
    const wl = g.ctx.world.waterLevel;
    return {
      bridge: true,
      pos: b.pos.toArray().map(v => +v.toFixed(1)),
      waterLevel: +wl.toFixed(1),
      groundAtBridge: +g.ctx.world.getHeight(b.pos.x, b.pos.z).toFixed(1),
      isWaterAtBridge: g.ctx.world.isWater(b.pos.x, b.pos.z),
      wsAtBridge: g.ctx.world.waterSurfaceAt ? g.ctx.world.waterSurfaceAt(b.pos.x, b.pos.z) : 'n/a',
      poiCam: g.ctx.poi.get('logbridge') ? g.ctx.poi.get('logbridge').pos.toArray().map(v => +v.toFixed(1)) : null,
      camp: g.ctx.poi.get('camp') ? g.ctx.poi.get('camp').pos.toArray().map(v => +v.toFixed(1)) : null,
    };
  })();
  // scan the ray from the dawn camera to the tower for a height spike
  const spike = (() => {
    const H = g.ctx.world.getHeight;
    const out = [];
    for (let t = 0.2; t <= 1.0; t += 0.05) {
      const x = 200 + (-260 - 200) * t, z = -260 + (-540 + 260) * t;
      out.push([Math.round(x), Math.round(z), +H(x, z).toFixed(1)]);
    }
    return out;
  })();
  const townAt = (() => {
    const t = g.ctx.poi.get('town_center');
    if (!t) return null;
    const p2 = t.pos || t;
    return [Math.round(p2.x), Math.round(p2.z)];
  })();
  return {
    townAt,
    spike,
    bridgeInfo: bi,
    playerFace: pf,
    sunColor: e.sunColor && { r: e.sunColor.r, g: e.sunColor.g, b: e.sunColor.b },
    sunIntensity: e.sunIntensity,
    ambientColor: e.ambientColor && { r: e.ambientColor.r, g: e.ambientColor.g, b: e.ambientColor.b },
    ambientIntensity: e.ambientIntensity,
    daylight: e.daylight, twilight: e.twilight,
    sunDir: e.sunDirection && { x: e.sunDirection.x, y: e.sunDirection.y, z: e.sunDirection.z },
    hemiSky: L.hemi.color, hemiGround: L.hemi.groundColor,
    sunI: L.sun.intensity,
    exposureCPU: p._exposureCPU,
    filmBias: p.film.exposureBias,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close(); await server.close(); process.exit(0);
