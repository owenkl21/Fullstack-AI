import { launch, context, open, signIn, shot, PHONE, DESK, HOST } from './lib.mjs';
const VIEW = `(() => {
  const c = document.querySelector('.leaflet-container'); if (!c) return null;
  const box = c.getBoundingClientRect(); const cx = box.left+box.width/2, cy = box.top+box.height/2;
  const tiles = [...c.querySelectorAll('img.leaflet-tile')].map(img => { const m = img.src.match(/MapServer\\/tile\\/(\\d+)\\/(\\d+)\\/(\\d+)/); return m ? {z:+m[1],y:+m[2],x:+m[3],r:img.getBoundingClientRect()} : null; }).filter(Boolean);
  if (!tiles.length) return null;
  const zmax = Math.max(...tiles.map(t=>t.z));
  const t = tiles.filter(t=>t.z===zmax).sort((a,b)=>Math.hypot((a.r.left+a.r.width/2)-cx,(a.r.top+a.r.height/2)-cy)-Math.hypot((b.r.left+b.r.width/2)-cx,(b.r.top+b.r.height/2)-cy))[0];
  const fx=(cx-t.r.left)/t.r.width, fy=(cy-t.r.top)/t.r.height, n=Math.pow(2,t.z);
  const lng=((t.x+fx)/n)*360-180, ly=Math.PI-2*Math.PI*(t.y+fy)/n;
  return { lat:+((180/Math.PI)*Math.atan(0.5*(Math.exp(ly)-Math.exp(-ly)))).toFixed(4), lng:+lng.toFixed(4), z:t.z };
})()`;
const run = async () => {
  const browser = await launch();
  const ctx = await context(browser, PHONE, { hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await signIn(page);

  // ---- timeline of the first load (no stored fix) ----
  await page.evaluate(() => localStorage.removeItem('position-fix'));
  await page.goto(HOST + '/map', { waitUntil: 'commit' });
  for (let i=0;i<10;i++) { await page.waitForTimeout(500); console.log(`t+${(i+1)*0.5}s`, JSON.stringify(await page.evaluate(VIEW))); }

  console.log('\n--- LOCATE, first tap (no fix yet) ---');
  await page.getByRole('button', { name: 'Locate' }).click();
  for (let i=0;i<6;i++) { await page.waitForTimeout(700); console.log(` +${((i+1)*0.7).toFixed(1)}s`, JSON.stringify(await page.evaluate(VIEW))); }
  console.log('\n--- LOCATE, second tap (fix now stored) ---');
  await page.getByRole('button', { name: 'Locate' }).click();
  for (let i=0;i<5;i++) { await page.waitForTimeout(700); console.log(` +${((i+1)*0.7).toFixed(1)}s`, JSON.stringify(await page.evaluate(VIEW))); }
  await shot(page, 'mi6-second-locate', {x:0,y:0,...PHONE});

  // ---- desktop: same first-tap test ----
  const d = await (await context(browser, DESK)).newPage();
  await signIn(d);
  await d.evaluate(() => localStorage.removeItem('position-fix'));
  await open(d, '/map', 6000);
  console.log('\n=== DESK before locate', JSON.stringify(await d.evaluate(VIEW)));
  await d.locator('[aria-label="Go to where I am"]').click();
  for (let i=0;i<5;i++) { await d.waitForTimeout(800); console.log(' +', JSON.stringify(await d.evaluate(VIEW))); }

  // ---- what /api/sites returns ----
  const sites = await d.evaluate(async () => {
    const r = await fetch('/api/sites', { credentials:'include' });
    const j = await r.json();
    const rows = j.sites ?? [];
    return { total: rows.length, noCoords: rows.filter(s=>s.latitude==null).length,
      sample: rows.slice(0,3).map(s=>({n:s.name, by:s.createdByName, c:s.catchCount})) };
  });
  console.log('\n/api/sites ->', JSON.stringify(sites));
  const mine = await d.evaluate(async () => { const r = await fetch('/api/sites/me',{credentials:'include'}); const j = await r.json(); const rows=j.sites??[]; return { total: rows.length, noCoords: rows.filter(s=>s.latitude==null).length }; });
  console.log('/api/sites/me ->', JSON.stringify(mine));
  await browser.close();
};
run().catch(e=>{console.error(e);process.exit(1);});
