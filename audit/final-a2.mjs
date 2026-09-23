import { launch, context, open, signIn, PHONE } from './lib.mjs';

const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
await signIn(page);
await open(page, '/log', 3000);

console.log(
   'matchMedia(pointer: coarse):',
   await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
);

const probe = await page.evaluate(() => {
   const mk = (tag, cls) => {
      const el = document.createElement(tag);
      if (tag === 'input') el.type = 'text';
      if (cls) el.className = cls;
      document.body.appendChild(el);
      const s = parseFloat(getComputedStyle(el).fontSize);
      el.remove();
      return s;
   };
   return {
      'input .text-[14px]': mk('input', 'text-[14px]'),
      'input .text-sm': mk('input', 'text-sm'),
      'input .text-xs': mk('input', 'text-xs'),
      'input .text-[13px]': mk('input', 'text-[13px]'),
      'select .text-[14px]': mk('select', 'text-[14px]'),
      'textarea .text-[15px]': mk('textarea', 'text-[15px]'),
      'input no size class': mk('input', ''),
      'input .text-[28px] must stay': mk('input', 'text-[28px]'),
      'input .text-2xl must stay': mk('input', 'text-2xl'),
      'input .text-[24px] must stay': mk('input', 'text-[24px]'),
   };
});
for (const [k, v] of Object.entries(probe))
   console.log('   ', k.padEnd(32), v + 'px');

/* walk the log the way a thumb does */
const seen = new Map();
const record = async (tag) => {
   const got = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll(
         'input, select, textarea, [role=combobox]'
      )) {
         const r = el.getBoundingClientRect();
         if (!r.width || !r.height) continue;
         out.push({
            tag: el.tagName.toLowerCase(),
            name:
               el.getAttribute('aria-label') ||
               el.getAttribute('placeholder') ||
               el.getAttribute('name') ||
               '',
            cls: String(el.className).slice(0, 52),
            size: parseFloat(getComputedStyle(el).fontSize),
         });
      }
      return out;
   });
   for (const g of got)
      seen.set(g.tag + '|' + g.name + '|' + g.cls, { ...g, where: tag });
};

await record('step 1');
for (let i = 0; i < 5; i++) {
   const next = page.locator('button:visible', { hasText: /^Next$/ }).first();
   if (!(await next.count())) break;
   try {
      await next.click({ timeout: 4000 });
   } catch {
      break;
   }
   await page.waitForTimeout(1200);
   await record('step ' + (i + 2));
   /* open every fold this step carries */
   const folds = await page.$$(
      'summary:visible, [aria-expanded=false]:visible'
   );
   for (const f of folds) {
      try {
         await f.click({ timeout: 2000 });
         await page.waitForTimeout(400);
         await record('step ' + (i + 2) + ' fold');
      } catch {
         /* not a fold */
      }
   }
   /* shut anything modal that a fold click opened */
   await page.keyboard.press('Escape');
   await page.waitForTimeout(400);
}

console.log('\nevery control the log showed a thumb:');
let bad = 0;
for (const n of seen.values()) {
   if (n.size < 16) bad++;
   console.log(
      `   ${n.size < 16 ? 'UNDER' : '     '} ${String(n.size).padStart(5)}px  ${n.where.padEnd(14)} ${n.tag.padEnd(8)} ${JSON.stringify(n.name).slice(0, 30).padEnd(32)} ${n.cls}`
   );
}
console.log('\ncontrols under 16px:', bad);
await browser.close();
