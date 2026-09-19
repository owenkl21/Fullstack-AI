import { launch, context, open, signIn, shot, PHONE, DESK } from './lib.mjs';

const browser = await launch();
const pass = (n, ok, note = '') =>
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? '  ' + note : ''}`);
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await signIn(page);

/* ---- 1. the map still drags under a finger ---------------------------- */
await open(page, '/map', 4500);
const pan = () =>
   page.evaluate(
      () =>
         getComputedStyle(document.querySelector('.leaflet-map-pane')).transform
   );
const before = await pan();
await page.mouse.move(195, 400);
await page.mouse.down();
await page.mouse.move(195, 300, { steps: 12 });
await page.mouse.move(195, 250, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(1200);
const after = await pan();
pass(
   'the map still pans under a drag',
   before !== after,
   `${before} -> ${after}`
);
const ta = await page.evaluate(() => ({
   container: getComputedStyle(document.querySelector('.leaflet-container'))
      .touchAction,
   marker: (() => {
      const m = document.querySelector('.leaflet-marker-icon');
      return m ? getComputedStyle(m).touchAction : null;
   })(),
}));
console.log('   touch-action:', JSON.stringify(ta));
pass(
   'leaflet still owns the gesture on its container',
   ta.container === 'none'
);

/* ---- 2. the layers sheet still opens from the bottom ------------------ */
const layers = page.locator('button:visible', { hasText: /^Layers$/ }).first();
await layers.click();
await page.waitForTimeout(900);
const sheet = await page.evaluate(() => {
   const d = document.querySelector('[role=dialog][data-state=open]');
   if (!d) return null;
   const r = d.getBoundingClientRect();
   return {
      cls: d.className.slice(0, 30),
      bottom: Math.round(r.bottom),
      vh: innerHeight,
      w: Math.round(r.width),
      text: d.innerText.replace(/\n/g, ' | ').slice(0, 200),
   };
});
pass(
   'the map layers sheet opens from the bottom edge',
   !!sheet &&
      /sheet fixed inset-x-0 bottom-0/.test(sheet.cls) &&
      sheet.bottom >= sheet.vh - 2,
   JSON.stringify(sheet)
);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

/* ---- 3. the species picker (bottom sheet) still opens on the log ------- */
await open(page, '/log', 4000);
const species = page
   .locator('input[placeholder="Search or add a species"]')
   .first();
await species.click();
await species.fill('Elf');
await page.waitForTimeout(1500);
const pickerOpen = await page.evaluate(() => {
   const d = document.querySelector(
      '[role=dialog][data-state=open], [role=listbox]'
   );
   return d
      ? {
           tag: d.tagName,
           cls: String(d.className).slice(0, 44),
           text: d.innerText.replace(/\n/g, ' | ').slice(0, 120),
        }
      : null;
});
pass(
   'the species picker still answers on the log',
   !!pickerOpen,
   JSON.stringify(pickerOpen)
);
await page.keyboard.press('Escape');

/* ---- 4. the shared place search still works on /competitions/new ------- */
await open(page, '/competitions/new', 4000);
const compSearch = page.locator('input[type=search]').first();
if (await compSearch.count()) {
   await compSearch.fill('Kalk Bay');
   await page.waitForTimeout(2600);
   const rows = await page.evaluate(
      () => document.querySelectorAll('[role=option]').length
   );
   pass(
      '/competitions/new the shared place search still answers',
      rows > 0,
      `${rows} rows`
   );
} else {
   console.log('   /competitions/new has no place search on the first step');
}

/* ---- 5. night theme, the new panels ----------------------------------- */
const night = await context(browser, PHONE, { hasTouch: true });
await night.addInitScript(() => localStorage.setItem('theme', 'night'));
const np = await night.newPage();
np.on('pageerror', (e) => errors.push('night: ' + e));
await signIn(np);
await open(np, '/map', 4500);
await shot(np, 'final-map-night', { x: 0, y: 0, ...PHONE });
await np.locator('button[aria-label="Your account"]').first().click();
await np.waitForTimeout(900);
const nightPanel = await np.evaluate(() => {
   const d = document.querySelector('[role=dialog][data-state=open]');
   if (!d) return null;
   const plate = d.querySelector('.blk');
   return {
      panelBg: getComputedStyle(d).backgroundColor,
      plateBg: plate ? getComputedStyle(plate).backgroundColor : null,
      theme: document.documentElement.dataset.theme,
   };
});
console.log('   night panel:', JSON.stringify(nightPanel));
pass(
   'the account panel is drawn in the night theme too',
   !!nightPanel && nightPanel.theme === 'night'
);
await shot(np, 'final-account-night', { x: 0, y: 0, ...PHONE });
await night.close();

/* ---- 6. the desktop map, one line of controls -------------------------- */
const dctx = await context(browser, DESK);
const dp = await dctx.newPage();
dp.on('pageerror', (e) => errors.push('desk: ' + e));
await signIn(dp);
await open(dp, '/map', 4500);
const deskBar = await dp.evaluate(() => {
   const box = document
      .querySelector('.leaflet-container')
      .getBoundingClientRect();
   return {
      map: {
         w: Math.round(box.width),
         h: Math.round(box.height),
         top: Math.round(box.top),
         bottom: Math.round(box.bottom),
      },
      vh: innerHeight,
      scroll: document.documentElement.scrollHeight,
   };
});
console.log('   desk map:', JSON.stringify(deskBar));
pass(
   'the desktop map fills the window and the page does not scroll',
   deskBar.scroll <= deskBar.vh + 2
);
await shot(dp, 'final-map-desk', { x: 0, y: 0, ...DESK });
await dctx.close();

console.log('\npage errors:', errors.length ? errors : 'none');
await browser.close();
