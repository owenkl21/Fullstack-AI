import { launch, context, open, signIn, shot, PHONE, DESK, HOST } from './lib.mjs';

const R = `(sel) => { const el=document.querySelector(sel); if(!el) return null; const q=el.getBoundingClientRect(); return {t:Math.round(q.top),b:Math.round(q.bottom),l:Math.round(q.left),r:Math.round(q.right),w:Math.round(q.width),h:Math.round(q.height)}; }`;

async function tapVisiblePin(page, kindClass) {
  const found = await page.evaluate(`(() => {
    const sel = ${JSON.stringify(kindClass)};
    const pins = [...document.querySelectorAll(sel)];
    for (const p of pins) {
      const q = p.getBoundingClientRect();
      if (q.top > 130 && q.bottom < innerHeight - 120 && q.left > 8 && q.right < innerWidth - 8) {
        return { x: Math.round(q.left+q.width/2), y: Math.round(q.top+q.height-8), title: p.getAttribute('title') };
      }
    }
    return null;
  })()`);
  if (!found) return null;
  await page.mouse.click(found.x, found.y);
  await page.waitForTimeout(1000);
  return found;
}

const run = async () => {
  const browser = await launch();
  const ctx = await context(browser, PHONE, { hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type()==='error') errors.push(m.text().slice(0,160)); });
  await signIn(page);
  await open(page, '/map', 5000);

  // zoom in to Kommetjie so pins separate and POIs load
  const box = page.locator('input[type=search]').first();
  await box.click(); await box.fill('Kalk Bay');
  await page.waitForTimeout(2200);
  await page.locator('[role=option]').first().click();
  await page.waitForTimeout(4000);
  console.log('after Kalk Bay: markers', await page.locator('.leaflet-marker-icon').count(),
              ' clusters', await page.locator('.map-pin-cluster').count(),
              ' hint', await page.getByText(/Zoom in for slipways/).count());
  await shot(page, 'mi3-kalkbay', {x:0,y:0,...PHONE});

  // tap a spot pin
  for (const k of ['.map-pin-spot','.map-pin-other','.map-pin-waypoint','.leaflet-marker-icon']) {
    const hit = await tapVisiblePin(page, k);
    if (hit) {
      const p = await page.evaluate(`(${R})('.leaflet-popup')`);
      const txt = await page.evaluate(`(document.querySelector('.leaflet-popup-content')?.innerText||'').replace(/\\n/g,' | ')`);
      console.log('\ntapped', k, hit.title, '-> popup', JSON.stringify(p), '\n  ', txt);
      const acts = await page.locator('.map-card-act').allTextContents();
      console.log('   actions:', JSON.stringify(acts));
      if (p) { await shot(page, 'mi3-popup-'+k.replace(/\W+/g,''), {x:0,y:0,...PHONE}); break; }
    }
  }

  // close popup, arm Mark
  await page.evaluate("document.querySelector('.leaflet-popup-close-button')?.click()");
  await page.waitForTimeout(400);
  const bar = page.locator('.grid-cols-5 > *');
  console.log('\nbar cells:', JSON.stringify(await bar.allInnerTexts()));
  await page.getByRole('button', { name: /^Mark$/ }).click();
  await page.waitForTimeout(400);
  console.log('after arming, bar cells:', JSON.stringify(await bar.allInnerTexts()));
  await page.mouse.click(195, 400);
  await page.waitForTimeout(1600);
  console.log('drop pins:', await page.locator('.map-pin-drop').count(),
              ' panel:', JSON.stringify(await page.evaluate(`(${R})('.thread-scroll.absolute')`)));
  await shot(page, 'mi3-mark-panel', {x:0,y:0,...PHONE});
  // does the panel cover the bar / the pin?
  console.log('  drop pin rect:', JSON.stringify(await page.evaluate(`(${R})('.map-pin-drop')`)));
  console.log('  toolbar rect:', JSON.stringify(await page.evaluate(`(${R})('.grid-cols-5')`)));
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(500);

  // long press
  const bb = await page.evaluate(`(${R})('.leaflet-container')`);
  await page.touchscreen.tap(200, 300);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const el = document.querySelector('.leaflet-container');
    el.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, clientX:200, clientY:300}));
  });
  await page.waitForTimeout(1200);
  console.log('\nafter synthetic contextmenu: drop pins', await page.locator('.map-pin-drop').count());
  if (await page.getByRole('button', { name: 'Cancel' }).count()) await page.getByRole('button', { name: 'Cancel' }).click();

  // Log here
  await page.getByRole('button', { name: 'Log here' }).click();
  await page.waitForTimeout(2500);
  console.log('\nLog here -> url', page.url());
  await shot(page, 'mi3-loghere', {x:0,y:0,...PHONE});
  await page.goBack(); await page.waitForTimeout(2500);

  console.log('\nERRORS:', errors.slice(0,10).join(' // '));
  await browser.close();
};
run().catch(e=>{console.error(e);process.exit(1);});
