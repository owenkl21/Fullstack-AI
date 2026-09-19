import { launch, context, open, signIn, shot, PHONE, HOST } from './lib.mjs';
const R = `(sel) => { const el=document.querySelector(sel); if(!el) return null; const q=el.getBoundingClientRect(); return {t:Math.round(q.top),b:Math.round(q.bottom),h:Math.round(q.height)}; }`;
const run = async () => {
  const browser = await launch();
  const page = await (await context(browser, PHONE, { hasTouch:true, isMobile:true })).newPage();
  await signIn(page);
  await open(page, '/map', 6000);
  await page.getByRole('button', { name: 'Layers' }).click();
  await page.waitForTimeout(800);
  console.log('layers sheet', JSON.stringify(await page.evaluate(`(${R})('.sheet')`)));
  await shot(page, 'mi9-layers', {x:0,y:0,...PHONE});
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(600);

  // species filter: does it filter MY spots too?
  const before = { mine: await page.locator('.map-pin-spot').count(), other: await page.locator('.map-pin-other').count(), clusters: await page.locator('.map-pin-cluster').count() };
  await page.locator('.grid-cols-5 > *').nth(1).click();
  await page.waitForTimeout(900);
  const opts = await page.locator('[role=option], .sheet button').allInnerTexts();
  console.log('\nfish sheet options:', JSON.stringify(opts.slice(0,8)));
  await shot(page, 'mi9-fish', {x:0,y:0,...PHONE});
  // pick the first species
  const first = page.locator('.sheet [role="checkbox"], .sheet [role="option"], .sheet button').nth(0);
  await first.click(); await page.waitForTimeout(700);
  const done = page.getByRole('button', { name: 'Done' });
  if (await done.count()) await done.click();
  await page.waitForTimeout(1500);
  const after = { mine: await page.locator('.map-pin-spot').count(), other: await page.locator('.map-pin-other').count(), clusters: await page.locator('.map-pin-cluster').count() };
  console.log('before', JSON.stringify(before), '\nafter ', JSON.stringify(after));
  await shot(page, 'mi9-fish-applied', {x:0,y:0,...PHONE});
  await browser.close();
};
run().catch(e=>{console.error(e);process.exit(1);});
