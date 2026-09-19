import { launch, context, open, signIn, HOST, PHONE } from './lib.mjs';
/* Log a catch through the phone quick log with a photograph, then ask the
   bucket whether the card and thumb copies went up beside the original.
   The catch is deleted afterwards. */
const PHOTO = new URL('./vaal-gps.jpg', import.meta.url).pathname;
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const p = await ctx.newPage();
const puts = [];
p.on('request', (r) => { if (r.method() === 'PUT' && /r2\.cloudflarestorage/.test(r.url())) puts.push(r.url().replace(/\?.*$/, '').slice(-16)); });
await signIn(p);
await open(p, '/log', 3000);
await p.locator('input[aria-label="Choose a photo"]').first().setInputFiles(PHOTO);
await p.waitForTimeout(7000);
const speciesBox = p.locator('input[role=combobox]').first();
await speciesBox.fill('Galjoen');
await p.waitForTimeout(600);
await p.getByRole('option', { name: /^Galjoen/ }).first().click().catch(() => undefined);
for (let i = 0; i < 2; i++) { await p.getByRole('button', { name: /^Next$/ }).first().click(); await p.waitForTimeout(600); }
const before = await p.request.get(HOST + '/api/catches/me').then((r) => r.json());
await p.getByRole('button', { name: /^Save catch$/ }).first().click();
await p.waitForTimeout(5000);
const after = await p.request.get(HOST + '/api/catches/me').then((r) => r.json());
const fresh = (after.catches || []).find((c) => !(before.catches || []).some((o) => o.id === c.id));
console.log('PUTs to the bucket:', puts.join(', ') || 'none');
if (!fresh) { console.log('FAIL  no catch was saved'); await browser.close(); process.exit(1); }
const record = await p.request.get(HOST + `/api/catches/${fresh.id}`).then((r) => r.json()).then((d) => d.catch ?? d);
const im = record.images?.[0]?.image;
const codes = {};
for (const k of ['url', 'cardUrl', 'thumbUrl']) codes[k] = im?.[k] ? (await p.request.get(im[k])).status() : 'absent';
console.log('saved catch', fresh.id, '| image', im?.storageKey?.slice(-30), '|', JSON.stringify(codes));
const ok = codes.url === 200 && codes.cardUrl === 200 && codes.thumbUrl === 200;
console.log(`${ok ? 'PASS' : 'FAIL'}  a phone-logged photograph has its original, card and thumb in the bucket`);
const del = await p.request.delete(HOST + `/api/catches/${fresh.id}`);
console.log('deleted the test catch:', del.status());
await browser.close();
