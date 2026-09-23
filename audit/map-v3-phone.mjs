import { launch, context, signIn, shot, PHONE } from './lib.mjs';

const VIEW = () => {
   const cont = document.querySelector('.leaflet-container');
   if (!cont) return null;
   const cr = cont.getBoundingClientRect();
   const cx = cr.left + cr.width / 2;
   const cy = cr.top + cr.height / 2;
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
   const lng = (fx / n) * 360 - 180;
   const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * fy) / n)));
   return { lat: +((latRad * 180) / Math.PI).toFixed(4), lng: +lng.toFixed(4), z };
};

const PINS = () => ({
   spot: document.querySelectorAll('.map-pin-spot:not(.map-pin-drop)').length,
   other: document.querySelectorAll('.map-pin-other').length,
   cluster: document.querySelectorAll('.map-pin-cluster').length,
   waypoint: document.querySelectorAll('.map-pin-waypoint').length,
   drop: document.querySelectorAll('.map-pin-drop').length,
});

const browser = await launch();
const ctx = await context(browser, PHONE);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await signIn(page);
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page.waitForTimeout(3500);

/* ---- 1. the view settles once, no rebuild jump ---- */
console.log('== OPEN ==', JSON.stringify(await page.evaluate(VIEW)), JSON.stringify(await page.evaluate(PINS)));

/* ---- 2. search somewhere far, then one tap of Locate ---- */
const box = page.locator('input[type=search]').first();
await box.click();
await box.fill('');
await box.type('Vaal Dam', { delay: 25 });
await page.waitForTimeout(2600);
await page.locator('[role=listbox] [role=option]').first().click();
await page.waitForTimeout(2000);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
console.log('after search:', JSON.stringify(await page.evaluate(VIEW)));

await page.getByRole('button', { name: 'Locate' }).click();
const track = [];
for (let i = 0; i < 6; i++) { await page.waitForTimeout(800); track.push(await page.evaluate(VIEW)); }
console.log('LOCATE, first tap:', JSON.stringify(track));
await shot(page, 'map-locate-phone', { x: 0, y: 0, ...PHONE });

/* ---- 3. layers sheet, and the fish filter on your own spots ---- */
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page.waitForTimeout(3500);
const before = await page.evaluate(PINS);
await page.getByRole('button', { name: 'Layers' }).click();
await page.waitForTimeout(700);
await shot(page, 'map-layers-phone', { x: 0, y: 0, ...PHONE });
const sheetText = await page.locator('.sheet').innerText();
console.log('\n== LAYERS SHEET ==\n' + sheetText.replace(/\n+/g, ' | ').slice(0, 400));
/* choose the first fish */
const fishRows = page.locator('.sheet [role=checkbox]');
const n = await fishRows.count();
await fishRows.nth(3).click();     /* after the three Show rows */
const chosen = await fishRows.nth(3).innerText();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Done' }).click();
await page.waitForTimeout(1200);
const after = await page.evaluate(PINS);
const barText = await page.evaluate(() => document.querySelector('.grid.grid-cols-4')?.innerText.replace(/\n/g, ' | '));
console.log('fish chosen:', JSON.stringify(chosen), 'checkboxes:', n);
console.log('pins before:', JSON.stringify(before), 'after:', JSON.stringify(after));
console.log('bar now:', JSON.stringify(barText));
await shot(page, 'map-fish-phone', { x: 0, y: 0, ...PHONE });

/* ---- 4. a tap on the bar while Mark is armed drops nothing ---- */
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Mark' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Log here' }).hover();
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(800);
console.log('\nbar tap while armed -> url', page.url(), 'drop pins', (await page.evaluate(PINS)).drop);

/* ---- 5. drop a mark by tapping the water, in the sheet ---- */
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Mark' }).click();
await page.waitForTimeout(300);
await page.mouse.click(195, 380);
await page.waitForTimeout(900);
const markSheet = await page.evaluate(() => {
   const s = document.querySelector('.sheet');
   if (!s) return null;
   const r = s.getBoundingClientRect();
   const save = [...s.querySelectorAll('button')].find((b) => /save the mark/i.test(b.innerText));
   const sr = save?.getBoundingClientRect();
   return { top: Math.round(r.top), bottom: Math.round(r.bottom), save: sr ? { top: Math.round(sr.top), bottom: Math.round(sr.bottom) } : null, scrim: Boolean(document.querySelector('.sheet-overlay')) };
});
console.log('\nMARK SHEET:', JSON.stringify(markSheet), 'drop pins', (await page.evaluate(PINS)).drop);
await shot(page, 'map-mark-phone', { x: 0, y: 0, ...PHONE });

/* ---- 6. zoom buttons ---- */
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const z0 = (await page.evaluate(VIEW))?.z;
await page.getByRole('button', { name: 'Zoom in' }).click();
await page.waitForTimeout(1400);
const z1 = (await page.evaluate(VIEW))?.z;
await page.getByRole('button', { name: 'Zoom out' }).click();
await page.waitForTimeout(1400);
const z2 = (await page.evaluate(VIEW))?.z;
console.log('\nzoom:', z0, '->', z1, '->', z2);

/* ---- 7. nothing hides under the bottom bar ---- */
const overlap = await page.evaluate(() => {
   const nav = document.querySelector('nav.fixed, [class*="z-30"]');
   const navTop = nav ? Math.round(nav.getBoundingClientRect().top) : 780;
   const bad = [];
   for (const el of document.querySelectorAll('button, a, input, [role=option]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom > navTop + 1 && r.top < innerHeight) {
         bad.push({ text: (el.innerText || el.getAttribute('aria-label') || el.tagName).slice(0, 24), top: Math.round(r.top), bottom: Math.round(r.bottom) });
      }
   }
   return { navTop, bad };
});
console.log('\nunder the nav bar:', JSON.stringify(overlap));

console.log('\nerrors:', JSON.stringify(errors.slice(0, 5)));
await browser.close();
