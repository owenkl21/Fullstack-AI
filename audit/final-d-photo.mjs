import { launch, context, open, signIn, PHONE } from './lib.mjs';
const PHOTO = new URL('./vaal-gps.jpg', import.meta.url).pathname;
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await signIn(page);
const pass = (n, ok, note = '') =>
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? '  ' + note : ''}`);

const api = (path, init) =>
   page.evaluate(
      async ([p, i]) => {
         const r = await fetch(p, { credentials: 'include', ...(i || {}) });
         const text = await r.text();
         try {
            return { status: r.status, body: JSON.parse(text) };
         } catch {
            return { status: r.status, body: text.slice(0, 200) };
         }
      },
      [path, init]
   );

await open(page, '/log', 4000);
const before = await api('/api/catches/me');
const wasIds = new Set(
   (before.body.catches ?? before.body ?? []).map((c) => c.id)
);
console.log('catches before:', wasIds.size);

/* the photograph carries Deneysville on the Vaal */
await page.setInputFiles('input[aria-label="Choose a photo"]', PHOTO);
await page.waitForTimeout(4000);
const line = await page.evaluate(
   () => (document.body.innerText.match(/From [^\n]*/) || [''])[0]
);
console.log('the line under the map:', JSON.stringify(line));

/* name the fish and carry on to the end */
const species = page
   .locator('input[placeholder="Search or add a species"]')
   .first();
await species.fill('Elf');
await page.waitForTimeout(1800);
await page
   .locator('[role=option], li button')
   .filter({ hasText: /Elf/i })
   .first()
   .click();
await page.waitForTimeout(1200);
for (let i = 0; i < 4; i++) {
   const next = page.locator('button:visible', { hasText: /^Next$/ }).first();
   if (!(await next.count())) break;
   try {
      await next.click({ timeout: 5000 });
   } catch {
      break;
   }
   await page.waitForTimeout(1500);
}
const save = page
   .locator('button:visible', { hasText: /^Save catch$/i })
   .first();
console.log(
   'save control:',
   await save.count(),
   await page.evaluate(() =>
      [...document.querySelectorAll('button')]
         .filter((b) => b.offsetParent)
         .map((b) => b.textContent.trim())
         .slice(-6)
   )
);
if (await save.count()) {
   await save.click();
   await page.waitForTimeout(6000);
}

const after = await api('/api/catches/me');
const rows = after.body.catches ?? after.body ?? [];
const fresh = rows.filter((c) => !wasIds.has(c.id));
console.log('new catches:', fresh.length, fresh.map((c) => c.id).join(','));
let saved = null;
if (fresh.length === 1) {
   const one = await api(`/api/catches/${fresh[0].id}`);
   const c = one.body.catch ?? one.body;
   saved = {
      lat: c.latitude,
      lng: c.longitude,
      site: c.siteId ?? null,
      when: c.caughtAt,
   };
   console.log('read back from the API:', JSON.stringify(saved));
}
pass(
   'a photograph with GPS is what the saved catch carries',
   !!saved &&
      Math.abs(saved.lat - -26.8967) < 0.001 &&
      Math.abs(saved.lng - 28.0942) < 0.001,
   JSON.stringify(saved)
);

for (const c of fresh) {
   const del = await api(`/api/catches/${c.id}`, { method: 'DELETE' });
   console.log('deleted', c.id, del.status);
}
const end = await api('/api/catches/me');
const left = (end.body.catches ?? end.body ?? []).filter(
   (c) => !wasIds.has(c.id)
);
pass(
   'nothing left behind',
   left.length === 0,
   `${left.length} still there, total ${(end.body.catches ?? []).length}`
);
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
