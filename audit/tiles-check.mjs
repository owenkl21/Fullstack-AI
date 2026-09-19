import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';

/* Two tile fixes, read off the network: the Plain base must no longer ask
   CARTO for anything, and Satellite must never request a z19 tile. */
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const errors = [];
const tiles = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('request', (r) => {
   const u = r.url();
   if (/cartocdn|arcgisonline|opentopomap|openstreetmap\.org\/\d/.test(u))
      tiles.push(u);
});
await signIn(page);
const pass = (name, ok, note = '') =>
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  ' + note : ''}`);

await open(page, '/map', 4500);

/* Plain */
await page.getByRole('button', { name: /^Layers/ }).first().click();
await page.waitForTimeout(600);
await page.getByRole('radio', { name: /Plain/ }).click();
await page.waitForTimeout(400);
const close = page.getByRole('button', { name: /^Done$/ }).first();
if (await close.count()) await close.click({ timeout: 1500 }).catch(() => {});
else await page.keyboard.press('Escape');
await page.waitForTimeout(2500);
const plainReq = tiles.filter((u) => /Light_Gray/.test(u)).length;
const cartoReq = tiles.filter((u) => /cartocdn/.test(u)).length;
pass('plain base asks Esri grey canvas', plainReq > 0, `${plainReq} tiles`);
pass('plain base asks CARTO for nothing', cartoReq === 0, `${cartoReq} tiles`);
await shot(page, 'tiles-plain-phone');

/* Satellite at the last zoom step */
await page.getByRole('button', { name: /^(Layers|Plain)/ }).first().click();
await page.waitForTimeout(600);
await page.getByRole('radio', { name: /Satellite/ }).click();
await page.waitForTimeout(400);
if (await close.count()) await close.click({ timeout: 1500 }).catch(() => {});
else await page.keyboard.press('Escape');
await page.waitForTimeout(800);
tiles.length = 0;
for (let i = 0; i < 11; i++) {
   await page.getByRole('button', { name: 'Zoom in' }).click();
   await page.waitForTimeout(500);
}
await page.waitForTimeout(3000);
const zooms = [...new Set(tiles.filter((u) => /World_Imagery/.test(u)).map((u) => (u.match(/tile\/(\d+)\//) || [])[1]))].sort();
const z19 = tiles.filter((u) => /World_Imagery\/MapServer\/tile\/19\//.test(u)).length;
const domZ = await page.evaluate(() => {
   const t = document.querySelector('.leaflet-tile-pane img');
   return t ? (t.src.match(/tile\/(\d+)\//) || [])[1] : null;
});
pass('satellite never asks for a z19 tile', z19 === 0, `zooms asked: ${zooms.join(',')} | drawn tile z ${domZ}`);
await shot(page, 'tiles-sat-z19-phone');
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
