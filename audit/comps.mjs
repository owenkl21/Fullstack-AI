import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';

/*
 * The competition screens, signed in as the test angler, phone and desktop:
 * the list, starting one (every step), the test competition's page with its
 * entries, and the quick log in competition mode. Screenshots go to shots/.
 */
const COMP = process.env.COMP || 'cmu8986cy00000aphj8m7mhl0';
const b = await launch();
for (const [name, vp] of [['phone', PHONE], ['desk', DESK]]) {
   const ctx = await context(b, vp);
   const p = await ctx.newPage();
   const errs = [];
   p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
   await signIn(p);

   await open(p, '/competitions', 5000);
   await shot(p, `comp-list-${name}`);
   for (const tab of ['Mine', 'Invites']) {
      const t = p.getByRole('button', { name: new RegExp(`^${tab}`) }).first();
      if (await t.count()) { await t.click(); await p.waitForTimeout(1200); await shot(p, `comp-list-${tab.toLowerCase()}-${name}`); }
   }

   await open(p, '/competitions/new', 5000);
   await shot(p, `comp-new-1-${name}`);
   for (let step = 2; step <= 6; step++) {
      const next = p.getByRole('button', { name: /^(Continue|Next)$/ }).first();
      if (!(await next.count())) break;
      if (step === 2) {
         const nameBox = p.locator('input[type=text], input:not([type])').first();
         if (await nameBox.count()) await nameBox.fill('Screenshot test');
      }
      await next.click();
      await p.waitForTimeout(900);
      await shot(p, `comp-new-${step}-${name}`);
   }

   await open(p, `/competitions/${COMP}`, 6000);
   await shot(p, `comp-detail-${name}`);
   const entry = p.getByText(/^The checks$/i).first();
   if (await entry.count()) { await entry.click(); await p.waitForTimeout(900); await shot(p, `comp-detail-open-${name}`); }

   await open(p, `/log?competition=${COMP}`, 6000);
   await shot(p, `comp-log-${name}`);
   const next = p.getByRole('button', { name: /^Next$/ }).first();
   if (await next.count()) { await next.click(); await p.waitForTimeout(900); await shot(p, `comp-log-2-${name}`); }

   console.log(name, 'errors:', errs.length ? errs : 'none');
   await ctx.close();
}
await b.close();
