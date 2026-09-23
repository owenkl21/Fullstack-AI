import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';

const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await signIn(page);

/* Leaflet's own state, read off the DOM: the map pane's transform is the
   pan, and a tile's z is the zoom. */
const view = () =>
   page.evaluate(() => {
      const pane = document.querySelector('.leaflet-map-pane');
      const tile = document.querySelector('.leaflet-tile-pane img');
      const box = document.querySelector('.leaflet-container');
      if (!pane) return null;
      const z = tile ? (tile.src.match(/\/(\d+)\/\d+\/\d+/) || [])[1] : null;
      return {
         pan: getComputedStyle(pane).transform,
         zoom: z,
         size: box
            ? Math.round(box.getBoundingClientRect().width) +
              'x' +
              Math.round(box.getBoundingClientRect().height)
            : null,
      };
   });

const pass = (name, ok, note = '') =>
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  ' + note : ''}`);

await open(page, '/map', 4500);
console.log('opening view:', JSON.stringify(await view()));

const controls = await page.evaluate(() => {
   const out = [];
   for (const el of document.querySelectorAll(
      'button, input[type=search], [role=button]'
   )) {
      if (
         el.closest('.leaflet-marker-icon') ||
         el.classList.contains('leaflet-marker-icon')
      )
         continue;
      if (el.closest('header') || el.closest('nav')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.top < 60 || r.bottom > window.innerHeight - 60) continue;
      out.push({
         label:
            (el.getAttribute('aria-label') || el.textContent || '')
               .trim()
               .slice(0, 28) || '(icon)',
         x: Math.round(r.left + r.width / 2),
         y: Math.round(r.top + r.height / 2),
         w: Math.round(r.width),
         h: Math.round(r.height),
      });
   }
   return out;
});
console.log(
   'overlay controls over the water:',
   controls.map((c) => `${c.label} ${c.w}x${c.h}`).join(' | ')
);

let moved = [];
for (const c of controls) {
   const was = await view();
   await page.mouse.click(c.x, c.y);
   await page.waitForTimeout(900);
   const now = await view();
   const same = was && now && was.pan === now.pan && was.zoom === now.zoom;
   if (!same) moved.push({ c: c.label, was, now });
   await page.keyboard.press('Escape');
   await page.waitForTimeout(600);
   /* shut any card the tap opened so the next one is clean */
   const dismiss = page
      .locator('button:visible', { hasText: /^Dismiss$/ })
      .first();
   if (await dismiss.count()) {
      try {
         await dismiss.click({ timeout: 1500 });
      } catch {}
   }
   await page.waitForTimeout(400);
}
pass(
   'a tap on an overlay control leaves the map where it was',
   moved.length === 0,
   `${controls.length} tapped, ${moved.length} moved it`
);
for (const m of moved)
   console.log(
      '   MOVED by',
      JSON.stringify(m.c),
      JSON.stringify(m.was),
      '->',
      JSON.stringify(m.now)
   );

/* every real control at least 40px for a thumb */
await open(page, '/map', 4000);
const reach = await page.evaluate(() =>
   [...document.querySelectorAll('button, [role=button], input[type=search]')]
      .filter(
         (el) =>
            !el.closest('header') &&
            !el.classList.contains('leaflet-marker-icon') &&
            !el.closest('.leaflet-marker-icon') &&
            !el.closest('.leaflet-control-attribution')
      )
      .map((el) => {
         const r = el.getBoundingClientRect();
         return {
            label:
               (el.getAttribute('aria-label') || el.textContent || '')
                  .trim()
                  .slice(0, 24) || '(icon)',
            w: Math.round(r.width),
            h: Math.round(r.height),
            y: Math.round(r.top),
         };
      })
      .filter((r) => r.w && r.h)
);
const small = reach.filter((r) => r.h < 40);
pass(
   'every map control is at least 40px tall',
   small.length === 0,
   JSON.stringify(small)
);
console.log(
   '   controls:',
   reach.map((r) => `${r.label} ${r.w}x${r.h}`).join(' | ')
);

/* the map really is the screen and the water runs under nothing */
const geom = await page.evaluate(() => {
   const box = document
      .querySelector('.leaflet-container')
      .getBoundingClientRect();
   const bars = [...document.querySelectorAll('*')].filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') return false;
      const r = el.getBoundingClientRect();
      return (
         r.bottom >= innerHeight - 2 &&
         r.height < 120 &&
         r.width > innerWidth * 0.8
      );
   });
   return {
      map: {
         top: Math.round(box.top),
         bottom: Math.round(box.bottom),
         h: Math.round(box.height),
      },
      barTop: bars.length
         ? Math.round(
              Math.min(...bars.map((b) => b.getBoundingClientRect().top))
           )
         : null,
      vh: innerHeight,
      docScroll: document.documentElement.scrollHeight,
   };
});
console.log('geometry:', JSON.stringify(geom));
pass(
   'the map page does not scroll',
   geom.docScroll <= geom.vh + 2,
   `doc ${geom.docScroll} vs ${geom.vh}`
);

/* --- the log's map picker: a search drops a pin and offers actions ------- */
await open(page, '/catches/new', 4500);
const nearMap = await page.evaluate(() => {
   const out = [];
   for (const el of document.querySelectorAll(
      'input[type=search], input[type=text]'
   )) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      out.push({
         ph: el.getAttribute('placeholder') || '',
         y: Math.round(r.top),
      });
   }
   return out;
});
console.log('/catches/new fields:', JSON.stringify(nearMap));
const place = page
   .locator('input[placeholder*="place"], input[placeholder*="Search a place"]')
   .first();
if (await place.count()) {
   await place.scrollIntoViewIfNeeded();
   await place.fill('Kalk Bay');
   await page.waitForTimeout(2500);
   const rows = page
      .locator('[role=option], li button, ul button')
      .filter({ hasText: /Kalk/i });
   const c = await rows.count();
   if (c) {
      await rows.first().click();
      await page.waitForTimeout(2000);
   }
   const after = await page.evaluate(() => {
      const pins = document.querySelectorAll('.leaflet-marker-icon');
      return { pins: pins.length, text: document.body.innerText.slice(0, 0) };
   });
   pass(
      '/catches/new a search drops a pin on the picker',
      after.pins > 0,
      JSON.stringify(after)
   );
   await shot(page, 'final-logmap-phone', { x: 0, y: 0, ...PHONE });
} else {
   console.log('   no place search on /catches/new');
}

console.log('\npage errors:', errors.length ? errors : 'none');
await browser.close();
