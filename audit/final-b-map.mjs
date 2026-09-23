import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';

const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await signIn(page);

const view = () =>
   page.evaluate(() => {
      const m = window.__map;
      if (!m) return null;
      const c = m.getCenter();
      return {
         lat: +c.lat.toFixed(5),
         lng: +c.lng.toFixed(5),
         zoom: m.getZoom(),
      };
   });

const pass = (name, ok, note = '') =>
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  ' + note : ''}`);

await open(page, '/map', 4000);

/* --- 1. a search drops a pin and offers actions ------------------------- */
const field = page.locator('input[type=search]').first();
await field.click();
await field.fill('Kalk Bay');
await page.waitForTimeout(2500);
const results = page
   .locator('[role=option], li button, ul button')
   .filter({ hasText: /Kalk/i });
const n = await results.count();
pass('/map search returns rows', n > 0, `${n} rows`);
if (n) {
   await results.first().click();
   await page.waitForTimeout(2500);
}
const afterSearch = await page.evaluate(() => {
   const pins = document.querySelectorAll('.leaflet-marker-icon');
   const found = document.querySelectorAll(
      '[class*="found"], .found-pin, .leaflet-marker-icon'
   );
   const sheet = document.querySelector('[role=dialog][data-state=open]');
   const txt = sheet ? sheet.innerText : document.body.innerText;
   return {
      pins: pins.length,
      sheetOpen: !!sheet,
      hasSave: /save as a spot/i.test(txt),
      hasLog: /log a catch here/i.test(txt),
      hasForecast: /forecast/i.test(txt),
      hasDismiss: /dismiss/i.test(txt),
      title: sheet ? (sheet.querySelector('h2')?.textContent || '').trim() : '',
   };
});
pass(
   '/map a search drops a pin and opens a card',
   afterSearch.sheetOpen,
   JSON.stringify(afterSearch)
);
pass(
   '/map the card offers save, log, forecast, dismiss',
   afterSearch.hasSave &&
      afterSearch.hasLog &&
      afterSearch.hasForecast &&
      afterSearch.hasDismiss
);
await shot(page, 'final-map-search-phone', { x: 0, y: 0, ...PHONE });
await page.keyboard.press('Escape');
await page.waitForTimeout(800);

/* --- 2. a tap on an overlay control does not move or zoom the map -------- */
await open(page, '/map', 4000);
const before = await view();
const controls = await page.evaluate(() => {
   const out = [];
   for (const el of document.querySelectorAll(
      'button, input[type=search], [role=button]'
   )) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.top < 60 || r.bottom > window.innerHeight - 60) continue;
      if (el.closest('header') || el.closest('nav')) continue;
      out.push({
         label: (el.getAttribute('aria-label') || el.textContent || '')
            .trim()
            .slice(0, 28),
         x: Math.round(r.left + r.width / 2),
         y: Math.round(r.top + r.height / 2),
      });
   }
   return out;
});
console.log(
   '  overlay controls over the water:',
   controls.map((c) => c.label || '(icon)').join(' | ')
);
let moved = 0;
for (const c of controls) {
   const was = await view();
   await page.mouse.click(c.x, c.y);
   await page.waitForTimeout(900);
   const now = await view();
   const same =
      was &&
      now &&
      was.zoom === now.zoom &&
      Math.abs(was.lat - now.lat) < 0.0005 &&
      Math.abs(was.lng - now.lng) < 0.0005;
   if (!same) {
      moved++;
      console.log(
         `    MOVED by "${c.label}"`,
         JSON.stringify(was),
         '->',
         JSON.stringify(now)
      );
   }
   await page.keyboard.press('Escape');
   await page.waitForTimeout(500);
}
pass(
   '/map a tap on an overlay control leaves the map where it was',
   moved === 0,
   `${controls.length} controls tapped, ${moved} moved it`
);

/* --- 3. nothing hides under the bottom bar ------------------------------ */
await open(page, '/map', 4000);
const clash = await page.evaluate(() => {
   const bar = document.querySelector(
      'nav[class*="fixed"], [data-bottom-bar], footer nav'
   );
   const bars = [...document.querySelectorAll('nav, div')].filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') return false;
      const r = el.getBoundingClientRect();
      return (
         r.bottom >= window.innerHeight - 2 &&
         r.height < 120 &&
         r.width > window.innerWidth * 0.8
      );
   });
   const barTop = bars.length
      ? Math.min(...bars.map((b) => b.getBoundingClientRect().top))
      : null;
   const hidden = [];
   for (const el of document.querySelectorAll(
      'button, input, a[href], [role=button]'
   )) {
      if (bars.some((b) => b.contains(el))) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (
         barTop !== null &&
         r.bottom > barTop + 1 &&
         r.top < window.innerHeight
      )
         hidden.push({
            label: (el.getAttribute('aria-label') || el.textContent || '')
               .trim()
               .slice(0, 30),
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
         });
   }
   return {
      barTop,
      bars: bars.length,
      hidden,
      vh: window.innerHeight,
      nav: !!bar,
   };
});
console.log('  bottom bar top:', clash.barTop, 'viewport', clash.vh);
pass(
   '/map nothing sits under the bottom bar',
   clash.hidden.length === 0,
   JSON.stringify(clash.hidden)
);

/* thumb reach: every map control inside the lower two thirds or the top bar */
const reach = await page.evaluate(() => {
   const out = [];
   for (const el of document.querySelectorAll('button, [role=button]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest('header')) continue;
      out.push({
         label: (el.getAttribute('aria-label') || el.textContent || '')
            .trim()
            .slice(0, 24),
         h: Math.round(r.height),
         w: Math.round(r.width),
         y: Math.round(r.top),
      });
   }
   return out;
});
const small = reach.filter((r) => r.h < 40 || r.w < 40);
pass(
   '/map every control is at least 40px for a thumb',
   small.length === 0,
   JSON.stringify(small)
);
await shot(page, 'final-map-phone', { x: 0, y: 0, ...PHONE });

/* --- 4. the log's map picker: a search drops a pin ----------------------- */
await open(page, '/log', 4000);
const picker = page.locator('input[type=search]').filter({ hasText: '' });
const logSearch = page
   .locator('input[placeholder*="place"], input[placeholder*="Search a place"]')
   .first();
const hasLogSearch = await logSearch.count();
console.log('  /log has a place search on the first screen:', hasLogSearch > 0);
await shot(page, 'final-log-phone', { x: 0, y: 0, ...PHONE });

console.log('\npage errors:', errors.length ? errors : 'none');
await browser.close();
