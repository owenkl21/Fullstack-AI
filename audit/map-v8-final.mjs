import { launch, context, signIn, shot, PHONE, DESK } from './lib.mjs';

const VIEW = () => {
   const cont = document.querySelector('.leaflet-container');
   if (!cont) return null;
   const cr = cont.getBoundingClientRect();
   const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
   let best = null, bestD = Infinity;
   for (const img of document.querySelectorAll('.leaflet-tile-loaded')) {
      const r = img.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
      const m = img.src.match(/\/(\d+)\/(\d+)\/(\d+)(?:\.png)?(?:\?|$)/);
      if (!m) continue;
      if (d < bestD) { bestD = d; best = { r, m, src: img.src }; }
   }
   if (!best) return null;
   let z, x, y;
   if (/arcgisonline/.test(best.src)) { z = +best.m[1]; y = +best.m[2]; x = +best.m[3]; }
   else { z = +best.m[1]; x = +best.m[2]; y = +best.m[3]; }
   const fx = x + (cx - best.r.left) / best.r.width;
   const fy = y + (cy - best.r.top) / best.r.height;
   const n = Math.pow(2, z);
   return {
      lat: +((Math.atan(Math.sinh(Math.PI * (1 - (2 * fy) / n))) * 180) / Math.PI).toFixed(3),
      lng: +(((fx / n) * 360 - 180)).toFixed(3),
      z,
      containers: document.querySelectorAll('.leaflet-container').length,
   };
};

const browser = await launch();
const ctx = await context(browser, PHONE);
const page = await ctx.newPage();
await signIn(page);
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
const line = [];
for (let i = 0; i < 12; i++) { await page.waitForTimeout(400); line.push(await page.evaluate(VIEW)); }
console.log('== OPENING TIMELINE (400ms steps) ==');
console.log(line.map((v) => (v ? `${v.lat},${v.lng} z${v.z} c${v.containers}` : 'null')).join('\n'));

/* tapping the search must not move the map */
const before = await page.evaluate(VIEW);
await page.locator('input[type=search]').first().click();
await page.waitForTimeout(1200);
const after = await page.evaluate(VIEW);
console.log('\ntap search:', JSON.stringify(before), '->', JSON.stringify(after));

/* the layers sheet with fish, one scroll */
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Layers' }).click();
await page.waitForTimeout(700);
await shot(page, 'map-layers-phone', { x: 0, y: 0, ...PHONE });
console.log('layers sheet scrolls:', JSON.stringify(await page.evaluate(() => {
   const inner = [...document.querySelectorAll('.sheet *')].filter((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible').map((e) => String(e.className).slice(0, 40));
   return inner;
})));
await ctx.close();

/* desktop: the found card and the control row do not meet */
const ctx2 = await context(browser, DESK);
const page2 = await ctx2.newPage();
await signIn(page2);
await page2.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page2.waitForTimeout(3500);
const box = page2.locator('input[type=search]').first();
await box.click();
await box.type('Rooi-Els', { delay: 25 });
await page2.waitForTimeout(2600);
await page2.locator('[role=listbox] [role=option]').first().click();
await page2.waitForTimeout(2000);
console.log('\n== DESK found card vs row ==', JSON.stringify(await page2.evaluate(() => {
   const r = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom), left: Math.round(q.left), right: Math.round(q.right) }; };
   const card = [...document.querySelectorAll('div')].find((d) => String(d.className).includes('z-[620]'));
   const bar = [...document.querySelectorAll('div')].find((d) => String(d.className).includes('bottom-8 left-3'));
   return { card: r(card), bar: r(bar), list: r(document.querySelector('[role=listbox]')) };
})));
await shot(page2, 'map-found-desk', { x: 0, y: 0, ...DESK });
await browser.close();
