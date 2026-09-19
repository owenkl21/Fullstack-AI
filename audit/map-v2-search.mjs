import { launch, context, signIn, shot, PHONE, DESK } from './lib.mjs';

const VIEW = () => {
   const cont = document.querySelector('.leaflet-container');
   if (!cont) return null;
   const cr = cont.getBoundingClientRect();
   const cx = cr.left + cr.width / 2;
   const cy = cr.top + cr.height / 2;
   let best = null;
   let bestD = Infinity;
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

const STATE = () => ({
   found: document.querySelectorAll('.map-pin-found').length,
   drop: document.querySelectorAll('.map-pin-drop').length,
   sheet: (() => {
      const s = document.querySelector('.sheet');
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), text: s.innerText.replace(/\n+/g, ' | ') };
   })(),
   panel: (() => {
      const p = [...document.querySelectorAll('div')].find((d) => d.className && String(d.className).includes('z-[620]'));
      if (!p) return null;
      const r = p.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), text: p.innerText.replace(/\n+/g, ' | ') };
   })(),
   query: document.querySelector('input[type=search]')?.value ?? null,
});

const TERMS = ['Kalk Bay', 'Rooi-Els', 'Vaal Dam', 'Oranjeville', '-34.1275, 18.4487'];
const LINK = 'https://www.google.com/maps/@-34.0964,18.3086,15z';

const run = async (size, tag) => {
   const browser = await launch();
   const ctx = await context(browser, size);
   const page = await ctx.newPage();
   const errors = [];
   page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
   await signIn(page);
   await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
   await page.waitForTimeout(3500);

   console.log(`\n######## ${tag} ########`);
   console.log('open view:', JSON.stringify(await page.evaluate(VIEW)));

   const dismiss = async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const over = await page.locator('.sheet-overlay').count();
      if (over) { await page.locator('.sheet-overlay').first().click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(500); }
   };

   for (const term of TERMS) {
      await dismiss();
      const box = page.locator('input[type=search]').first();
      await box.click();
      await box.fill('');
      await box.type(term, { delay: 25 });
      await page.waitForTimeout(2600);
      const rows = await page.locator('[role=listbox] li').allTextContents();
      const before = await page.evaluate(VIEW);
      const opt = page.locator('[role=listbox] [role=option]').first();
      const n = await opt.count();
      if (n) await opt.click();
      await page.waitForTimeout(2200);
      const after = await page.evaluate(VIEW);
      const state = await page.evaluate(STATE);
      console.log(`\n-- ${term} --`);
      console.log(' rows:', JSON.stringify(rows.map((r) => r.replace(/\n/g, ' · ')).slice(0, 4)));
      console.log(' view', JSON.stringify(before), '->', JSON.stringify(after));
      console.log(' state:', JSON.stringify(state));
      await shot(page, `map-search-${term.replace(/[^a-z0-9]+/gi, '-').slice(0, 18).toLowerCase()}-${tag}`, { x: 0, y: 0, ...size });
      /* close the card for the next go */
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
   }

   /* a pasted link */
   await dismiss();
   const box = page.locator('input[type=search]').first();
   await box.click();
   await box.fill('');
   await page.evaluate((text) => {
      const input = document.querySelector('input[type=search]');
      input.focus();
      const dt = new DataTransfer();
      dt.setData('text', text);
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
   }, LINK);
   await page.waitForTimeout(2200);
   console.log('\n-- pasted link --');
   console.log(' view:', JSON.stringify(await page.evaluate(VIEW)));
   console.log(' state:', JSON.stringify(await page.evaluate(STATE)));
   await shot(page, `map-search-link-${tag}`, { x: 0, y: 0, ...size });

   /* nothing found */
   await dismiss();
   await box.click();
   await box.fill('');
   await box.type('Qqzzxwv', { delay: 25 });
   await page.waitForTimeout(4000);
   console.log('\n-- nonsense --', JSON.stringify(await page.locator('[role=listbox] li').allTextContents()));
   await shot(page, `map-search-nothing-${tag}`, { x: 0, y: 0, ...size });

   console.log('\nerrors:', JSON.stringify(errors.slice(0, 6)));
   await browser.close();
};

await run(PHONE, 'phone');
await run(DESK, 'desk');
