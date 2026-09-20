import { chromium } from 'playwright';
const file = 'file:///private/tmp/claude-501/-Users-owenkleinhans/5cdb79aa-e9b0-4da5-89d1-31a54b7058ac/scratchpad/landing-rework/Landing%20Page.dc.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(file, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(async () => {
   const h = document.documentElement.scrollHeight;
   for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
   window.scrollTo(0, 0);
   await new Promise(r => setTimeout(r, 400));
});
await page.waitForTimeout(1000);
const total = await page.evaluate(() => document.documentElement.scrollHeight);
const slices = JSON.parse(process.argv[2]);
for (const [name, y, h] of slices) {
   await page.screenshot({ path: `shots/dz-${name}.png`, fullPage: true, clip: { x: 0, y, width: 390, height: Math.min(h, total - y) } });
   console.log(`  dz-${name}.png  y=${y} h=${Math.min(h, total - y)}`);
}
console.log('total', total);
await browser.close();
