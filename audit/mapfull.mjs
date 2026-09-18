import { launch, context, open, signIn, shot, PHONE, DESK } from './lib.mjs';

/*
 * The map page on a phone: is it the screen, are the controls on it, does
 * anything throw, and does a mark still drop.
 *
 * It exists because the map was a 284 pixel window on the water under a
 * heading and a paragraph, which is a picture of a map rather than a map.
 */
const b = await launch();
const ctx = await context(b, PHONE, { deviceScaleFactor: 2 });
const p = await ctx.newPage();

const errors = [];
p.on('pageerror', (e) => errors.push(`${e.message}\n${String(e.stack).split('\n').slice(0, 5).join('\n')}`));
p.on('console', (m) => {
   if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) {
      errors.push(m.text().slice(0, 300));
   }
});

await signIn(p);
await open(p, '/map', 9000);

const box = await p.evaluate(() => {
   const el = document.querySelector('.leaflet-container');
   const r = el?.getBoundingClientRect();
   const search = document.querySelector('input[type="search"]')?.getBoundingClientRect();
   const bar = [...document.querySelectorAll('button')].find((b) => /log here/i.test(b.textContent ?? ''))?.getBoundingClientRect();
   const zoom = document.querySelector('.leaflet-control-zoom')?.getBoundingClientRect();
   const attrib = document.querySelector('.leaflet-control-attribution')?.getBoundingClientRect();
   const at = (r) => (r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null);
   /* What is actually painted where each control claims to be. */
   const painted = (r) => {
      if (!r) return null;
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el ? `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}` : null;
   };
   return {
      map: at(r),
      share: r ? Math.round((r.height / innerHeight) * 100) : 0,
      search: at(search),
      searchPainted: painted(search),
      bar: at(bar),
      barPainted: painted(bar),
      zoom: at(zoom),
      zoomPainted: painted(zoom),
      attrib: at(attrib),
      sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      scrolls: document.documentElement.scrollHeight > innerHeight + 2,
      viewport: innerHeight,
   };
});
console.log(JSON.stringify(box, null, 1));
await shot(p, 'mapfull-phone', { x: 0, y: 0, ...PHONE });

/* Search something that is not a town. */
const field = p.locator('input[type="search"]').first();
for (const q of ['Rooi-Els', 'Kanu', 'Theewaterskloof', 'Struisbaai']) {
   await field.fill(q);
   await p.waitForTimeout(2600);
   const hits = await p.evaluate(() =>
      [...document.querySelectorAll('[role="option"]')].map((el) => el.textContent?.trim().slice(0, 70))
   );
   console.log(`search ${q} ->`, JSON.stringify(hits.slice(0, 4)));
}
await shot(p, 'mapfull-search', { x: 0, y: 0, ...PHONE });
await field.fill('');
await p.keyboard.press('Escape');
await p.waitForTimeout(500);

/* Drop a mark: arm the control, tap the middle of the water. */
await p.getByRole('button', { name: /^mark$/i }).first().click();
await p.waitForTimeout(400);
/* Open water on the left of the frame. A tap on a cluster zooms to its
 * children instead, which is a different thing being tested. */
await p.mouse.click(90, 620);
await p.waitForTimeout(1800);
const marking = await p.evaluate(() => ({
   pin: Boolean(document.querySelector('.leaflet-marker-draggable, .leaflet-marker-icon')),
   panel: /Drop a mark/i.test(document.body.innerText),
   save: (() => {
      const b = [...document.querySelectorAll('button')].find((b) => /save the mark/i.test(b.textContent ?? ''));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { y: Math.round(r.y), h: Math.round(r.height), onScreen: r.bottom <= innerHeight, clear: at === b || b.contains(at) };
   })(),
}));
console.log('marking', JSON.stringify(marking));
await shot(p, 'mapfull-mark', { x: 0, y: 0, ...PHONE });

/* And the desktop, which must not have changed. */
const dctx = await context(b, DESK);
const dp = await dctx.newPage();
dp.on('pageerror', (e) => errors.push('desk: ' + e.message));
await signIn(dp);
await open(dp, '/map', 8000);
const desk = await dp.evaluate(() => {
   const r = document.querySelector('.leaflet-container')?.getBoundingClientRect();
   return r ? { h: Math.round(r.height), share: Math.round((r.height / innerHeight) * 100) } : null;
});
console.log('desk map', JSON.stringify(desk));
await shot(dp, 'mapfull-desk', { x: 0, y: 0, ...DESK });

console.log('\nerrors:', errors.length ? '\n' + [...new Set(errors)].join('\n---\n') : 'none');
await b.close();
