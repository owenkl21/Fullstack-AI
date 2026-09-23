import { launch, context, open, signIn, shot, PHONE, DESK, HOST } from './lib.mjs';
const R = `(sel) => { const el=document.querySelector(sel); if(!el) return null; const q=el.getBoundingClientRect(); return {t:Math.round(q.top),b:Math.round(q.bottom),l:Math.round(q.left),r:Math.round(q.right),w:Math.round(q.width),h:Math.round(q.height)}; }`;

const run = async () => {
  const browser = await launch();

  // ---------- DESKTOP ----------
  const dctx = await context(browser, DESK);
  const d = await dctx.newPage();
  const dapi = [];
  d.on('response', r => { if (/\/api\//.test(r.url())) dapi.push(`${r.status()} ${Math.round(r.request().timing().responseEnd)}ms ${decodeURIComponent(r.url().replace(HOST,''))}`); });
  const derr = []; d.on('console', m => { if(m.type()==='error') derr.push(m.text().slice(0,160)); });
  await signIn(d);
  await open(d, '/map', 5000);
  console.log('== DESK /map ==');
  console.log(' surface', JSON.stringify(await d.evaluate(`(${R})('.map-surface')`)));
  console.log(' toolbar', JSON.stringify(await d.evaluate(`(${R})('.absolute.top-3.left-3')`)));
  console.log(' zoom   ', JSON.stringify(await d.evaluate(`(${R})('.leaflet-control-zoom')`)));
  console.log(' legend ', JSON.stringify(await d.evaluate(`(${R})('[aria-label="What the pins mean"]')`)));
  console.log(' locate ', JSON.stringify(await d.evaluate(`(${R})('[aria-label="Go to where I am"]')`)));
  console.log(' search ', JSON.stringify(await d.evaluate(`(${R})('input[type=search]')`)));
  console.log(' attrib ', JSON.stringify(await d.evaluate(`(${R})('.leaflet-control-attribution')`)));
  console.log(' markers', await d.locator('.leaflet-marker-icon').count(), ' clusters', await d.locator('.map-pin-cluster').count());
  console.log(' heading copy:', (await d.locator('h1 + p, section p').first().innerText()).replace(/\n/g,' '));
  await shot(d, 'mi4-desk-map', {x:0,y:0,...DESK});

  // zoom in so POIs load, wait for overpass
  const dbox = d.locator('input[type=search]').first();
  await dbox.click(); await dbox.fill('Kalk Bay'); await d.waitForTimeout(2200);
  await d.locator('[role=option]').first().click();
  await d.waitForTimeout(9000);
  console.log('\n after Kalk Bay (desk): markers', await d.locator('.leaflet-marker-icon').count(),
    ' ramps', await d.locator('.map-pin-ramp').count(), ' tackle', await d.locator('.map-pin-tackle').count(),
    ' marina', await d.locator('.map-pin-marina').count(), ' parking', await d.locator('.map-pin-parking').count());
  await shot(d, 'mi4-desk-kalkbay', {x:0,y:0,...DESK});
  console.log('\n DESK API:\n' + dapi.join('\n'));
  console.log('\n DESK ERRORS:\n' + derr.slice(0,10).join('\n'));

  // ---------- PHONE: no geolocation permission ----------
  const nctx = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true, permissions: [] });
  const n = await nctx.newPage();
  await signIn(n);
  await open(n, '/map', 5000);
  console.log('\n== PHONE, geolocation DENIED ==');
  await n.getByRole('button', { name: 'Locate' }).click();
  await n.waitForTimeout(6000);
  console.log(' bar cells:', JSON.stringify(await n.locator('.grid-cols-5 > *').allInnerTexts()));
  console.log(' any message on screen?', (await n.locator('body').innerText()).replace(/\n+/g,' | ').slice(0,300));
  await shot(n, 'mi4-phone-denied', {x:0,y:0,...PHONE});

  // ---------- PHONE: /log map ----------
  const p = await (await context(browser, PHONE, { hasTouch:true, isMobile:true })).newPage();
  await signIn(p);
  await open(p, '/log', 5000);
  console.log('\n== PHONE /log ==');
  console.log(' map-surface', JSON.stringify(await p.evaluate(`(${R})('.map-surface')`)));
  console.log(' search field?', await p.locator('input[type=search]').count(), ' role=search', await p.locator('[role=search]').count());
  console.log(' body:', (await p.locator('body').innerText()).replace(/\n+/g,' | ').slice(0,500));
  await shot(p, 'mi4-phone-log', {x:0,y:0,...PHONE});

  await browser.close();
};
run().catch(e=>{console.error(e);process.exit(1);});
