/** Dump the live horse skeleton+skin as GLB via the __GAME.exportHorse hook. */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${url}/?capture=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__GAME && window.__GAME.ready === true, null, { timeout: 180000, polling: 250 });
const dl = page.waitForEvent('download', { timeout: 60000 });
await page.evaluate(() => window.__GAME.exportHorse());
const download = await dl;
const out = path.resolve(ROOT, '../..', 'staging/horse/horse_ingame.glb');
await download.saveAs(out);
console.log('saved', out);
await browser.close();
await server.close();
