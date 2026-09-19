import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';
/* The namer is seen to work: the asking line shows right after the photo goes up, then the names. */
const PHOTO = new URL('./vaal-gps.jpg', import.meta.url).pathname;
const b = await launch();
const ctx = await context(b, PHONE);
const p = await ctx.newPage();
await signIn(p);
await open(p, '/log', 5000);
await p.locator('input[aria-label="Choose a photo"]').first().setInputFiles(PHOTO);
const asking = await p.waitForSelector('[data-namer="asking"]', { timeout: 8000 }).then(() => true).catch(() => false);
if (asking) await shot(p, 'namer-asking-phone');
console.log('asking state shown:', asking);
const named = await p.waitForSelector('[data-namer="named"]', { timeout: 20000 }).then(() => true).catch(() => false);
console.log('names shown:', named);
await p.waitForTimeout(800);
await shot(p, 'namer-named-phone');
await ctx.close(); await b.close();
