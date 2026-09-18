import { launch, context, open, PHONE } from './lib.mjs';

/*
 * How tall a page really is on a phone, and what is eating the height.
 *   ROUTE=/forecast node measure.mjs
 */
const ROUTE = process.env.ROUTE || '/forecast';
const b = await launch();
const ctx = await context(b, PHONE);
const p = await ctx.newPage();
await open(p, ROUTE, 3000);
const here = p.getByRole('button', { name: /where i am/i });
if (await here.count()) {
   await here.first().click();
   await p.waitForTimeout(8000);
}
const m = await p.evaluate(() => {
   const round = (n) => Math.round(n);
   const main = document.querySelector('main');
   const blocks = [...(main?.children ?? [])].flatMap((section) => [
      ...(section.tagName === 'SECTION' || section.tagName === 'DIV' ? section.children : [section]),
   ]);
   return {
      page: round(document.documentElement.scrollHeight),
      screens: +(document.documentElement.scrollHeight / innerHeight).toFixed(2),
      blocks: blocks
         .map((el) => ({
            tag: el.tagName.toLowerCase(),
            cls: (el.className?.toString?.() ?? '').slice(0, 42),
            h: round(el.getBoundingClientRect().height),
         }))
         .filter((x) => x.h > 20),
   };
});
console.log(JSON.stringify(m, null, 1));
await b.close();
