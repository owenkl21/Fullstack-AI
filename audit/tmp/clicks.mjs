import { launch, context, open, signIn, shot, PHONE, DESK } from '../lib.mjs';

const size = process.argv[2] === 'phone' ? PHONE : DESK;
const tag = process.argv[2] === 'phone' ? 'phone' : 'desk';
const b = await launch();
const ctx = await context(b, size);
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text().slice(0, 160)); });
page.on('pageerror', (e) => console.log('PAGE ERROR:', String(e).slice(0, 200)));
await signIn(page);
await open(page, '/profile', 3500);

/* Following sheet */
await page.click('button:has-text("Following")');
await page.waitForTimeout(1000);
console.log('following rows :', JSON.stringify(await page.$$eval('[role="dialog"] li a', (n) => n.map((e) => e.getAttribute('href')))));
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

/* Personal bests fold */
await page.click('button:has-text("Personal bests")');
await page.waitForTimeout(600);
console.log('bests rows     :', await page.$$eval('.fold-open a[href^="/catches/"]', (n) => n.length));

/* Settings panel */
await page.click('button:has-text("Edit your profile")');
await page.waitForTimeout(800);
console.log('settings fields:', JSON.stringify(await page.$$eval('input, textarea', (n) => n.map((e) => e.name || e.id || e.type)).then((v) => v.slice(0, 8))));
await shot(page, `profile-settings-${tag}`);
await page.click('button:has-text("Close settings")');
await page.waitForTimeout(400);

/* Rank card link */
await page.click('a[href="/insights"]');
await page.waitForTimeout(2500);
console.log('rank card ->   :', page.url());
await page.goBack();
await page.waitForTimeout(2500);

/* A gallery tile */
const tile = await page.$('.fold-open ul a[href^="/catches/"]');
if (tile) {
   await tile.click();
   await page.waitForTimeout(2500);
   console.log('gallery tile ->:', page.url());
   const head = await page.evaluate(() => document.body.innerText.split('\n').slice(0, 6).join(' | '));
   console.log('catch page     :', head);
   await page.goBack();
   await page.waitForTimeout(2000);
}

/* Insights: spot link and the season years */
await open(page, '/insights', 4000);
const years = await page.$$eval('button', (n) => n.map((e) => e.textContent.trim()).filter((t) => /^20\d\d$/.test(t)));
console.log('season years   :', JSON.stringify(years));
if (years.length > 1) {
   await page.click(`button:has-text("${years[1]}")`);
   await page.waitForTimeout(800);
   const line = await page.evaluate(() => (document.body.innerText.match(/\d+ days on the water[^\n]*/) ?? ['(none)'])[0]);
   console.log('season line    :', line);
}
const spot = await page.$('table a[href^="/sites/"]');
if (spot) {
   const href = await spot.getAttribute('href');
   await spot.click();
   await page.waitForTimeout(2500);
   console.log('spot link ->   :', href, '=>', page.url(), (await page.evaluate(() => document.body.innerText.split('\n')[2] ?? '')).slice(0, 40));
}
await b.close();
