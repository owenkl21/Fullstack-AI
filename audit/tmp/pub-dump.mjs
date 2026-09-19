import { launch, context, signIn } from '../lib.mjs';
const b = await launch();
const ctx = await context(b, { width: 1440, height: 1000 });
const page = await ctx.newPage();
await signIn(page);
const get = async (path) => page.evaluate(async (p) => {
   const r = await fetch(p, { credentials: 'include' });
   return { status: r.status, body: await r.json().catch(() => null) };
}, path);
const k = await get('/api/users/seed_angler_karen');
const prog = await get('/api/users/seed_angler_karen/progress');
console.log('publicKeys', Object.keys(k.body?.profile ?? {}));
console.log('gallery', k.body?.profile?.galleryImages?.length, 'createdAt', k.body?.profile?.createdAt);
console.log('sampleGallery', JSON.stringify(k.body?.profile?.galleryImages?.[0] ?? null).slice(0,300));
console.log('progFigures', JSON.stringify(prog.body?.progress?.figures));
await b.close();
