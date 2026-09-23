import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await signIn(page);
await open(page, '/competitions/new', 4000);
await page.locator('input[type=text]:visible').first().fill('Audit comp');
await page
   .locator('button:visible', { hasText: /^Continue$/ })
   .first()
   .click();
await page.waitForTimeout(1500);
await page
   .locator('button:visible', { hasText: /^Around a spot$/ })
   .first()
   .click();
await page.waitForTimeout(1200);
const opener = page
   .locator('button:visible', { hasText: /Pick a spot/ })
   .first();
console.log('spot opener found:', await opener.count());
await opener.click();
await page.waitForTimeout(1200);
const search = page.locator('input[type=search]:visible').first();
console.log('search placeholder:', await search.getAttribute('placeholder'));
await search.fill('Kalk Bay');
await page.waitForTimeout(3000);
const rows = await page.evaluate(() =>
   [...document.querySelectorAll('[role=option]')]
      .map((o) => o.innerText.replace(/\n/g, ' / '))
      .slice(0, 6)
);
console.log(`${rows.length} rows:`, JSON.stringify(rows));
if (rows.length) {
   await page.locator('[role=option]').first().click();
   await page.waitForTimeout(1500);
   console.log(
      'after a pick:',
      (await page.evaluate(() => document.body.innerText))
         .slice(0, 400)
         .replace(/\n+/g, ' | ')
   );
}
await shot(page, 'final-compsearch-phone', { x: 0, y: 0, ...PHONE });
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
