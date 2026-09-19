import { launch, context, open, signIn, shot, PHONE, HOST } from './lib.mjs';

const TERMS = ['Kalk Bay','Rooi-Els','Vaal Dam','Oranjeville','Struisbaai','Mimosa','-34.1275, 18.4487','https://www.google.com/maps/@-34.0964,18.3086,15z'];

const state = (page) => page.evaluate(() => {
  const m = window.__map || null;
  const surf = document.querySelector('.map-surface');
  const markers = document.querySelectorAll('.leaflet-marker-icon').length;
  const clusters = document.querySelectorAll('.map-pin-cluster').length;
  const drop = document.querySelectorAll('.map-pin-drop').length;
  const popup = document.querySelectorAll('.leaflet-popup').length;
  const r = (el) => { if(!el) return null; const q = el.getBoundingClientRect(); return {t:Math.round(q.top),b:Math.round(q.bottom),l:Math.round(q.left),r:Math.round(q.right),w:Math.round(q.width),h:Math.round(q.height)}; };
  return {
    markers, clusters, drop, popup,
    surface: r(surf),
    vw: innerWidth, vh: innerHeight,
    tiles: document.querySelectorAll('.leaflet-tile-loaded').length,
    attribution: (document.querySelector('.leaflet-control-attribution')?.textContent||'').slice(0,60),
  };
});

/* Read leaflet's centre/zoom out of the DOM by hooking the map instance. */
const hookMap = (page) => page.addInitScript(() => {
  const iv = setInterval(() => {
    const el = document.querySelector('.leaflet-container');
    if (el && el._leaflet_id && window.L) {
      // leaflet keeps maps in L.Map instances; find via the container's _leaflet_events? fallback below
    }
  }, 500);
  setTimeout(() => clearInterval(iv), 30000);
});

const centre = (page) => page.evaluate(() => {
  /* Derive centre + zoom from the tile layer transform is fragile; instead read
     leaflet's own container and use its _leaflet map through the global patch. */
  const el = document.querySelector('.leaflet-container');
  if (!el) return null;
  const keys = Object.keys(el);
  // leaflet stores the map on the container as `_leaflet_id` only; use the
  // internal map registry on L
  return null;
});

const run = async () => {
  const browser = await launch();
  const ctx = await context(browser, PHONE);
  const page = await ctx.newPage();
  const api = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (/\/api\/(places|sites|waypoints)/.test(u)) {
      const t = res.request().timing();
      api.push({ url: u.replace(HOST,''), status: res.status(), ms: Math.round(t.responseEnd - t.startTime) });
    }
  });
  const errors = [];
  page.on('console', (m) => { if (m.type()==='error') errors.push(m.text().slice(0,200)); });

  await signIn(page);
  await open(page, '/map', 5000);

  /* expose the leaflet map */
  await page.evaluate(() => {
    const el = document.querySelector('.leaflet-container');
    // leaflet does not expose the map; reach it through the pane's _leaflet map ref
    // We use L's internal: every map sets el._leaflet_id; and L.Map instances are
    // reachable through the DOM event store. Use a patched approach instead:
  });

  console.log('== PHONE /map initial ==');
  console.log(JSON.stringify(await state(page), null, 1));
  await shot(page, 'mapinv-phone-initial', { x:0, y:0, ...PHONE });

  for (const term of TERMS) {
    const box = page.locator('input[type=search]').first();
    await box.click();
    await box.fill('');
    const t0 = Date.now();
    await box.type(term, { delay: 30 });
    await page.waitForTimeout(1600);
    const list = await page.locator('[role=listbox] [role=option]').allTextContents();
    const ms = Date.now() - t0;
    const before = await state(page);
    let picked = null;
    if (list.length) {
      picked = list[0];
      await page.locator('[role=listbox] [role=option]').first().click();
      await page.waitForTimeout(2500);
    }
    const after = await state(page);
    console.log('\n== SEARCH ' + JSON.stringify(term) + ' ==');
    console.log(' hits(' + list.length + '):', JSON.stringify(list.slice(0,5)));
    console.log(' typed->list ms ~', ms);
    console.log(' picked:', picked);
    console.log(' markers before/after:', before.markers, '/', after.markers, ' drop:', after.drop, ' popup:', after.popup);
    await shot(page, 'mapinv-phone-' + term.replace(/[^a-z0-9]+/gi,'-').slice(0,24), { x:0, y:0, ...PHONE });
  }

  console.log('\n== API ==');
  console.log(api.map(a=>`${a.status} ${a.ms}ms ${a.url}`).join('\n'));
  console.log('\n== CONSOLE ERRORS ==');
  console.log(errors.slice(0,15).join('\n'));

  await browser.close();
};
run().catch(e=>{console.error(e);process.exit(1);});
