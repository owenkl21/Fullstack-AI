import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
await signIn(page);
await open(page, '/forecast', 6000);
const txt = await page.evaluate(() => {
   const all = [...document.querySelectorAll('h1,h2,h3,p,span,div')];
   return all
      .filter((e) => /^(Read|Right now|Checked)/i.test((e.textContent || '').trim()) && e.children.length <= 2)
      .slice(0, 12)
      .map((e) => `${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ').slice(0, 3).join('.') : ''}: ${(e.textContent || '').trim().slice(0, 70)}`);
});
console.log(txt.join('\n'));
await shot(page, 'live-forecast-phone');
await browser.close();
