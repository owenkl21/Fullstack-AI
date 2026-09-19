import { launch, context, open, signIn, scrollShots, DESK, PHONE } from './lib.mjs';

/*
 * The two log forms, signed in, a screen at a time. On a phone the quick log
 * is three steps, so Next is pressed through them and each step is shot.
 *   node formscroll.mjs                          live
 *   HOST=http://localhost:5173 TAG=local node formscroll.mjs
 */
const TAG = process.env.TAG || 'live';
const b = await launch();
for (const [name, vp] of [['desk', DESK], ['phone', PHONE]]) {
   const ctx = await context(b, vp);
   const p = await ctx.newPage();
   const errors = [];
   p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
   await signIn(p);
   for (const [route, file] of [['/log', 'quicklog'], ['/catches/new', 'fullform']]) {
      await open(p, route, 4500);
      await scrollShots(p, `${TAG}-${name}-${file}-s1`);
      /* Phone steps. Next lives in the footer; stop when it is gone. */
      for (let step = 2; step <= 3; step++) {
         const next = p.getByRole('button', { name: /^next$/i });
         if (!(await next.count())) break;
         await next.first().click();
         await p.waitForTimeout(700);
         await scrollShots(p, `${TAG}-${name}-${file}-s${step}`);
      }
      console.log(name, route, 'done');
   }
   if (errors.length) console.log(name, 'page errors', JSON.stringify(errors.slice(0, 6)));
   await ctx.close();
}
await b.close();
