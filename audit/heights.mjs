import { launch, context, open, PHONE } from './lib.mjs';
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await open(page, '/', 3500);
await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, 0); });
await page.waitForTimeout(700);
const rows = await page.evaluate(() =>
   [...document.querySelectorAll('section, footer')].map((s) => ({
      id: s.id || s.tagName.toLowerCase(),
      h: Math.round(s.getBoundingClientRect().height),
   }))
);
console.log(rows.map((r) => `  ${r.id.padEnd(12)} ${r.h}px`).join('\n'));
console.log('  total       ', await page.evaluate(() => document.documentElement.scrollHeight) + 'px');
await browser.close();
