/*
 * The focus check: walks to every control that was under 16px, and to the ones
 * the brief names (species search, map search, notes, a date field, a number
 * field), FOCUSES each one and reads the computed size off document.activeElement
 * with a coarse pointer, which is the only state iOS cares about.
 *
 *   HOST=http://localhost:5199 node focuszoom-focused.mjs
 */
import { launch, context, open, signIn, shot, PHONE, DESK } from './lib.mjs';

const READ = () => {
   const el = document.activeElement;
   if (!el || el === document.body) return null;
   const cs = getComputedStyle(el);
   return {
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      id: el.id || '',
      ph: el.getAttribute('placeholder') || '',
      aria: el.getAttribute('aria-label') || '',
      fs: parseFloat(cs.fontSize),
      lh: cs.lineHeight,
      ta: cs.touchAction,
      cls: String(el.className || '').slice(0, 120),
   };
};

const rows = [];
/* Viewport-sized, not fullPage: a fullPage shot resizes the viewport, which
   throws away the very state being checked. */
async function vshot(page, name) {
   const y = await page.evaluate(() => window.scrollY);
   return shot(page, name, {
      x: 0,
      y,
      width: PHONE.width,
      height: PHONE.height,
   });
}
async function focusRead(page, label, locator, want) {
   try {
      const l = locator.first();
      await l.waitFor({ state: 'visible', timeout: 6000 });
      await l.focus();
      await page.waitForTimeout(120);
      const r = await page.evaluate(READ);
      if (!r) throw new Error('nothing focused');
      const ok = want ? r.fs === want : r.fs >= 16;
      rows.push({ label, ...r, ok, want: want || '>=16' });
      console.log(
         `${ok ? 'OK  ' : 'FAIL'}  ${label.padEnd(34)} ${String(r.fs).padStart(5)}px  want ${want || '>=16'}  ta=${r.ta}  <${r.tag}${r.type ? ' ' + r.type : ''}> ${r.ph || r.aria || r.id}`
      );
   } catch (e) {
      rows.push({ label, fs: null, ok: false, err: String(e).slice(0, 90) });
      console.log(`MISS  ${label.padEnd(34)} ${String(e).slice(0, 90)}`);
   }
}

const b = await launch();
const ctx = await context(b, PHONE, { hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) =>
   console.log('   [pageerror]', String(e).slice(0, 140))
);
await signIn(page);

/* ---- the log, step 1 ---- */
await open(page, '/log', 3500);
await focusRead(
   page,
   'log: species search',
   page.locator('input[placeholder="Search or add a species"]')
);
await page.evaluate(() => {
   const b = [...document.querySelectorAll('button')].find(
      (x) => (x.textContent || '').trim() === 'Edit'
   );
   if (b) b.click();
});
await page.waitForTimeout(400);
await focusRead(
   page,
   'log: date (datetime-local)',
   page.locator('input[type="datetime-local"]')
);
await vshot(page, 'zoom-log-step1-focus');

/* ---- the log, step 2: the measure row, the notes box, a number field ---- */
await page.getByRole('button', { name: 'Next', exact: true }).first().click();
await page.waitForTimeout(700);
await focusRead(
   page,
   'log: length source select',
   page.locator('select[aria-label*="length"]')
);
await focusRead(
   page,
   'log: weight source select',
   page.locator('select[aria-label*="weight"]')
);
await focusRead(
   page,
   'log: measure box (must stay 28)',
   page.locator('#length'),
   28
);
await focusRead(page, 'log: notes textarea', page.locator('#notes'));
await vshot(page, 'zoom-log-step2-focus');

/* The fold holds the small number boxes. */
const fold = page.getByRole('button', { name: /more/i }).first();
if (await fold.count()) {
   await fold.click().catch(() => {});
   await page.waitForTimeout(400);
}
await focusRead(
   page,
   'log: number field (must stay 24)',
   page.locator('#count, #depth, #water'),
   24
);
await vshot(page, 'zoom-log-step2-fold-focus');

/* ---- the map ---- */
await open(page, '/map', 4000);
await focusRead(
   page,
   'map: place search',
   page.locator('input[type="search"], input[placeholder*="Search"]')
);
await vshot(page, 'zoom-map-focus');

/* ---- the forecast ---- */
await open(page, '/forecast', 4000);
await focusRead(
   page,
   'forecast: place search',
   page.locator('input[placeholder="A beach, a town, a headland"]')
);
await vshot(page, 'zoom-forecast-focus');

/* ---- the feed comment box ---- */
await open(page, '/feed', 4500);
let comment = page.locator('input[placeholder="Add a comment"]');
if (!(await comment.count())) {
   await page
      .getByRole('button', { name: /comment/i })
      .first()
      .click()
      .catch(() => {});
   await page.waitForTimeout(600);
   comment = page.locator('input[placeholder="Add a comment"]');
}
await focusRead(page, 'feed: comment box', comment);
await vshot(page, 'zoom-feed-focus');

/* ---- the spot picker's search, and a spot form ---- */
await open(page, '/sites/new', 4000);
await focusRead(
   page,
   'new spot: place search',
   page.locator('input[placeholder="Search, or paste a Maps link"]')
);
await focusRead(
   page,
   'new spot: name field',
   page.locator('form input[type="text"], form input:not([type])')
);
await vshot(page, 'zoom-sitesnew-focus');

console.log('\n==== SUMMARY ====');
const bad = rows.filter((r) => !r.ok);
for (const r of rows)
   console.log(
      `${r.ok ? 'OK  ' : 'BAD '} ${r.label}: ${r.fs === null ? r.err : r.fs + 'px'}`
   );
console.log(bad.length ? `\n${bad.length} PROBLEM(S)` : '\nall good');

/*
 * The other half of the claim: a fine pointer must be left alone, so the desk
 * still gets the sizes the design chose (the measure source selects at 14px).
 */
const dctx = await context(b, DESK);
const dp = await dctx.newPage();
await signIn(dp);
await open(dp, '/log', 3500);
/* The desk shows the whole form at once, so there is no Next to press. */
const desk = await dp.evaluate(() => {
   const out = [];
   for (const el of document.querySelectorAll('select, textarea')) {
      out.push(
         `${el.tagName.toLowerCase()} ${el.id || el.getAttribute('aria-label')} = ${getComputedStyle(el).fontSize} ta=${getComputedStyle(el).touchAction}`
      );
   }
   return out;
});
console.log('\n==== DESK (fine pointer), /log ====');
for (const d of desk) console.log('   ' + d);
await b.close();
