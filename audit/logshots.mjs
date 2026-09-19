import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';
/* The log flows as they stand: quick log steps 1 to 3 with a photo in, and the full form. */
const PHOTO = new URL('./vaal-gps.jpg', import.meta.url).pathname;
const TAG = process.env.TAG || 'before';
const b = await launch();
for (const [vp, size] of [['phone', PHONE], ['desk', DESK]]) {
   const ctx = await context(b, size);
   const p = await ctx.newPage();
   await signIn(p);
   await open(p, '/log', 5000);
   await p.locator('input[aria-label="Choose a photo"]').first().setInputFiles(PHOTO);
   await p.waitForTimeout(4000);
   await shot(p, `log-${TAG}-1-${vp}`);
   if (vp === 'phone') {
      for (let s = 2; s <= 3; s++) {
         await p.getByRole('button', { name: /^Next$/ }).first().click();
         await p.waitForTimeout(800);
         await shot(p, `log-${TAG}-${s}-${vp}`);
      }
   }
   await open(p, '/catches/new', 5000);
   await p.locator('input[type=file]').first().setInputFiles(PHOTO);
   await p.waitForTimeout(4000);
   await shot(p, `full-${TAG}-${vp}`);
   await ctx.close();
}
await b.close();
console.log('shots done');
