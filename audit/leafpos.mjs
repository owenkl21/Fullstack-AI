import { launch, context, open, signIn, PHONE } from './lib.mjs';

/*
 * Where the map's console error comes from.
 *
 * "_leaflet_pos" is Leaflet asking an element it has already let go of where
 * it is, so the question is which handler is still running after the element
 * went. This pans, zooms, scrolls and then leaves the page, and prints the
 * stack rather than the message.
 */
const b = await launch();
const ctx = await context(b, PHONE, { deviceScaleFactor: 1 });
const p = await ctx.newPage();
const seen = [];
p.on('pageerror', (e) => seen.push(`PAGEERROR ${e.message}\n${e.stack}`));
p.on('console', (m) => {
   if (m.type() !== 'error') return;
   const text = m.text();
   if (/favicon|Failed to load resource/.test(text)) return;
   const at = m.location();
   seen.push(`CONSOLE ${text.slice(0, 300)}\n   @ ${at.url}:${at.lineNumber}`);
});

await signIn(p);
await open(p, '/map', 12000);

/* Pan it. */
await p.mouse.move(195, 500);
await p.mouse.down();
await p.mouse.move(250, 400, { steps: 10 });
await p.mouse.up();
await p.waitForTimeout(1500);

/* Zoom it. */
await p.getByRole('link', { name: 'Zoom in' }).click({ timeout: 4000 }).catch(() => {});
await p.waitForTimeout(2000);

/* Leave it, which is when a stale handler fires. */
await p.getByRole('link', { name: /feed/i }).first().click({ timeout: 4000 }).catch(() => {});
await p.waitForTimeout(3000);

console.log(seen.length ? [...new Set(seen)].join('\n\n') : 'no errors');
await b.close();
