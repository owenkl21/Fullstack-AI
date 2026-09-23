import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';
const b = await launch();
for (const [vp, size] of [['phone', PHONE], ['desk', DESK]]) {
   const clip = { x: 0, y: 0, width: size.width, height: size.height };
   const ctx = await context(b, size);
   const p = await ctx.newPage();
   await signIn(p);
   await open(p, '/competitions', 4500); await shot(p, `taste-comps-${vp}`, clip);
   await open(p, '/', 4500); await p.mouse.wheel(0, 700); await p.waitForTimeout(1000); await shot(p, `taste-feed-${vp}`, clip);
   await open(p, '/catches/new', 4500); await shot(p, `taste-full-${vp}`, clip);
   await open(p, '/log', 4500); await shot(p, `taste-log-${vp}`, clip);
   await ctx.close();
}
await b.close(); console.log('shots done');
