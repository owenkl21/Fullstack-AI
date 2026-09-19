import { launch, context, shot, HOST, DESK, PHONE } from './lib.mjs';

/*
 * The boot loader: the first paint is held for at least 1.6 s while the fish
 * leaves the water, so a shot taken 700 ms in catches it. THEME=night for
 * the inverted clip on the dark ground.
 */
const TAG = process.env.TAG || 'local';
const b = await launch();
for (const [name, vp] of [['desk', DESK], ['phone', PHONE]]) {
   const ctx = await context(b, vp);
   const p = await ctx.newPage();
   await p.goto(HOST + '/', { waitUntil: 'commit' });
   await p.waitForTimeout(700);
   const m = await p.evaluate(() => {
      const v = document.querySelector('[role="status"] video');
      return v
         ? { playing: !v.paused, t: +v.currentTime.toFixed(2), w: v.clientWidth, src: v.currentSrc }
         : { video: null, status: !!document.querySelector('[role="status"]') };
   });
   console.log(name, JSON.stringify(m));
   await shot(p, `${TAG}-${name}-boot`, { x: 0, y: 0, ...vp });
   await ctx.close();
}
await b.close();
