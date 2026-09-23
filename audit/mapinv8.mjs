import { launch, context, open, signIn, shot, PHONE, HOST } from './lib.mjs';
const R = `(sel) => { const el=document.querySelector(sel); if(!el) return null; const q=el.getBoundingClientRect(); return {t:Math.round(q.top),b:Math.round(q.bottom),l:Math.round(q.left),r:Math.round(q.right),w:Math.round(q.width),h:Math.round(q.height)}; }`;
const run = async () => {
  const browser = await launch();
  const page = await (await context(browser, PHONE, { hasTouch:true, isMobile:true })).newPage();
  await signIn(page);
  await open(page, '/log', 6000);
  await page.locator('#quicklog-pin').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  console.log('== PHONE /log map ==');
  console.log(' map', JSON.stringify(await page.evaluate(`(${R})('#quicklog-pin .map-surface')`)));
  console.log(' pin', await page.getAttribute('#quicklog-pin .map-surface','data-pin'), ' source', await page.getAttribute('#quicklog-pin .map-surface','data-source'));
  console.log(' overlay buttons', await page.locator('#quicklog-pin button[aria-label]').count(),
              JSON.stringify(await page.locator('#quicklog-pin button[aria-label]').evaluateAll(els=>els.map(e=>e.getAttribute('aria-label')))));
  await shot(page, 'mi8-log-map', {x:0,y:0,...PHONE});

  // open the folded search
  await page.locator('#quicklog-pin button[aria-label="Search for a place"]').click();
  await page.waitForTimeout(600);
  console.log('\n search open:', JSON.stringify(await page.evaluate(`(${R})('#quicklog-pin form[role=search]')`)));
  await shot(page, 'mi8-log-search-open', {x:0,y:0,...PHONE});

  const inp = page.locator('#quicklog-pin input[type=search]');
  for (const q of ['Struisbaai','-34.1275, 18.4487','https://www.google.com/maps/@-34.0964,18.3086,15z','zzzqqqxyz']) {
    await inp.fill(q);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    const opts = await page.locator('#quicklog-pin [role=option]').allTextContents();
    console.log('\n  query', JSON.stringify(q));
    console.log('   options', opts.length, JSON.stringify(opts.slice(0,3)));
    console.log('   pin ->', await page.getAttribute('#quicklog-pin .map-surface','data-pin'));
    console.log('   said:', (await page.locator('#quicklog-pin').innerText()).replace(/\n+/g,' | ').slice(0,180));
    if (opts.length) { await page.locator('#quicklog-pin [role=option]').first().click(); await page.waitForTimeout(2000);
      console.log('   after picking first, pin ->', await page.getAttribute('#quicklog-pin .map-surface','data-pin'));
      await page.locator('#quicklog-pin button[aria-label="Search for a place"]').click(); await page.waitForTimeout(400);
      await page.locator('#quicklog-pin button[aria-label="Search for a place"]').click(); await page.waitForTimeout(400);
    }
  }
  await shot(page, 'mi8-log-after', {x:0,y:0,...PHONE});
  await browser.close();
};
run().catch(e=>{console.error(e);process.exit(1);});
