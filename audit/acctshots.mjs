import { launch, context, open, signIn, shot, PHONE, DESK } from './lib.mjs';
const tag = process.argv[2] === 'desk' ? 'desk' : 'phone';
const vp = tag === 'desk' ? DESK : PHONE;
const b = await launch();
const ctx = await context(b, vp);
const p = await ctx.newPage();
await signIn(p);
await open(p, '/', 4000);
await p.locator('button[aria-label="Your account"]').click();
await p.waitForTimeout(900);
console.log('head avatar is a photo:', await p.evaluate(() =>
   Boolean(document.querySelector('[role="dialog"] img'))));
await shot(p, `account-${tag}`, { x: 0, y: 0, ...vp });
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
/* the current route wears the teal mark */
await open(p, '/forecast', 3500);
await p.locator('button[aria-label="Your account"]').click();
await p.waitForTimeout(900);
console.log('marked rows:', await p.evaluate(() =>
   [...document.querySelectorAll('[role="dialog"] nav a')]
      .filter((a) => getComputedStyle(a).borderLeftColor !== 'rgba(0, 0, 0, 0)')
      .map((a) => a.textContent.trim() + ' ' + getComputedStyle(a).borderLeftColor)));
await shot(p, `account-${tag}-active`, { x: 0, y: 0, ...vp });
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
/* header at this width, panel shut */
await shot(p, `account-${tag}-header`, { x: 0, y: 0, width: vp.width, height: 70 });
await b.close();
