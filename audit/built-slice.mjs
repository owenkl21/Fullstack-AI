import { launch, context, open, PHONE } from './lib.mjs';
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true, reducedMotion: 'reduce', deviceScaleFactor: 2 });
const page = await ctx.newPage();
await open(page, '/', 4000);
await page.evaluate(async () => {
   const h = document.documentElement.scrollHeight;
   for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 45)); }
   window.scrollTo(0, 0);
   await new Promise(r => setTimeout(r, 400));
});
await page.waitForTimeout(1000);
const total = await page.evaluate(() => document.documentElement.scrollHeight);
for (const [name, y, h] of JSON.parse(process.argv[2])) {
   await page.screenshot({ path: `shots/bz-${name}.png`, fullPage: true, clip: { x: 0, y, width: 390, height: Math.min(h, total - y) } });
   console.log(`  bz-${name}.png y=${y}`);
}
console.log('total', total);
await browser.close();
