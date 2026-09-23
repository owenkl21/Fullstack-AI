import { launch, context, open, signIn, PHONE, DESK } from './lib.mjs';
const browser = await launch();
const pass = (n, ok, note = '') =>
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? '  ' + note : ''}`);

/* Every black plate on the page, and whether it ends in a waterline. */
const survey = () => ({
   plates: [
      ...document.querySelectorAll(
         '.blk, .black-block, [class*="bg-black-block"]'
      ),
   ].map((el) => {
      const r = el.getBoundingClientRect();
      const torn = el.querySelector(
         '.torn, svg[class*="torn"], [class*="torn"]'
      );
      return {
         cls: String(el.className).slice(0, 46),
         h: Math.round(r.height),
         torn: !!torn,
      };
   }),
   torn: document.querySelectorAll('[class*="torn"], .torn-edge').length,
   tornSvgs: [...document.querySelectorAll('svg')].filter(
      (s) =>
         /torn/i.test(
            String(s.className.baseVal || s.getAttribute('class') || '')
         ) || s.closest('[class*="torn"]')
   ).length,
});

for (const [label, vp] of [
   ['phone', PHONE],
   ['desk', DESK],
]) {
   const ctx = await context(
      browser,
      vp,
      label === 'phone' ? { hasTouch: true } : {}
   );
   const page = await ctx.newPage();
   await signIn(page);
   console.log(`\n--- ${label} ---`);
   for (const route of [
      '/',
      '/catches/me',
      '/sites/me',
      '/profile',
      '/insights',
      '/boards',
      '/competitions',
      '/gear/me',
      '/forecast',
      '/map',
      '/log',
      '/notifications',
      '/saved',
      '/account',
   ]) {
      await open(page, route, 3000);
      const s = await page.evaluate(survey);
      const heads = s.plates.filter((p) => p.h > 90);
      console.log(
         `${route.padEnd(14)} plates ${String(s.plates.length).padStart(2)}  tall ${String(heads.length).padStart(2)}  torn elements ${s.torn}`
      );
      for (const h of heads)
         console.log(`     tall plate h${h.h} torn=${h.torn}  ${h.cls}`);
   }
   await ctx.close();
}
await browser.close();
