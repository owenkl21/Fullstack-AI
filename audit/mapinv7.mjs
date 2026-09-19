import { launch, context, open, signIn, shot, PHONE, HOST } from './lib.mjs';
const run = async () => {
  const browser = await launch();

  // ---- brand new angler: no spots of mine, nothing public ----
  const ctx = await context(browser, PHONE, { hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await signIn(page);
  await page.route('**/api/sites/me*', r => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({sites:[]}) }));
  await page.route('**/api/sites', r => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({sites:[]}) }));
  await page.route('**/api/waypoints', r => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({waypoints:[]}) }));
  await open(page, '/map', 6000);
  console.log('== PHONE /map, EMPTY (no spots, none public, no marks) ==');
  console.log(' markers', await page.locator('.leaflet-marker-icon').count());
  console.log(' body:', (await page.locator('body').innerText()).replace(/\n+/g,' | '));
  await shot(page, 'mi7-phone-empty', {x:0,y:0,...PHONE});

  // ---- slow/failed search ----
  const p2 = await (await context(browser, PHONE, { hasTouch:true, isMobile:true })).newPage();
  await signIn(p2);
  await p2.route('**/api/places/search*', r => r.fulfill({ status:503, contentType:'application/json', body: JSON.stringify({places:[],failed:true}) }));
  await open(p2, '/map', 5000);
  const b2 = p2.locator('input[type=search]').first();
  await b2.click(); await b2.fill('Struisbaai');
  await p2.waitForTimeout(2500);
  console.log('\n== search returns 503 ==');
  console.log(' listbox', await p2.locator('[role=listbox]').count(), ' options', await p2.locator('[role=option]').count());
  console.log(' anything said?', (await p2.locator('body').innerText()).includes('Nothing') ? 'yes' : 'no');
  await shot(p2, 'mi7-search-failed', {x:0,y:0,...PHONE});

  // ---- a search that legitimately finds nothing ----
  await p2.unroute('**/api/places/search*');
  await b2.fill(''); await b2.fill('zzzqqqxyz');
  await p2.waitForTimeout(3000);
  console.log('\n== search finds nothing ==');
  console.log(' listbox', await p2.locator('[role=listbox]').count(), ' options', await p2.locator('[role=option]').count());
  console.log(' body tail:', (await p2.locator('body').innerText()).replace(/\n+/g,' | ').slice(0,200));
  await shot(p2, 'mi7-search-nothing', {x:0,y:0,...PHONE});

  // ---- POIs: does the places layer ever fill, and how long ----
  const p3 = await (await context(browser, PHONE, { hasTouch:true, isMobile:true })).newPage();
  const times = [];
  p3.on('response', async (r) => { if (/\/api\/places\?/.test(r.url())) times.push(`${r.status()} ${Math.round(r.request().timing().responseEnd)}ms`); });
  await signIn(p3);
  await open(p3, '/map', 4000);
  const b3 = p3.locator('input[type=search]').first();
  await b3.click(); await b3.fill('Kalk Bay'); await p3.waitForTimeout(2300);
  await p3.locator('[role=option]').first().click();
  for (let i=0;i<6;i++){ await p3.waitForTimeout(2000);
    console.log(` t+${(i+1)*2}s ramps=${await p3.locator('.map-pin-ramp').count()} tackle=${await p3.locator('.map-pin-tackle').count()} marina=${await p3.locator('.map-pin-marina').count()} parking=${await p3.locator('.map-pin-parking').count()} reqs=${times.length}`);
  }
  console.log(' place reqs:', times.join(', '));
  await shot(p3, 'mi7-pois', {x:0,y:0,...PHONE});
  await browser.close();
};
run().catch(e=>{console.error(e);process.exit(1);});
