import { launch, context, signIn, shot, DESK } from './lib.mjs';
const browser = await launch();
const ctx = await context(browser, DESK);
const page = await ctx.newPage();
await signIn(page);
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page.waitForTimeout(4000);
/* break the clusters apart */
for (let i = 0; i < 6; i++) {
   const n = await page.locator('.map-pin-spot:not(.map-pin-drop)').count();
   if (n) break;
   await page.locator('.map-pin-cluster').first().click();
   await page.waitForTimeout(1200);
}
const spots = await page.locator('.map-pin-spot:not(.map-pin-drop)').count();
await page.locator('.map-pin-spot:not(.map-pin-drop)').first().click({ force: true });
await page.waitForTimeout(1200);
console.log('spot pins:', spots, 'popup:', JSON.stringify(await page.evaluate(() => {
   const p = document.querySelector('.leaflet-popup');
   if (!p) return null;
   const r = p.getBoundingClientRect();
   return { text: p.innerText.replace(/\n+/g, ' | ').slice(0, 200), top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width) };
})));
await shot(page, 'map-pin-desk', { x: 0, y: 0, ...DESK });

/* and the same pin on a phone opens the sheet */
const ctx2 = await context(browser, { width: 390, height: 844 });
const page2 = await ctx2.newPage();
await signIn(page2);
await page2.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page2.waitForTimeout(4000);
for (let i = 0; i < 6; i++) {
   const n = await page2.locator('.map-pin-spot:not(.map-pin-drop)').count();
   if (n) break;
   await page2.locator('.map-pin-cluster').first().click();
   await page2.waitForTimeout(1200);
}
await page2.locator('.map-pin-spot:not(.map-pin-drop)').first().click({ force: true });
await page2.waitForTimeout(1000);
console.log('phone sheet:', JSON.stringify(await page2.evaluate(() => {
   const s = document.querySelector('.sheet');
   if (!s) return null;
   const r = s.getBoundingClientRect();
   return { text: s.innerText.replace(/\n+/g, ' | ').slice(0, 200), top: Math.round(r.top), bottom: Math.round(r.bottom) };
})));
await shot(page2, 'map-pin-sheet-phone', { x: 0, y: 0, width: 390, height: 844 });

/* another angler's pin, to see Keep */
await page2.keyboard.press('Escape');
await page2.waitForTimeout(600);
const others = await page2.locator('.map-pin-other').count();
if (others) {
   await page2.locator('.map-pin-other').first().click({ force: true });
   await page2.waitForTimeout(900);
   console.log('other sheet:', JSON.stringify(await page2.evaluate(() => document.querySelector('.sheet')?.innerText.replace(/\n+/g, ' | ').slice(0, 220) ?? null)));
   await shot(page2, 'map-pin-other-phone', { x: 0, y: 0, width: 390, height: 844 });
}
await browser.close();
