import { launch, context, open, signIn, shot, PHONE, DESK, rect } from './lib.mjs';

const tag = process.argv[2] === 'desk' ? 'desk' : 'phone';
const vp = tag === 'desk' ? DESK : PHONE;
const b = await launch();
const ctx = await context(b, vp);
const p = await ctx.newPage();
await signIn(p);
await open(p, '/', 2500);

const avatar = p.locator('button[aria-label="Your account"]');
console.log('trigger aria-haspopup:', await avatar.getAttribute('aria-haspopup'));

/* scroll the page first, so the lock is provable */
await p.evaluate(() => window.scrollTo(0, 200));
await avatar.click();
await p.waitForTimeout(700);

const panel = p.locator('[role="dialog"]');
console.log('dialogs:', await panel.count());
console.log('panel rect:', JSON.stringify(await panel.evaluate(rect)));
console.log('panel css:', JSON.stringify(await panel.evaluate((el) => {
   const c = getComputedStyle(el);
   return { animationName: c.animationName, animationDuration: c.animationDuration, borderLeft: c.borderLeftWidth + ' ' + c.borderLeftColor, position: c.position, width: c.width, height: c.height };
})));
console.log('viewport:', JSON.stringify(p.viewportSize()));

/* scroll lock */
const before = await p.evaluate(() => window.scrollY);
await p.evaluate(() => window.scrollBy(0, 400));
await p.waitForTimeout(200);
console.log('scrollY before/after scrollBy(400):', before, await p.evaluate(() => window.scrollY));
console.log('body overflow:', await p.evaluate(() => getComputedStyle(document.body).overflow));

/* head */
console.log('head:', JSON.stringify(await p.evaluate(() => {
   const d = document.querySelector('[role="dialog"]');
   const t = [...d.querySelectorAll('span')].map((s) => s.childElementCount === 0 ? s.textContent.trim() : null).filter(Boolean);
   return t.slice(0, 4);
})));

/* rows: href, label, height, left border */
console.log('rows:', JSON.stringify(await p.evaluate(() => {
   const d = document.querySelector('[role="dialog"]');
   return [...d.querySelectorAll('nav a')].map((a) => {
      const r = a.getBoundingClientRect();
      const c = getComputedStyle(a);
      return { href: new URL(a.href).pathname, label: a.textContent.trim(), h: Math.round(r.height), w: Math.round(r.width), bl: c.borderLeftColor, font: c.fontFamily.split(',')[0] };
   });
}), null, 1));

/* the footer and anything clipped */
console.log('footer:', JSON.stringify(await p.evaluate(() => {
   const d = document.querySelector('[role="dialog"]');
   const pr = d.getBoundingClientRect();
   const out = [...d.querySelectorAll('*')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.bottom > pr.bottom + 0.5 || r.right > pr.right + 0.5 || r.left < pr.left - 0.5 || r.top < pr.top - 0.5);
   }).map((el) => el.tagName + '.' + (el.className.baseVal ?? el.className).toString().slice(0, 40));
   const so = [...d.querySelectorAll('button')].find((x) => /Sign out/.test(x.textContent));
   const tt = [...d.querySelectorAll('button[aria-label^="Switch to"]')][0];
   return { overflowing: out, signOut: so ? { h: Math.round(so.getBoundingClientRect().height), bottom: Math.round(so.getBoundingClientRect().bottom) } : null, themeToggle: tt ? Math.round(tt.getBoundingClientRect().width) : null, panelBottom: Math.round(pr.bottom) };
}))); 

await shot(p, `account-${tag}`, { x: 0, y: 0, ...vp });

/* focus: where it landed, and whether tabbing leaves */
console.log('activeElement on open:', await p.evaluate(() => {
   const a = document.activeElement;
   return a.tagName + ':' + (a.getAttribute('aria-label') || a.textContent.trim().slice(0, 24));
}));
const walk = [];
for (let i = 0; i < 14; i++) {
   await p.keyboard.press('Tab');
   walk.push(await p.evaluate(() => {
      const a = document.activeElement;
      const d = document.querySelector('[role="dialog"]');
      return { el: (a.getAttribute('aria-label') || a.textContent.trim().slice(0, 26)), inPanel: Boolean(d && d.contains(a)) };
   }));
}
console.log('tab walk:', JSON.stringify(walk));
console.log('any tab escaped the panel:', walk.some((s) => !s.inPanel));

/* escape */
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
console.log('after Escape, dialogs:', await p.locator('[role="dialog"]').count());
console.log('focus returned to:', await p.evaluate(() => document.activeElement.getAttribute('aria-label')));
console.log('body overflow after close:', await p.evaluate(() => getComputedStyle(document.body).overflow));

/* tap outside */
await avatar.click();
await p.waitForTimeout(600);
await p.mouse.click(12, Math.round(vp.height / 2));
await p.waitForTimeout(400);
console.log('after tap outside, dialogs:', await p.locator('[role="dialog"]').count());

/* a row really navigates and closes */
await avatar.click();
await p.waitForTimeout(600);
await p.locator('[role="dialog"] nav a[href="/sites/me"]').click();
await p.waitForTimeout(1800);
console.log('after Your spots:', p.url(), 'dialogs:', await p.locator('[role="dialog"]').count());

/* the bottom sheet is untouched */
await open(p, '/map', 3500);
const layers = p.locator('button', { hasText: /^Layers$/ }).first();
if (await layers.count()) {
   await layers.click();
   await p.waitForTimeout(600);
   console.log('map sheet:', JSON.stringify(await p.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (!d) return null;
      const r = d.getBoundingClientRect();
      const c = getComputedStyle(d);
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), w: Math.round(r.width), animationName: c.animationName, borderTop: c.borderTopWidth };
   })));
   await shot(p, `account-${tag}-bottomsheet`, { x: 0, y: 0, ...vp });
} else {
   console.log('map sheet: no Layers button at this width');
}

await b.close();
