import { launch, context, open, signIn, shot, DESK, PHONE, HOST } from './lib.mjs';

/*
 * Where a catch is placed, on both log forms, phone and desktop:
 *
 *  1. The phone's fix lands on a visible map with a pin.
 *  2. A photograph with GPS moves the pin to the photograph's place, and the
 *     receipt says so.
 *  3. A pin put down by hand stands; a later photograph's place is offered,
 *     one tap to take it.
 *  4. A photograph without GPS says so and moves nothing.
 *  5. What is saved is the photograph's place (checked through the API), and
 *     the test catch is deleted again.
 *
 * The test photograph says Deneysville on the Vaal Dam (-26.8967, 28.0942);
 * the browser's own position is Kommetjie (-34.13, 18.33).
 */
const PHOTO = new URL('./vaal-gps.jpg', import.meta.url).pathname;
const PLAIN = new URL('./no-gps.jpg', import.meta.url).pathname;
const VAAL = { lat: -26.8967, lng: 28.0942 };
const near = (pin, want, tol = 0.002) => {
   const [lat, lng] = (pin || '').split(',').map(Number);
   return Math.abs(lat - want.lat) < tol && Math.abs(lng - want.lng) < tol;
};

const results = [];
const check = (name, ok, detail = '') => {
   results.push({ name, ok, detail });
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

const b = await launch();
for (const [vp, size] of [['phone', PHONE], ['desk', DESK]]) {
   const ctx = await context(b, size);
   const p = await ctx.newPage();
   const errs = [];
   p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
   await signIn(p);

   /* ---- the quick log ---- */
   await open(p, '/log', 6000);
   const pin = () => p.locator('#quicklog-pin [data-pin]').first().getAttribute('data-pin');
   const source = () => p.locator('[data-where-source]').first().getAttribute('data-where-source');
   check(`${vp} quick: map visible on open`, (await p.locator('#quicklog-pin .leaflet-container').count()) > 0);
   check(`${vp} quick: phone fix on the pin`, near(await pin(), { lat: -34.13, lng: 18.33 }), await pin());
   check(`${vp} quick: receipt says phone fix`, (await source()) === 'phone');
   await shot(p, `pos-quick-fix-${vp}`);

   await p.locator('input[aria-label="Choose a photo"]').first().setInputFiles(PHOTO);
   await p.waitForFunction(() => document.querySelector('[data-where-source]')?.getAttribute('data-where-source') === 'photo', null, { timeout: 15000 }).catch(() => undefined);
   check(`${vp} quick: photograph moves the pin to the Vaal`, near(await pin(), VAAL), await pin());
   check(`${vp} quick: receipt says from the photograph`, (await source()) === 'photo');
   await p.waitForTimeout(1500);
   await shot(p, `pos-quick-photo-${vp}`);

   /* the angler drags the pin by hand */
   await p.locator('#quicklog-pin .leaflet-container').first().scrollIntoViewIfNeeded();
   await p.waitForTimeout(600);
   const marker = p.locator('#quicklog-pin .leaflet-marker-icon').first();
   const box = await marker.boundingBox();
   if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height - 6;
      await p.mouse.move(x, y);
      await p.mouse.down();
      for (let i = 1; i <= 15; i++) {
         await p.mouse.move(x + i * 6, y + i * 3);
         await p.waitForTimeout(20);
      }
      await p.mouse.up();
      await p.waitForTimeout(1000);
   }
   check(`${vp} quick: a dragged pin says pinned by you`, (await source()) === 'pin', await source());
   const pinnedAt = await pin();

   /* a second photograph now only offers its place */
   await p.locator('input[aria-label="Choose a photo"]').first().setInputFiles(PHOTO);
   await p.waitForTimeout(2500);
   const offer = p.getByRole('button', { name: /Use the photograph's place/ });
   check(`${vp} quick: hand pin stands, photograph's place offered`, (await offer.count()) > 0 && (await pin()) === pinnedAt);
   await shot(p, `pos-quick-offer-${vp}`);
   if (await offer.count()) {
      await offer.click();
      await p.waitForTimeout(1200);
      check(`${vp} quick: taking the offer moves the pin`, near(await pin(), VAAL) && (await source()) === 'photo');
   }

   /* a photograph with no GPS */
   await p.locator('input[aria-label="Choose a photo"]').first().setInputFiles(PLAIN);
   await p.waitForTimeout(2500);
   check(`${vp} quick: no-GPS photograph says so and moves nothing`, (await p.getByText(/carries no position/).count()) > 0 && near(await pin(), VAAL));

   /* save it and check what landed */
   await p.locator('input[aria-label="Choose a photo"]').first().setInputFiles(PHOTO);
   await p.waitForTimeout(3000);
   const speciesBox = p.locator('input[role=combobox]').first();
   await speciesBox.fill('Galjoen');
   await p.waitForTimeout(600);
   await p.getByRole('option', { name: /^Galjoen/ }).first().click().catch(() => undefined);
   if (vp === 'phone') {
      for (let i = 0; i < 2; i++) { await p.getByRole('button', { name: /^Next$/ }).first().click(); await p.waitForTimeout(600); }
   }
   const before = await p.request.get(HOST + '/api/catches/me').then((r) => r.json()).catch(() => ({ catches: [] }));
   await p.getByRole('button', { name: /^Save catch$/ }).first().click();
   await p.waitForTimeout(5000);
   const after = await p.request.get(HOST + '/api/catches/me').then((r) => r.json());
   const fresh = (after.catches || []).find((c) => !(before.catches || []).some((o) => o.id === c.id));
   /* The list leaves the position out; the record itself carries it. */
   const record = fresh ? await p.request.get(HOST + `/api/catches/${fresh.id}`).then((r) => r.json()).then((d) => d.catch ?? d).catch(() => null) : null;
   const lat = record?.latitude ?? record?.location?.latitude;
   const lng = record?.longitude ?? record?.location?.longitude;
   check(`${vp} quick: the saved catch carries the photograph's place`, typeof lat === 'number' && Math.abs(lat - VAAL.lat) < 0.002 && Math.abs(lng - VAAL.lng) < 0.002, fresh ? `${lat},${lng}` : 'no new catch');
   if (fresh) await p.request.delete(HOST + `/api/catches/${fresh.id}`);

   /* ---- the full form ---- */
   await open(p, '/catches/new', 6000);
   const fullPin = () => p.locator('[data-field=spot] [data-pin], [data-pin]').first().getAttribute('data-pin');
   await p.waitForTimeout(3000);
   check(`${vp} full: a map with the phone fix on open`, (await p.locator('.leaflet-container').count()) > 0 && near(await fullPin(), { lat: -34.13, lng: 18.33 }), await fullPin());
   await shot(p, `pos-full-fix-${vp}`);
   await p.locator('input[type=file]').first().setInputFiles(PHOTO);
   await p.waitForFunction((want) => { const el = document.querySelector('[data-pin]'); if (!el) return false; const [a, b] = el.getAttribute('data-pin').split(',').map(Number); return Math.abs(a - want.lat) < 0.002 && Math.abs(b - want.lng) < 0.002; }, VAAL, { timeout: 15000 }).catch(() => undefined);
   check(`${vp} full: photograph moves the pin to the Vaal`, near(await fullPin(), VAAL), await fullPin());
   check(`${vp} full: readout says from the photograph`, (await p.locator('[data-source="From the photograph"]').count()) > 0);
   await p.waitForTimeout(1500);
   await shot(p, `pos-full-photo-${vp}`);

   console.log(vp, 'page errors:', errs.length ? errs : 'none');
   await ctx.close();
}
await b.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
