import { launch, context, signIn } from '../lib.mjs';
const b = await launch();
const ctx = await context(b, { width: 1440, height: 1000 });
const page = await ctx.newPage();
await signIn(page);
const r = await page.evaluate(async () => {
   const res = await fetch('/api/catches/me', { credentials: 'include' });
   const d = await res.json();
   return (d.catches ?? []).filter((c) => (c.images ?? []).length).map((c) => ({
      title: c.title,
      imgs: c.images.map((i) => ({ id: i.image.id, card: Boolean(i.image.cardUrl), thumb: Boolean(i.image.thumbUrl) })),
   }));
});
console.log(JSON.stringify(r, null, 1));
await b.close();
