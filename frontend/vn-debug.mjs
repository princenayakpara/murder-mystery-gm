import { chromium } from 'playwright';

const [, , sessionJson] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173/__nonexistent__').catch(() => {});
await page.evaluate((session) => localStorage.setItem('mm_session', session), sessionJson);
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForSelector('.vn-stage', { timeout: 10000 });
await page.waitForTimeout(1000);

const info = await page.evaluate(() => {
  function rect(sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { sel, top: r.top, bottom: r.bottom, height: r.height, position: cs.position, overflow: cs.overflow };
  }
  return [
    rect('.vn-stage'),
    rect('.vn-scene-layer'),
    rect('.vn-scene-content'),
    rect('.vn-portrait-row'),
    rect('.vn-dialogue-box'),
  ];
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
