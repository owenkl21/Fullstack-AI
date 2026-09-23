import { launch, context, open, signIn } from '../lib.mjs';
const b = await launch();
const ctx = await context(b, { width: 1440, height: 1000 });
const page = await ctx.newPage();
await signIn(page);
await open(page, '/profile', 3500);
const head = () => page.evaluate(() => {
   const img = document.querySelector('header img, nav img, [class*="rounded-full"] img');
   const all = [...document.querySelectorAll('img')].map((i) => ({ src: i.currentSrc.slice(0, 70), w: i.naturalWidth }));
   return { first: img ? { src: img.currentSrc.slice(0, 70), w: img.naturalWidth } : null, all: all.slice(0, 3) };
});
console.log('before save   :', JSON.stringify(await head()));
const patched = await page.evaluate(async () => {
   const cur = await (await fetch('/api/users/me', { credentials: 'include' })).json();
   const p = cur.profile;
   const res = await fetch('/api/users/me', {
      method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: p.displayName, username: p.username, bio: p.bio, avatarUrl: p.avatarUrl, bannerUrl: p.bannerUrl }),
   });
   const d = await res.json();
   return { status: res.status, avatarUrl: String(d.profile?.avatarUrl).slice(0, 90), thumb: String(d.profile?.avatarThumbUrl).slice(0, 90) };
});
console.log('patch returns :', JSON.stringify(patched, null, 1));
await b.close();
