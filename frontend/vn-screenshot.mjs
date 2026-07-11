import { chromium } from 'playwright';

const [, , sessionJson, outPath, viewportWidth, viewportHeight] = process.argv;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(viewportWidth) || 1400, height: Number(viewportHeight) || 900 } });
await page.goto('http://localhost:5173/__nonexistent__').catch(() => {});
await page.evaluate((session) => localStorage.setItem('mm_session', session), sessionJson);
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForSelector('.vn-stage', { timeout: 10000 }).catch((e) => console.error('vn-stage wait failed:', e.message));
await page.waitForTimeout(1200);
await page.screenshot({ path: outPath });
await browser.close();
console.log('Screenshot saved to', outPath);
