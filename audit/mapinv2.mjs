import { launch, context, open, signIn, shot, PHONE, HOST } from './lib.mjs';

/* Centre + zoom read off the satellite tiles, which carry z/y/x in the URL. */
const VIEW = `(() => {
  const c = document.querySelector('.leaflet-container');
  if (!c) return null;
  const box = c.getBoundingClientRect();
  const cx = box.left + box.width/2, cy = box.top + box.height/2;
  const tiles = [...c.querySelectorAll('img.leaflet-tile')].map(img => {
    const m = img.src.match(/MapServer\\/tile\\/(\\d+)\\/(\\d+)\\/(\\d+)/);
    if (!m) return null;
    return { z:+m[1], y:+m[2], x:+m[3], r: img.getBoundingClientRect() };
  }).filter(Boolean);
  if (!tiles.length) return { note:'no arcgis tiles' };
  const zmax = Math.max(...tiles.map(t=>t.z));
  const t = tiles.filter(t=>t.z===zmax)
    .sort((a,b)=>Math.hypot((a.r.left+a.r.width/2)-cx,(a.r.top+a.r.height/2)-cy)-Math.hypot((b.r.left+b.r.width/2)-cx,(b.r.top+b.r.height/2)-cy))[0];
  const fx = (cx - t.r.left)/t.r.width, fy = (cy - t.r.top)/t.r.height;
  const n = Math.pow(2, t.z);
  const lng = ((t.x + fx)/n)*360 - 180;
  const ly = Math.PI - 2*Math.PI*(t.y + fy)/n;
  const lat = (180/Math.PI)*Math.atan(0.5*(Math.exp(ly)-Math.exp(-ly)));
  return { lat:+lat.toFixed(4), lng:+lng.toFixed(4), z:t.z };
})()`;

const state = (page) => page.evaluate(`(() => {
  const r = (el) => { if(!el) return null; const q = el.getBoundingClientRect(); return {t:Math.round(q.top),b:Math.round(q.bottom),l:Math.round(q.left),r:Math.round(q.right),w:Math.round(q.width),h:Math.round(q.height)}; };
  return {
    view: ${VIEW},
    markers: document.querySelectorAll('.leaflet-marker-icon').length,
    clusters: document.querySelectorAll('.map-pin-cluster').length,
    drop: document.querySelectorAll('.map-pin-drop').length,
    popup: r(document.querySelector('.leaflet-popup')),
    popupText: (document.querySelector('.leaflet-popup-content')?.innerText||'').replace(/\\n/g,' | ').slice(0,200),
    zoomCtl: r(document.querySelector('.leaflet-control-zoom')),
    attrib: r(document.querySelector('.leaflet-control-attribution')),
    search: r(document.querySelector('input[type=search]')),
    toolbar: r(document.querySelector('.grid.grid-cols-5')),
    surface: r(document.querySelector('.map-surface')),
    nav: r(document.querySelector('nav')),
    vw: innerWidth, vh: innerHeight, scrollH: document.documentElement.scrollHeight
  };
})()`);

