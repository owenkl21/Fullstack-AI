import { launch, context, signIn, HOST } from '../lib.mjs';
import { writeFileSync } from 'node:fs';

const b = await launch();
const ctx = await context(b, { width: 1440, height: 1000 });
const page = await ctx.newPage();
await signIn(page);

const get = async (path) =>
   page.evaluate(async (p) => {
      const r = await fetch(p, { credentials: 'include' });
      return { status: r.status, body: await r.json().catch(() => null) };
   }, path);

const me = await get('/api/users/me');
const catches = await get('/api/catches/me');
const stats = await get('/api/stats/me');
const progress = await get('/api/stats/progress');
const conns = await get('/api/users/me/connections?type=followers&search=');

const list = catches.body?.catches ?? [];
const withImg = list.filter((c) => (c.images ?? []).length);
const out = {
   meKeys: Object.keys(me.body ?? {}),
   profileKeys: Object.keys(me.body?.profile ?? {}),
   gallery: me.body?.profile?.galleryImages?.length,
   createdAt: me.body?.profile?.createdAt,
   catches: list.length,
   firstCaughtAt: list.map((c) => c.caughtAt).sort()[0],
   lastInArray: list[list.length - 1]?.caughtAt,
   withImages: withImg.length,
   sampleImage: withImg[0]?.images?.[0],
   sampleCatchKeys: Object.keys(list[0] ?? {}),
   imgCatches: withImg.map((c) => ({ id: c.id, title: c.title, at: c.caughtAt, n: c.images.length, url: c.images[0]?.image?.url?.slice(0, 120) })),
   counts: Array.from(new Set(list.map((c) => c.count))),
   withConditions: list.filter((c) => c.weatherConditionText || c.weatherWindDirectionCardinal || c.weatherAirPressureMeanSeaLevelMillibars != null || c.weatherIsDaytime != null || c.weatherSeaSurfaceTemperatureC != null || c.waterTemp != null).length,
   stats: stats.body,
   progressFigures: progress.body?.progress?.figures,
   progressPoints: progress.body?.progress?.points,
   connections: conns.body,
};
writeFileSync(new URL('./api-dump.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 6000));
await b.close();
