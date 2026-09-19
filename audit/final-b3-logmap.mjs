import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';

const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await signIn(page);
const pass = (n, ok, note = '') =>
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? '  ' + note : ''}`);

const pin = () =>
   page.evaluate(() => {
      const el = document.querySelector('.leaflet-marker-icon');
      if (!el) return null;
      return {
         title: el.getAttribute('aria-label') || el.title || '',
         n: document.querySelectorAll('.leaflet-marker-icon').length,
      };
   });

for (const route of ['/log', '/catches/new']) {
   await open(page, route, 4500);
   const toggle = page
      .locator('button[aria-label="Search for a place"]')
      .first();
   const has = await toggle.count();
   pass(`${route} the picker carries a place search`, has > 0);
   if (!has) continue;
   await toggle.scrollIntoViewIfNeeded();
   await toggle.click();
   await page.waitForTimeout(700);
   const field = page
      .locator('input[aria-label="Search a place, or paste a link from Maps"]')
      .first();
   pass(
      `${route} the search field opens`,
      (await field.count()) > 0 && (await field.isVisible())
   );
   await field.fill('Kalk Bay');
   await page.waitForTimeout(400);
   await field.press('Enter');
   await page.waitForTimeout(3000);
   const list = page.locator(
      '[aria-label="Places found"] button, [aria-label="Places found"] [role=option]'
   );
   const n = await list.count();
   pass(`${route} the search answers`, n > 0, `${n} rows`);
   const readTiles = () =>
      page.evaluate(() => {
         const t = document.querySelector('.leaflet-tile-pane img');
         const pane = document.querySelector('.leaflet-map-pane');
         return {
            tile: t ? t.src.replace(/^.*\/(\d+\/\d+\/\d+).*$/, '$1') : null,
            pan: pane ? getComputedStyle(pane).transform : null,
         };
      });
   const before = JSON.stringify(await readTiles());
   if (n) {
      await list.first().click();
      await page.waitForTimeout(2200);
   }
   const after = JSON.stringify(await readTiles());
   const pins = await page.evaluate(
      () => document.querySelectorAll('.leaflet-marker-icon').length
   );
   pass(
      `${route} picking a result moves the map and keeps the pin`,
      pins > 0 && after !== before,
      `${before} -> ${after}, pins ${pins}`
   );
   await shot(page, `final-logsearch${route.replace(/\W/g, '-')}`, {
      x: 0,
      y: 0,
      ...PHONE,
   });
}

console.log('\npage errors:', errors.length ? errors : 'none');
await browser.close();
