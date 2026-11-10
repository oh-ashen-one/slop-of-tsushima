/**
 * One boot, many knob variants of the same shot — lighting/grade iteration.
 *   node tools/tune.mjs --shot player_third_person --out shots/_tune
 * Edit VARIANTS below.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { SHOTS } from './capture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
function arg(name, dflt = null) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return dflt;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

// Each variant: { name, js } — js runs in page with `g` = window.__GAME, must
// mutate lighting/postfx knobs. Return value ignored.
const VARIANTS = JSON.parse(arg('variants', '[]'));

async function main() {
  const shotName = arg('shot', 'player_third_person');
  const shot = SHOTS[shotName];
  const outDir = path.resolve(ROOT, arg('out', 'shots/_tune'));
  const settle = parseInt(arg('settle', '48'), 10);
  await mkdir(outDir, { recursive: true });

  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const url = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(`${url}/?quality=medium&capture=1`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });

  await page.evaluate((s) => window.__GAME.setupShot(s), { name: shotName, ...shot });
  await page.evaluate((n) => window.__GAME.renderFrames(n), settle);
  await page.screenshot({ path: path.join(outDir, `${shotName}__base.png`) });
  console.log('base done');

  const RESTORE = `{
    const g = window.__GAME, L = g.ctx.systems.get('lighting');
    if (!window.__TUNE_BASE) window.__TUNE_BASE = {
      skyCoolBias: L.skyCoolBias, bounceGain: L.bounceGain,
      lowSunBounceFloor: L.lowSunBounceFloor, bounceDirGain: L.bounceDirGain,
      counterBounce: L.counterBounce, shadowFloor: L.shadowFloor,
      shadowAmbientFloorDay: L.shadowAmbientFloorDay,
      shadowChroma: L.shadowChroma.getHex(),
    };
    const b = window.__TUNE_BASE;
    L.skyCoolBias = b.skyCoolBias; L.bounceGain = b.bounceGain;
    L.lowSunBounceFloor = b.lowSunBounceFloor; L.bounceDirGain = b.bounceDirGain;
    L.counterBounce = b.counterBounce; L.shadowFloor = b.shadowFloor;
    L.shadowAmbientFloorDay = b.shadowAmbientFloorDay;
    L.shadowChroma.setHex(b.shadowChroma);
  }`;
  for (const v of VARIANTS) {
    await page.evaluate((s) => window.__GAME.setupShot(s), { name: shotName, ...shot });
    await page.evaluate(RESTORE + '\n' + v.js);
    await page.evaluate((n) => window.__GAME.renderFrames(n), settle);
    await page.screenshot({ path: path.join(outDir, `${shotName}__${v.name}.png`) });
    console.log(v.name, 'done');
  }
  await browser.close();
  await server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
