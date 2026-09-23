import { launch, context, open, scrollShots, shot, DESK, PHONE } from './lib.mjs';

/*
 * The forecast page with a place chosen (Where I am, with the context's
 * geolocation), a screen at a time on a desktop and a phone.
 *   node forecast.mjs                            live
 *   HOST=http://localhost:5173 TAG=local node forecast.mjs
 */
const TAG = process.env.TAG || 'live';
const b = await launch();
for (const [name, vp] of [['desk', DESK], ['phone', PHONE]]) {
   const ctx = await context(b, vp);
   const p = await ctx.newPage();
   const errors = [];
   p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
   await open(p, '/forecast', 3000);
   const here = p.getByRole('button', { name: /where i am/i });
   if (await here.count()) {
      await here.first().click();
      await p.waitForTimeout(7000);
   }
   console.log(name, JSON.stringify({ url: p.url(), h1: await p.evaluate(() => document.querySelector('h1')?.textContent?.trim()) }));
   await scrollShots(p, `${TAG}-${name}-forecast`, 10);
   await shot(p, `${TAG}-${name}-forecast-full`);
   if (errors.length) console.log(name, 'page errors', JSON.stringify(errors.slice(0, 6)));
   await ctx.close();
}
await b.close();
