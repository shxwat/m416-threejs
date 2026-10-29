// Headless screenshot harness — drives the cached Chromium (no download) to render the
// Vite viewer and capture the WebGL canvas at its native pixel size.
// Usage: node viewer/shot.mjs <mode> <outPath> [widthPx] [port]
import { chromium } from 'playwright-core';

const EXE = '/Users/shashwat/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/' +
  'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const mode = process.argv[2] || 'clay';
const out = process.argv[3] || `renders/${mode}.png`;
const width = process.argv[4] || '1400';
const port = process.argv[5] || process.env.PORT || '5173';
const url = `http://localhost:${port}/?mode=${mode}&w=${width}`;

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: [
    '--ignore-gpu-blocklist', '--enable-webgl', '--enable-unsafe-webgpu',
    '--use-angle=metal', '--enable-gpu-rasterization',
  ],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(url, { waitUntil: 'load', timeout: 30000 });
try {
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
} catch {
  console.error('WARN: __ready not set within timeout');
}
await page.waitForTimeout(700); // let textures/env settle
const canvas = await page.$('canvas');
if (!canvas) { console.error('no canvas'); process.exit(2); }
await canvas.screenshot({ path: out });
const hud = await page.$eval('#hud', (e) => e.textContent).catch(() => '');
console.log('shot ->', out);
console.log('hud:', hud);
if (errors.length) console.log('console errors:\n' + errors.slice(0, 12).join('\n'));
await browser.close();
