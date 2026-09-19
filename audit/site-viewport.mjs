import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';
/* Viewport-sized frames (what a person actually sees), not full-page captures. */
const ROUTES = ['/', '/catches/me', '/forecast', '/insights', '/boards', '/profile', '/map'];
const b = await launch();
for (const [vp, size] of [['phone', PHONE], ['desk', DESK]]) {
   const clip = { x: 0, y: 0, width: size.width, height: size.height };
   let ctx = await context(b, size);
   let p = await ctx.newPage();
   await open(p, '/', 4000);
   for (let i = 0; i < 4; i++) {
      await shot(p, `vp-landing-${i}-${vp}`, clip);
      await p.mouse.wheel(0, size.height * 0.9);
      await p.waitForTimeout(1400);
   }
   await ctx.close();
   ctx = await context(b, size);
   p = await ctx.newPage();
   await signIn(p);
   for (const r of ROUTES) {
      await open(p, r, 4500);
      await shot(p, `vp-${r === '/' ? 'feed' : r.slice(1).replace(/\//g, '-')}-${vp}`, clip);
   }
   await ctx.close();
}
await b.close();
console.log('done');
