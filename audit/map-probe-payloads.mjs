import { launch, context, open, signIn, PHONE } from './lib.mjs';

const browser = await launch();
const ctx = await context(browser, PHONE);
const page = await ctx.newPage();
await signIn(page);
await open(page, '/map', 2500);

const out = await page.evaluate(async () => {
   const me = await fetch('/api/sites/me', { credentials: 'include' }).then((r) => r.json());
   const all = await fetch('/api/sites', { credentials: 'include' }).then((r) => r.json());
   return {
      meCount: me.sites?.length,
      meFirst: me.sites?.[0],
      meKeys: me.sites?.[0] ? Object.keys(me.sites[0]) : null,
      allCount: all.sites?.length,
      allFirst: all.sites?.[0],
      mineInAll: (all.sites ?? []).filter((s) => (me.sites ?? []).some((m) => m.id === s.id)).length,
   };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
