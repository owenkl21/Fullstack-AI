import { launch, context, signIn, shot, PHONE, DESK } from './lib.mjs';
const browser = await launch();

/* ---- the map inside My spots, which uses the same component ---- */
for (const [size, tag] of [[PHONE, 'phone'], [DESK, 'desk']]) {
   const ctx = await context(browser, size);
   const page = await ctx.newPage();
   const errors = [];
   page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
   await signIn(page);
   await page.goto('http://localhost:5199/spots', { waitUntil: 'load' });
   await page.waitForTimeout(2000);
   const tab = page.getByRole('link', { name: /map/i }).or(page.getByRole('button', { name: /^map$/i })).first();
   if (await tab.count()) { await tab.click(); await page.waitForTimeout(3000); }
   else { await page.goto('http://localhost:5199/spots?view=map', { waitUntil: 'load' }); await page.waitForTimeout(3000); }
   const state = await page.evaluate(() => {
      const r = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom), left: Math.round(q.left), right: Math.round(q.right) }; };
      const bar = document.querySelector('.grid.grid-cols-4');
      const overlay = [...document.querySelectorAll('div')].find((d) => String(d.className).includes('top-3 left-3'));
      return {
         surface: r(document.querySelector('.map-surface')),
         bar: bar ? { ...r(bar), text: bar.innerText.replace(/\n/g, ' | ') } : null,
         overlay: overlay ? { ...r(overlay), text: overlay.innerText.replace(/\n/g, ' ') } : null,
         markers: document.querySelectorAll('.leaflet-marker-icon').length,
      };
   });
   console.log(`== /spots map ${tag} ==`, JSON.stringify(state));
   console.log('errors:', JSON.stringify(errors.slice(0, 3)));
   await shot(page, `map-spots-${tag}`, { x: 0, y: 0, ...size });
   await ctx.close();
}

/* ---- locate with the permission refused ---- */
const ctx = await browser.newContext({ viewport: PHONE, permissions: [] });
const page = await ctx.newPage();
await signIn(page);
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page.waitForTimeout(3500);
await page.getByRole('button', { name: 'Locate' }).click();
await page.waitForTimeout(3000);
console.log('\nlocate denied says:', JSON.stringify(await page.evaluate(() => {
   const p = [...document.querySelectorAll('p')].map((e) => e.innerText).filter((t) => /location|search for a place/i.test(t));
   return p;
})));
await shot(page, 'map-locate-denied-phone', { x: 0, y: 0, ...PHONE });
await browser.close();
