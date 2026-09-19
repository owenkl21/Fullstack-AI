import { launch, context, open, signIn, shot, PHONE, HOST } from './lib.mjs';
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
  await page.addInitScript(() => {
    window.__builds = 0;
    new MutationObserver((recs) => {
      for (const r of recs) for (const n of r.addedNodes)
        if (n.nodeType===1 && n.classList?.contains('leaflet-container')) window.__builds++;
    }).observe(document.documentElement, { childList:true, subtree:true });
  });
  await signIn(page);
  await open(page, '/map', 6000);
  console.log('map builds after load:', await page.evaluate('window.__builds'));
  console.log('view:', JSON.stringify(await page.evaluate(VIEW)));

  // search to somewhere far away, then tap Locate
  const box = page.locator('input[type=search]').first();
  await box.click(); await box.fill('Vaal Dam'); await page.waitForTimeout(2300);
  await page.locator('[role=option]').first().click();
  await page.waitForTimeout(3000);
  console.log('\nafter Vaal Dam: builds', await page.evaluate('window.__builds'), 'view', JSON.stringify(await page.evaluate(VIEW)));
  await shot(page, 'mi5-vaal', {x:0,y:0,...PHONE});

  await page.getByRole('button', { name: 'Locate' }).click();
  for (const t of [800, 1500, 2500, 4000]) {
    await page.waitForTimeout(t===800?800:t-800);
    console.log(` +${t}ms  builds=${await page.evaluate('window.__builds')}  view=${JSON.stringify(await page.evaluate(VIEW))}`);
  }
  await shot(page, 'mi5-after-locate', {x:0,y:0,...PHONE});

  // then search again and watch whether it sticks
  await box.click(); await box.fill('Struisbaai'); await page.waitForTimeout(2300);
  await page.locator('[role=option]').first().click();
  await page.waitForTimeout(3000);
  console.log('\nafter Struisbaai: builds', await page.evaluate('window.__builds'), 'view', JSON.stringify(await page.evaluate(VIEW)));

  // reload with a stored fix present from the start
  await page.reload({ waitUntil:'load' }); await page.waitForTimeout(6000);
  console.log('\nreload with stored fix: builds', await page.evaluate('window.__builds'), 'view', JSON.stringify(await page.evaluate(VIEW)));
  await shot(page, 'mi5-reload', {x:0,y:0,...PHONE});
  await browser.close();
};
run().catch(e=>{console.error(e);process.exit(1);});
