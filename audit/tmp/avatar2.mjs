import { launch, context, open, signIn } from '../lib.mjs';
const b = await launch();
const ctx = await context(b, { width: 1440, height: 1000 });
const page = await ctx.newPage();
await signIn(page);
await open(page, '/profile', 3500);
const headerImgs = () => page.evaluate(() => [...document.querySelectorAll('header img, [class*="rounded-full"] img')]
   .map((i) => ({ w: i.naturalWidth, complete: i.complete, src: i.currentSrc.slice(-40) })));
console.log('before:', JSON.stringify(await headerImgs()));
await page.click('button:has-text("Edit your profile")');
await page.waitForTimeout(800);
await page.click('button[type=submit]');
await page.waitForTimeout(3000);
console.log('after :', JSON.stringify(await headerImgs()));
console.log('toast :', await page.evaluate(() => (document.body.innerText.match(/profile saved[^\n]*/i) ?? ['(none)'])[0]));
await b.close();
