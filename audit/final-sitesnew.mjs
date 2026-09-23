import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const posts = [];
page.on('request', (r) => {
   if (r.method() === 'POST' && /\/api\//.test(r.url()))
      posts.push(
         r.method() + ' ' + r.url().replace('http://localhost:5199', '')
      );
});
await signIn(page);
await open(page, '/sites/new', 4000);
const search = page
   .locator('input[aria-label="Search a place, or paste a link from Maps"]')
   .first();
const visible = (await search.count()) && (await search.isVisible());
console.log('the picker search is on the page:', visible);
if (visible) {
   await search.scrollIntoViewIfNeeded();
   await search.fill('Kalk Bay');
   const before = posts.length;
   const url = page.url();
   await search.press('Enter');
   await page.waitForTimeout(3000);
   console.log('POSTs fired by that Enter:', posts.slice(before));
   console.log('still on /sites/new:', page.url() === url, page.url());
   const rows = await page.evaluate(
      () => document.querySelectorAll('[role=option]').length
   );
   console.log('result rows:', rows);
   if (rows) {
      await page.locator('[role=option]').first().click();
      await page.waitForTimeout(1500);
   }
   console.log(
      'page text:',
      (await page.evaluate(() => document.body.innerText))
         .slice(0, 500)
         .replace(/\n+/g, ' | ')
   );
}
await shot(page, 'final-sitesnew-phone', { x: 0, y: 0, ...PHONE });
await browser.close();
