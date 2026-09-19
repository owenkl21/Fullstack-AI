import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';
const b = await launch();
const ctx = await context(b, PHONE);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
await signIn(p);
const me = await p.request
   .get(process.env.HOST + '/api/users/me')
   .then((r) => r.status())
   .catch(() => 'err');
await open(p, '/log', 5000);
const title = await p
   .locator('h1')
   .first()
   .textContent()
   .catch(() => null);
const pin = await p
   .locator('[data-pin]')
   .first()
   .getAttribute('data-pin')
   .catch(() => null);
console.log(
   'me status',
   me,
   '| /log h1:',
   title,
   '| pin:',
   pin,
   '| errors:',
   errs.length ? errs : 'none'
);
await shot(p, 'local-log-phone');
await ctx.close();
await b.close();
