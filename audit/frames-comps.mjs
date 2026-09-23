import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';

/*
 * The competitions area against the design review's frames 3a to 3k.
 *
 * Writes shots/built-3a.png .. built-3k.png, at 390 for the phone frames and
 * 1440 for the desktop ones, to be read beside
 * docs/redesign/design-review-2026-09-19/frames/<id>.png.
 *
 *   cd audit && HOST=http://localhost:5199 node frames-comps.mjs
 *
 * One sign-in, one page, the viewport switched between the two widths: the
 * API rate-limits sign-ins, and a second context costs another one.
 *
 * Which competitions it uses is read off the API rather than pinned to ids,
 * so the script still tells the truth after the throwaway data is gone: the
 * one with an entry awaiting review is the subject of 3b and 3j, the first
 * finished one is 3c. Either can be pinned with HELD= and RESULTS=.
 */

const only = (process.env.ONLY || '').split(',').filter(Boolean);
const wanted = (id) => !only.length || only.includes(id);

const b = await launch();
const ctx = await context(b, PHONE);
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(String(e).slice(0, 200)));

/* Sign-in is rate limited; give it a few goes rather than shooting the
   signed-out page and calling it a frame. */
for (let i = 0; i < 6; i++) {
   await signIn(page);
   if (!/Sign in/i.test(await page.title())) break;
   await page.waitForTimeout(8000);
}
if (/Sign in/i.test(await page.title())) {
   console.error('Could not sign in. Nothing was shot.');
   await b.close();
   process.exit(1);
}

const phone = () => page.setViewportSize(PHONE);
const desk = () => page.setViewportSize(DESK);

const api = (path) =>
   page.evaluate((p) => fetch(p).then((r) => r.json()), path);

/* ---- which competitions stand in for which frames --------------------- */

const list = (await api('/api/competitions?tab=all&page=1')).competitions ?? [];
let held = process.env.HELD ?? null;
let results = process.env.RESULTS ?? null;

/* Best first: one with an entry awaiting review, which is what 3b and 3j
   are about; then any running one with an entry at all, so the check lines
   and the scale photograph are still on screen; then any running one. */
let withEntries = null;
for (const c of list) {
   if (!results && c.status === 'finished') results = c.id;
   if (held || c.status === 'finished') continue;
   const detail = await api(`/api/competitions/${c.id}`);
   const entries = detail.entries ?? [];
   if (entries.some((e) => e.state === 'HELD')) held = c.id;
   else if (!withEntries && entries.length) withEntries = c.id;
}
if (!held) held = withEntries;
if (!held) held = list.find((c) => c.status !== 'finished')?.id ?? null;
const missing = [];

/* The competition page opens the entry that is waiting on somebody. When
   none is, open the first one so the checks are on screen either way. */
async function openAnEntry() {
   if (await page.getByText('Fish in the photo').first().count()) return;
   const row = page
      .locator('section[aria-labelledby="entries-heading"] ul button')
      .first();
   if (await row.count()) {
      await row.click();
      await page.waitForTimeout(900);
   }
}

/* ---- the wizard ------------------------------------------------------- */

const radio = (name) => page.getByRole('radio', { name, exact: true });
const button = (name) => page.getByRole('button', { name, exact: true });

async function startFlow() {
   await open(page, '/competitions/new', 4000);
   await page.waitForSelector('#comp-name', { timeout: 20000 });
   await page.fill('#comp-name', 'Vaal weekend');
   await page.fill('#comp-blurb', 'A weekend on the river');
   await page.waitForTimeout(500);
}

async function step(to) {
   await button('Continue').click();
   await page.waitForTimeout(800);
   if (to) await page.waitForTimeout(200);
}

/* ---- phone: 3a to 3h -------------------------------------------------- */

await phone();

if (wanted('3a')) {
   await open(page, '/competitions', 4000);
   await shot(page, 'built-3a');
}

if (wanted('3b')) {
   if (held) {
      await open(page, `/competitions/${held}`, 4500);
      await openAnEntry();
      await shot(page, 'built-3b');
   } else missing.push('3b: no running competition to open');
}

if (wanted('3c')) {
   if (results) {
      await open(page, `/competitions/${results}`, 4500);
      await shot(page, 'built-3c');
   } else missing.push('3c: no finished competition on this account');
}

if (wanted('3d')) {
   await startFlow();
   await shot(page, 'built-3d');

   /* 3e: around a spot, so the row opens its own two fields. */
   await step();
   await button('Around a spot').click();
   await page.waitForTimeout(600);
   await shot(page, 'built-3e');

   /* Back to anywhere, which needs no spot picked to carry on. */
   await button('Anywhere in South Africa').click();
   await page.waitForTimeout(300);
   await step();

   /* 3f: invite only, reviewed by the organiser. */
   await radio('Invite only').click();
   await page.waitForTimeout(400);
   await radio('I review it first').click();
   await page.waitForTimeout(400);
   await shot(page, 'built-3f');

   /* 3g: three followers ticked. */
   await step();
   await page.waitForTimeout(1200);
   const rows = page.locator('nav ~ div button').filter({ hasText: '@' });
   const n = await rows.count();
   for (let i = 0; i < Math.min(3, n); i++) {
      await rows.nth(i).click();
      await page.waitForTimeout(150);
   }
   await page.waitForTimeout(400);
   await shot(page, 'built-3g');

   /* 3h: one last look. Nothing here starts it. */
   await step();
   await shot(page, 'built-3h');
}

/* ---- desktop: 3i to 3k ------------------------------------------------ */

await desk();

if (wanted('3i')) {
   await open(page, '/competitions', 4000);
   await shot(page, 'built-3i');
}

if (wanted('3j')) {
   if (held) {
      await open(page, `/competitions/${held}`, 4500);
      await openAnEntry();
      await shot(page, 'built-3j');
   } else missing.push('3j: no running competition to open');
}

if (wanted('3k')) {
   await startFlow();
   await shot(page, 'built-3k');
}

console.log('held:', held ?? 'none', '· results:', results ?? 'none');
if (missing.length) console.log('not shot:', missing.join('; '));
console.log('page errors:', problems.length ? problems.slice(0, 5) : 'none');
await b.close();
