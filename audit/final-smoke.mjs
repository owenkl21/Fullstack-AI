import { launch, context, open, signIn, PHONE, DESK } from './lib.mjs';
const browser = await launch();
const ROUTES = [
   '/',
   '/catches/me',
   '/catches/new',
   '/log',
   '/map',
   '/forecast',
   '/sites/me',
   '/sites/new',
   '/gear/me',
   '/boards',
   '/competitions',
   '/competitions/new',
   '/profile',
   '/insights',
   '/notifications',
   '/saved',
   '/account',
   '/anglers/seed_angler_karen',
];
for (const [label, vp] of [
   ['phone', PHONE],
   ['desk', DESK],
]) {
   const ctx = await context(
      browser,
      vp,
      label === 'phone' ? { hasTouch: true } : {}
   );
   const page = await ctx.newPage();
   const errs = [];
   const bad = [];
   const console_ = [];
   page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
   page.on('console', (m) => {
      if (m.type() === 'error') console_.push(m.text().slice(0, 160));
   });
   page.on('response', (r) => {
      if (r.status() >= 400 && /localhost:5199\/api\//.test(r.url()))
         bad.push(
            r.status() + ' ' + r.url().replace('http://localhost:5199', '')
         );
   });
   await signIn(page);
   console.log(`\n================ ${label} ================`);
   for (const route of ROUTES) {
      errs.length = 0;
      bad.length = 0;
      console_.length = 0;
      await open(page, route, 3500);
      const info = await page.evaluate(() => ({
         h1: (document.querySelector('h1')?.textContent || '')
            .trim()
            .slice(0, 40),
         chars: document.body.innerText.length,
         wide: document.documentElement.scrollWidth > innerWidth + 1,
         sw: document.documentElement.scrollWidth,
         dash: (document.body.innerText.match(/[—–]/g) || []).length,
      }));
      const flags = [];
      if (info.wide) flags.push(`SIDEWAYS SCROLL sw ${info.sw} vs ${vp.width}`);
      if (info.dash) flags.push(`${info.dash} DASHES`);
      if (errs.length) flags.push('PAGE ERROR ' + errs.join(' / '));
      if (bad.length) flags.push('API ' + bad.join(' / '));
      if (console_.length)
         flags.push('CONSOLE ' + console_.slice(0, 2).join(' / '));
      if (info.chars < 120) flags.push('NEARLY EMPTY ' + info.chars);
      console.log(
         `${flags.length ? 'FLAG' : 'ok  '}  ${route.padEnd(30)} h1 ${JSON.stringify(info.h1).padEnd(28)} ${flags.join(' | ')}`
      );
   }
   await ctx.close();
}
await browser.close();
