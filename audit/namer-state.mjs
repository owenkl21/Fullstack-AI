import { readFileSync } from 'node:fs';
import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';
/*
 * The namer is seen to work: the asking band shows right after the photo goes
 * up, then the two names. Both live in the black band under the photograph on
 * the log, so the states are read off [data-namer] rather than off the page.
 *
 * The bucket's CORS list does not carry every dev origin, so the presigned
 * PUT is made from Node where there is no CORS gate. The app's own upload
 * still runs; only the browser's origin check is stepped around. The bytes
 * come off disk: Playwright does not hand a binary PUT's body to a route,
 * and an empty object in the bucket is a picture the namer cannot read.
 */
const PHOTO = new URL('./vaal-gps.jpg', import.meta.url).pathname;
const b = await launch();
const ctx = await context(b, PHONE);
const p = await ctx.newPage();
await p.route(/cloudflarestorage\.com/, async (route) => {
   const request = route.request();
   if (request.method() !== 'PUT') return route.continue();
   try {
      const sent = await fetch(request.url(), {
         method: 'PUT',
         body: readFileSync(PHOTO),
         headers: {
            'content-type': request.headers()['content-type'] || 'image/jpeg',
         },
      });
      await route.fulfill({ status: sent.status, body: '' });
   } catch {
      await route.fulfill({ status: 500, body: '' });
   }
});
await signIn(p);
await open(p, '/log', 5000);
await p
   .locator('input[aria-label="Choose a photo"]')
   .first()
   .setInputFiles(PHOTO);
const asking = await p
   .waitForSelector('[data-namer="asking"]', { timeout: 8000 })
   .then(() => true)
   .catch(() => false);
if (asking) await shot(p, 'namer-asking-phone');
console.log('asking state shown:', asking);
const named = await p
   .waitForSelector('[data-namer="named"]', { timeout: 20000 })
   .then(() => true)
   .catch(() => false);
console.log('names shown:', named);
if (!named) {
   /* Either it could not name this one, or it is not answering at all. */
   const none = await p.locator('[data-namer="none"]').count();
   console.log(
      none ? 'the namer answered with no names' : 'the namer never answered'
   );
}
await p.waitForTimeout(800);
await shot(p, 'namer-named-phone');
await ctx.close();
await b.close();