const run = async () => {
  const browser = await launch();
  const ctx = await context(browser, PHONE, { hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const api = [];
  page.on('response', (res) => {
    const u = res.url();
    if (/\/api\//.test(u)) {
      const t = res.request().timing();
      api.push(`${res.status()} ${Math.round(t.responseEnd)}ms ${decodeURIComponent(u.replace(HOST,''))}`);
    }
  });
  const errors = [];
  page.on('console', (m) => { if (m.type()==='error') errors.push(m.text().slice(0,160)); });

  await signIn(page);
  await open(page, '/map', 5000);
  console.log('== PHONE /map (touch) initial ==');
  console.log(JSON.stringify(await state(page)));
  await shot(page, 'mi2-phone-initial', { x:0,y:0,...PHONE });

  // --- google maps link
  const box = page.locator('input[type=search]').first();
  await box.click(); await box.fill('https://www.google.com/maps/@-34.0964,18.3086,15z');
  await page.waitForTimeout(2500);
  console.log('\n-- google link: options =', await page.locator('[role=option]').count(), ' listbox visible =', await page.locator('[role=listbox]').count());
  console.log('   view now:', JSON.stringify((await state(page)).view));
  await shot(page, 'mi2-phone-gmaps', {x:0,y:0,...PHONE});

  // --- coordinate pair
  await box.fill(''); await box.fill('-34.1275, 18.4487');
  await page.waitForTimeout(2500);
  const coordHits = await page.locator('[role=option]').allTextContents();
  console.log('\n-- coord pair hits:', JSON.stringify(coordHits.slice(0,3)));
  await shot(page, 'mi2-phone-coords', {x:0,y:0,...PHONE});

  // --- a real search then look at what is on the map
  await box.fill(''); await box.fill('Struisbaai');
  await page.waitForTimeout(2200);
  const before = await state(page);
  await page.locator('[role=option]').first().click();
  await page.waitForTimeout(3000);
  const after = await state(page);
  console.log('\n-- Struisbaai picked: view before', JSON.stringify(before.view), '-> after', JSON.stringify(after.view));
  console.log('   drop pins after:', after.drop, ' markers:', after.markers, ' popup:', after.popup);
  await shot(page, 'mi2-phone-struisbaai', {x:0,y:0,...PHONE});

  // --- tap a pin, see the popup
  await page.mouse.wheel(0,0);
  const pin = page.locator('.leaflet-marker-icon').first();
  if (await pin.count()) {
    await pin.click({ force: true });
    await page.waitForTimeout(1200);
    const s = await state(page);
    console.log('\n-- popup after tapping a pin:', JSON.stringify(s.popup), '\n   text:', s.popupText);
    await shot(page, 'mi2-phone-popup', {x:0,y:0,...PHONE});
  }

  // --- the Mark control (arm + tap)
  await page.keyboard.press('Escape');
  const markBtn = page.getByRole('button', { name: /^Mark$/ });
  if (await markBtn.count()) {
    await markBtn.click();
    await page.waitForTimeout(400);
    console.log('\n-- armed. label now:', await page.locator('.grid-cols-5 button').nth(2).innerText());
    await page.mouse.click(195, 380);
    await page.waitForTimeout(1500);
    const s = await state(page);
    console.log('   after tap: drop pins =', s.drop, ' panel present =', await page.getByText('Drop a mark').count());
    await shot(page, 'mi2-phone-mark', {x:0,y:0,...PHONE});
    const panel = await page.evaluate(`(() => { const el=[...document.querySelectorAll('div')].find(d=>d.className.includes('thread-scroll')&&d.className.includes('bottom-0')); if(!el) return null; const q=el.getBoundingClientRect(); return {t:Math.round(q.top),b:Math.round(q.bottom),h:Math.round(q.height)};})()`);
    console.log('   naming panel rect:', JSON.stringify(panel));
    const cancel = page.getByRole('button', { name: 'Cancel' });
    if (await cancel.count()) await cancel.click();
    await page.waitForTimeout(500);
  }

  // --- layers sheet
  const layers = page.getByRole('button', { name: 'Layers' });
  if (await layers.count()) {
    await layers.click(); await page.waitForTimeout(700);
    await shot(page, 'mi2-phone-layers', {x:0,y:0,...PHONE});
    const sheet = await page.evaluate(`(() => { const el=document.querySelector('.sheet'); if(!el) return null; const q=el.getBoundingClientRect(); return {t:Math.round(q.top),b:Math.round(q.bottom),h:Math.round(q.height)};})()`);
    console.log('\n-- layers sheet rect:', JSON.stringify(sheet));
    // switch to Plain
    const plain = page.getByRole('radio', { name: 'Plain' });
    if (await plain.count()) { await plain.click(); await page.waitForTimeout(1500); }
    const done = page.getByRole('button', { name: 'Done' });
    if (await done.count()) await done.click();
    await page.waitForTimeout(1500);
    await shot(page, 'mi2-phone-plain', {x:0,y:0,...PHONE});
    console.log('   after Plain: data-base =', await page.getAttribute('.map-surface','data-base'), ' tiles =', await page.locator('img.leaflet-tile-loaded').count());
  }

  console.log('\n== API ==\n' + api.join('\n'));
  console.log('\n== ERRORS ==\n' + errors.slice(0,12).join('\n'));
  await browser.close();
};
run().catch(e=>{console.error(e);process.exit(1);});
