import { launch, context, open, signIn, PHONE } from './lib.mjs';

const PROBE = () => {
   const out = [];
   const sel = 'input, select, textarea, [role="combobox"], [contenteditable]:not([contenteditable="false"])';
   for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const type = el.getAttribute('type') || el.tagName.toLowerCase();
      out.push({
         tag: el.tagName.toLowerCase(),
         type,
         id: el.id || '',
         name: el.getAttribute('name') || '',
         ph: el.getAttribute('placeholder') || '',
         aria: el.getAttribute('aria-label') || '',
         cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '',
         fs: cs.fontSize,
         vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
         w: Math.round(r.width), h: Math.round(r.height),
         ta: cs.touchAction,
      });
   }
   return out;
};

const routes = process.argv.slice(2).length ? process.argv.slice(2) : [
   '/', '/map', '/log', '/forecast', '/insights', '/profile', '/account',
   '/feed', '/saved', '/sites/new', '/sites/me', '/gear/new', '/catches/me',
   '/competitions', '/competitions/new', '/boards', '/notifications',
   '/sign-in', '/sign-up',
];

const b = await launch();
const ctx = await context(b, PHONE);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', String(e).slice(0, 160)));
await signIn(page);

const bad = [];
for (const r of routes) {
   try {
      await open(page, r, 3500);
   } catch (e) {
      console.log(`\n## ${r}  (LOAD FAILED ${String(e).slice(0,80)})`);
      continue;
   }
   const rows = await page.evaluate(PROBE);
   console.log(`\n## ${r}  (${rows.length} controls)`);
   for (const c of rows) {
      const px = parseFloat(c.fs);
      const flag = px < 16 && c.vis ? '  <<< UNDER 16' : '';
      if (px < 16 && c.vis) bad.push({ route: r, ...c });
      console.log(`   ${c.tag}[${c.type}] fs=${c.fs} vis=${c.vis} ${c.w}x${c.h} ta=${c.ta} id="${c.id}" ph="${c.ph}" aria="${c.aria}"${flag}`);
      if (px < 16 && c.vis) console.log(`      class: ${String(c.cls).slice(0, 200)}`);
   }
}

console.log('\n\n==== VISIBLE CONTROLS UNDER 16px ====');
for (const c of bad) console.log(`${c.route}  ${c.tag}[${c.type}] ${c.fs}  id="${c.id}" ph="${c.ph}" aria="${c.aria}"`);
if (!bad.length) console.log('(none found on the routes walked)');

await b.close();
