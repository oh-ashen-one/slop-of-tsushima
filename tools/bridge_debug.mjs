import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[err]', e.message));
await page.goto(`${url}/?quality=medium&capture=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });
const out = await page.evaluate(async () => {
  const g = window.__GAME;
  const { findCrossing } = await import('/src/world/town/LogBridge.js');
  const camp = g.ctx.poi.get('camp');
  const p = camp.pos || camp;
  const wl = g.ctx.world.waterLevel;
  // scan the river polyline coarsely for wet + narrow spots
  const { RIVER_PTS } = await import('/src/world/terrain/Field.js');
  const { polylineMetrics } = await import('/src/world/terrain/Noise.js');
  const M = polylineMetrics(RIVER_PTS);
  const wet = [];
  for (let i = 0; i < 40; i++) {
    const target = (i / 39) * M.total;
    for (let s = 0; s < RIVER_PTS.length - 1; s++) {
      const c0 = M.cum[s], c1 = M.cum[s + 1];
      if (target <= c1 || s === RIVER_PTS.length - 2) {
        const u = c1 > c0 ? (target - c0) / (c1 - c0) : 0;
        const px = RIVER_PTS[s][0] + (RIVER_PTS[s + 1][0] - RIVER_PTS[s][0]) * u;
        const pz = RIVER_PTS[s][1] + (RIVER_PTS[s + 1][1] - RIVER_PTS[s][1]) * u;
        if (g.ctx.world.isWater(px, pz)) {
          wet.push([Math.round(px), Math.round(pz), Math.round(Math.hypot(px - p.x, pz - p.z))]);
        }
        break;
      }
    }
  }
  // instrumented re-run of the crossing gates
  const diag = { total: 0, wet: 0, banksFound: 0, spanOk: 0, bankY: 0, samples: [] };
  {
    const H = g.ctx.world.getHeight, isWater = g.ctx.world.isWater;
    for (let i = 0; i < 160; i++) {
      const target = (i / 159) * M.total;
      for (let s2 = 0; s2 < RIVER_PTS.length - 1; s2++) {
        const c0 = M.cum[s2], c1 = M.cum[s2 + 1];
        if (target <= c1 || s2 === RIVER_PTS.length - 2) {
          const u = c1 > c0 ? (target - c0) / (c1 - c0) : 0;
          const px = RIVER_PTS[s2][0] + (RIVER_PTS[s2 + 1][0] - RIVER_PTS[s2][0]) * u;
          const pz = RIVER_PTS[s2][1] + (RIVER_PTS[s2 + 1][1] - RIVER_PTS[s2][1]) * u;
          const dl = Math.hypot(px - p.x, pz - p.z);
          if (dl > 900) break;
          diag.total++;
          if (!isWater(px, pz)) break;
          diag.wet++;
          const dx = RIVER_PTS[s2 + 1][0] - RIVER_PTS[s2][0], dz = RIVER_PTS[s2 + 1][1] - RIVER_PTS[s2][1];
          const L = Math.hypot(dx, dz) || 1;
          const qx = -dz / L, qz = dx / L;
          let bankA = null, bankB = null;
          for (let d = 0.75; d <= 30; d += 0.75) {
            if (bankA == null && !isWater(px + qx * d, pz + qz * d)) bankA = d;
            if (bankB == null && !isWater(px - qx * d, pz - qz * d)) bankB = d;
            if (bankA != null && bankB != null) break;
          }
          if (bankA == null || bankB == null) break;
          diag.banksFound++;
          const span = bankA + bankB;
          if (span < 5 || span > 34) break;
          diag.spanOk++;
          const centre = (bankA - bankB) * 0.5;
          const cx = px + qx * centre, cz = pz + qz * centre;
          const bankYA = H(px + qx * (bankA + 0.6), pz + qz * (bankA + 0.6));
          const bankYB = H(px - qx * (bankB + 0.6), pz - qz * (bankB + 0.6));
          if (Math.min(bankYA, bankYB) < H(cx, cz) + 0.25) break;
          diag.bankY++;
          diag.samples.push({ x: Math.round(cx), z: Math.round(cz), span: +span.toFixed(1), dl: Math.round(dl) });
          break;
        }
      }
    }
  }
  const site = findCrossing(g.ctx, p.x, p.z, 900);
  return {
    camp: [Math.round(p.x), Math.round(p.z)], waterLevel: wl,
    wetSpots: wet.slice(0, 12), wetCount: wet.length,
    site: site ? { cx: Math.round(site.cx), cz: Math.round(site.cz), span: +site.span.toFixed(1) } : null,
    diag,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close(); await server.close(); process.exit(0);
