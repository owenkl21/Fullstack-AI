import { launch, context, open, signIn, PHONE } from './lib.mjs';

const b = await launch();
const ctx = await context(b, PHONE, { hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await signIn(page);

/* ---------- /map ---------- */
await open(page, '/map', 5000);

console.log('== DOM relationship on /map ==');
console.log(JSON.stringify(await page.evaluate(() => {
   const lc = document.querySelector('.leaflet-container');
   const q = (s) => document.querySelector(s);
   const search = q('input[type=search]');
   const bar = [...document.querySelectorAll('button')].find(b => /^(Mark|Tap map)$/i.test(b.innerText.trim()));
   const legend = q('[aria-label="What the pins mean"]');
   return {
      leafletContainerClass: lc ? lc.className : null,
      leafletParentClass: lc ? lc.parentElement.className : null,
      searchInsideLeaflet: search ? !!search.closest('.leaflet-container') : 'no search',
      searchParentChain: search ? (() => { const c=[]; let e=search; while(e && c.length<6){c.push(e.tagName+'.'+String(e.className).slice(0,40)); e=e.parentElement;} return c; })() : null,
      barButtonInsideLeaflet: bar ? !!bar.closest('.leaflet-container') : 'no bar button',
      legendInsideLeaflet: legend ? !!legend.closest('.leaflet-container') : 'no legend (phone)',
      leafletTouchAction: lc ? getComputedStyle(lc).touchAction : null,
      searchTouchAction: search ? getComputedStyle(search).touchAction : null,
      htmlTouchAction: getComputedStyle(document.documentElement).touchAction,
      bodyTouchAction: getComputedStyle(document.body).touchAction,
   };
}, null), null, 2));

/* Instrument the leaflet container and read the map's zoom out of its DOM transform + a hook */
await page.evaluate(() => {
   window.__hits = [];
   const lc = document.querySelector('.leaflet-container');
   for (const t of ['pointerdown','touchstart','click','dblclick','mousedown']) {
      lc.addEventListener(t, (e) => window.__hits.push(t + ' target=' + e.target.tagName + '.' + String(e.target.className).slice(0,30)), true);
   }
});

const zoomOf = () => page.evaluate(() => {
   /* Leaflet writes the zoom into the tile layer's tile src and into the container's class on animation;
      the attribution-free way: read a tile's data-* or the tile src z. */
   const tile = document.querySelector('.leaflet-tile-loaded, .leaflet-tile');
   const m = tile && tile.src && tile.src.match(/\/(\d+)\/(\d+)\/(\d+)(?:\.|\?|$)/);
   /* Esri: .../tile/{z}/{y}/{x} */
   const z = m ? Number(m[1]) : null;
   return { z, tiles: document.querySelectorAll('.leaflet-tile').length,
            pane: (document.querySelector('.leaflet-map-pane')||{}).style ? document.querySelector('.leaflet-map-pane').style.transform : null };
});

console.log('\n== zoom before search tap ==', JSON.stringify(await zoomOf()));

const box = await page.locator('input[type=search]').first().boundingBox();
console.log('search box', JSON.stringify(box));
/* two fast taps on the search field, like a real thumb correcting itself */
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(80);
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(1500);
console.log('zoom after double tap on search =', JSON.stringify(await zoomOf()));
console.log('leaflet container heard:', JSON.stringify(await page.evaluate(() => window.__hits)));
console.log('activeElement:', JSON.stringify(await page.evaluate(() => {
   const a = document.activeElement; if (!a) return null;
   return { tag: a.tagName, type: a.getAttribute('type'), fs: getComputedStyle(a).fontSize, ph: a.getAttribute('placeholder') };
})));

/* double tap on a bar control */
await page.evaluate(() => { window.__hits = []; });
const mark = page.getByRole('button', { name: /^Mark$/ });
if (await mark.count()) {
   const mb = await mark.first().boundingBox();
   await page.touchscreen.tap(mb.x + mb.width/2, mb.y + mb.height/2);
   await page.waitForTimeout(70);
   await page.touchscreen.tap(mb.x + mb.width/2, mb.y + mb.height/2);
   await page.waitForTimeout(1200);
   console.log('\nzoom after double tap on the Mark bar control =', JSON.stringify(await zoomOf()));
   console.log('leaflet container heard:', JSON.stringify(await page.evaluate(() => window.__hits)));
}

/* double tap on the map itself, for the control */
await page.evaluate(() => { window.__hits = []; });
await page.touchscreen.tap(195, 420); await page.waitForTimeout(60);
await page.touchscreen.tap(195, 420); await page.waitForTimeout(1500);
console.log('\nzoom after double tap on the water =', JSON.stringify(await zoomOf()));

/* ---------- /log map picker ---------- */
await open(page, '/log', 5000);
console.log('\n== DOM relationship on /log picker ==');
console.log(JSON.stringify(await page.evaluate(() => {
   const lc = document.querySelector('.leaflet-container');
   const btns = [...document.querySelectorAll('button')].filter(b => /Search for a place|Put the pin where I am|SAT/i.test(b.innerText || b.getAttribute('aria-label') || ''));
   return {
      overlayButtonsInsideLeaflet: btns.map(b => ({ label: (b.getAttribute('aria-label')||b.innerText).slice(0,40), inside: !!b.closest('.leaflet-container') })),
      leafletParent: lc ? lc.parentElement.className.slice(0,120) : null,
      leafletTouchAction: lc ? getComputedStyle(lc).touchAction : null,
   };
}), null, 2));

/* open the picker search, double tap it, watch the map */
await page.evaluate(() => { window.__hits = []; const lc = document.querySelector('.leaflet-container');
   for (const t of ['pointerdown','click','dblclick']) lc.addEventListener(t, (e) => window.__hits.push(t+' '+e.target.tagName), true); });
console.log('zoom before =', JSON.stringify(await zoomOf()));
try {
   await page.getByRole('button', { name: /Search for a place/i }).click({ timeout: 3000 });
   await page.waitForTimeout(700);
   const sb = await page.locator('input[type=search]').first().boundingBox();
   await page.touchscreen.tap(sb.x + sb.width/2, sb.y + sb.height/2); await page.waitForTimeout(70);
   await page.touchscreen.tap(sb.x + sb.width/2, sb.y + sb.height/2); await page.waitForTimeout(1500);
   console.log('zoom after double tap on picker search =', JSON.stringify(await zoomOf()));
   console.log('leaflet container heard:', JSON.stringify(await page.evaluate(() => window.__hits)));
} catch (e) { console.log('picker search: ' + String(e).slice(0,120)); }

await b.close();
