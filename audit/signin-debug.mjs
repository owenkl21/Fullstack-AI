import { launch, context, signIn, shot, PHONE } from './lib.mjs';
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const p = await ctx.newPage();
try { await signIn(p); console.log('signed in, url', p.url()); }
catch (e) { console.log('sign-in failed at', p.url()); console.log((await p.evaluate(() => document.body.innerText)).slice(0, 400)); await shot(p, 'signin-fail'); }
await browser.close();
