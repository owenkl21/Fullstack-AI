import { launch, context, signIn, shot, PHONE } from './lib.mjs';

const TOTAL = () => {
   let loose = document.querySelectorAll('.map-pin-spot:not(.map-pin-drop), .map-pin-other').length;
   let clustered = 0;
   for (const c of document.querySelectorAll('.map-pin-cluster')) clustered += Number(c.querySelector('text')?.textContent || 0);
   return { loose, clustered, total: loose + clustered };
};

const browser = await launch();
const ctx = await context(browser, PHONE);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await signIn(page);

/* which of my own spots are known for which fish */
const facts = await page.evaluate(async () => {
   const me = await fetch('/api/sites/me', { credentials: 'include' }).then((r) => r.json());
   const all = await fetch('/api/sites', { credentials: 'include' }).then((r) => r.json());
   const mine = new Set((me.sites ?? []).map((s) => s.id));
   const rows = (all.sites ?? []).filter((s) => mine.has(s.id));
   return {
      mineCount: (me.sites ?? []).filter((s) => s.latitude != null).length,
      allCount: (all.sites ?? []).filter((s) => s.latitude != null).length,
      mineSpecies: rows.map((s) => ({ name: s.name, fish: s.species.map((f) => f.name) })),
   };
});
console.log('== DATA ==', JSON.stringify(facts, null, 1));

await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page.waitForTimeout(4000);
/* zoom right out so every pin is in view and counted */
for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Zoom out' }).click(); await page.waitForTimeout(700); }
await page.waitForTimeout(1200);
console.log('all fish:', JSON.stringify(await page.evaluate(TOTAL)));

await page.getByRole('button', { name: 'Layers' }).click();
await page.waitForTimeout(600);
const rows = page.locator('.sheet [role=checkbox]');
const labels = await rows.allTextContents();
const want = labels.findIndex((t) => /GALJOEN/i.test(t));
await rows.nth(want).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Done' }).click();
await page.waitForTimeout(1500);
console.log('galjoen only:', JSON.stringify(await page.evaluate(TOTAL)));
await shot(page, 'map-filter-galjoen-phone', { x: 0, y: 0, ...PHONE });

/* ---- save a searched place as a spot, then take it away again ---- */
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page.waitForTimeout(3000);
const box = page.locator('input[type=search]').first();
await box.click();
await box.type('Struisbaai', { delay: 25 });
await page.waitForTimeout(2800);
await page.locator('[role=listbox] [role=option]').first().click();
await page.waitForTimeout(1800);
await page.getByRole('button', { name: 'Save as a spot' }).click();
await page.waitForTimeout(600);
const nameField = await page.locator('#found-spot-name').inputValue();
await page.locator('#found-spot-name').fill('Audit spot, delete me');
await shot(page, 'map-save-spot-phone', { x: 0, y: 0, ...PHONE });
await page.getByRole('button', { name: 'Save the spot' }).click();
await page.waitForTimeout(2500);
const afterSave = await page.evaluate(() => ({
   toast: document.body.innerText.match(/Spot saved[^|]*/)?.[0] ?? null,
   sheet: Boolean(document.querySelector('.sheet')),
   found: document.querySelectorAll('.map-pin-found').length,
   spots: document.querySelectorAll('.map-pin-spot:not(.map-pin-drop)').length,
}));
console.log('\nname field started as:', JSON.stringify(nameField));
console.log('after save:', JSON.stringify(afterSave));
await shot(page, 'map-saved-spot-phone', { x: 0, y: 0, ...PHONE });

/* clean up */
const cleaned = await page.evaluate(async () => {
   const me = await fetch('/api/sites/me', { credentials: 'include' }).then((r) => r.json());
   const row = (me.sites ?? []).find((s) => s.name === 'Audit spot, delete me');
   if (!row) return 'not found';
   const res = await fetch(`/api/sites/${row.id}`, { method: 'DELETE', credentials: 'include' });
   return `deleted ${row.id}: ${res.status}`;
});
console.log('cleanup:', cleaned);

/* ---- the empty map ---- */
await ctx.route('**/api/sites/me', (r) => r.fulfill({ json: { sites: [] } }));
await ctx.route('**/api/sites', (r) => r.fulfill({ json: { sites: [] } }));
await ctx.route('**/api/waypoints*', (r) => r.fulfill({ json: { waypoints: [] } }));
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page.waitForTimeout(3500);
console.log('\nempty map copy:', JSON.stringify(await page.evaluate(() => document.querySelector('main')?.innerText.replace(/\n+/g, ' | ').slice(0, 300))));
await shot(page, 'map-empty-phone', { x: 0, y: 0, ...PHONE });
/* the empty card's Find a place puts the cursor in the search */
await page.getByRole('button', { name: 'Find a place' }).click();
await page.waitForTimeout(400);
console.log('focus after Find a place:', await page.evaluate(() => document.activeElement?.getAttribute('type')));

console.log('\nerrors:', JSON.stringify(errors.slice(0, 5)));
await browser.close();
