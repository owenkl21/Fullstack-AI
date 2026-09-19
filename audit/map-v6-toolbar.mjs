import { launch, context, signIn, DESK } from './lib.mjs';
const browser = await launch();
const ctx = await context(browser, DESK);
const page = await ctx.newPage();
await signIn(page);
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
await page.waitForTimeout(3500);
console.log(JSON.stringify(await page.evaluate(() => {
   const bar = [...document.querySelectorAll('div')].find((d) => String(d.className).includes('bottom-8 left-3'));
   const cs = getComputedStyle(bar);
   return {
      box: bar.getBoundingClientRect().toJSON(),
      style: { width: cs.width, flexWrap: cs.flexWrap, paddingRight: cs.paddingRight, maxWidth: cs.maxWidth },
      children: [...bar.children].map((c) => ({ tag: c.tagName, text: c.innerText?.slice(0, 20), r: c.getBoundingClientRect().toJSON() })),
   };
}, null), null, 1));
await browser.close();
