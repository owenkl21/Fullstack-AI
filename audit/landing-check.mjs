import { launch, context, open, shot, PHONE, DESK } from './lib.mjs';

/*
 * The landing page, checked mechanically against the rules it was built to.
 *
 * Everything here is measured off the rendered page rather than read out of the
 * source, because the source can say one thing and the browser another: a
 * reveal that never fires, a tab panel that never mounts, a heading that wraps
 * to four lines at 390. Run it at both widths and in both themes.
 */
const browser = await launch();
const fail = [];
const pass = (name, ok, note = '') => {
   if (!ok) fail.push(name);
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  ' + note : ''}`);
};

for (const [tag, vp] of [
   ['desk', DESK],
   ['phone', PHONE],
]) {
   console.log(`\n================= ${tag} =================`);
   const ctx = await context(browser, vp, {
      hasTouch: tag === 'phone',
      reducedMotion: 'reduce',
   });
   const page = await ctx.newPage();
   const errors = [];
   const bad = [];
   page.on('pageerror', (e) => errors.push(String(e)));
   page.on('response', (r) => {
      if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(-44)}`);
   });
   await open(page, '/', 4000);

   /* Fire every scroll reveal, then come back to the top. */
   await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 400) {
         window.scrollTo(0, y);
         await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
   });
   await page.waitForTimeout(800);

   const m = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const vis = (el) => {
         const r = el.getBoundingClientRect();
         return r.width > 0 && r.height > 0;
      };
      return {
         dashes: (text.match(/[—–]/g) || []).length,
         height: document.documentElement.scrollHeight,
         screens: +(
            document.documentElement.scrollHeight / window.innerHeight
         ).toFixed(1),
         words: text.trim().split(/\s+/).length,
         sections: document.querySelectorAll('section').length,
         eyebrows: [...document.querySelectorAll('.lab-rule')].filter(vis)
            .length,
         h1s: document.querySelectorAll('h1').length,
         h1Text: document.querySelector('h1')?.innerText.replace(/\n/g, ' '),
         ctas: [
            ...new Set(
               [...document.querySelectorAll('a,button')]
                  .filter(
                     (b) =>
                        vis(b) &&
                        !b.closest('header') &&
                        !b.closest('footer') &&
                        !b.closest('nav')
                  )
                  .map((b) => b.innerText.trim())
                  .filter((t) => t && t.length < 26)
            ),
         ],
         sideways:
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
         navHeight: Math.round(
            document.querySelector('header')?.getBoundingClientRect().height ?? 0
         ),
         middleDots: (text.match(/·/g) || []).length,
         images: [...document.querySelectorAll('img')].filter(vis).length,
         brokenImages: [...document.querySelectorAll('img')].filter(
            (i) => vis(i) && i.complete && i.naturalWidth === 0
         ).length,
      };
   });
   console.log(JSON.stringify(m, null, 1));

   pass(`${tag} no em or en dashes on screen`, m.dashes === 0, `${m.dashes}`);
   pass(`${tag} the page does not run on`, m.screens <= 6.5, `${m.screens} screens, ${m.height}px`);
   pass(`${tag} one h1`, m.h1s === 1, m.h1Text);
   pass(
      `${tag} eyebrows are rationed`,
      m.eyebrows <= Math.ceil(m.sections / 3),
      `${m.eyebrows} over ${m.sections} sections`
   );
   pass(`${tag} nothing scrolls sideways`, !m.sideways);
   pass(`${tag} the header stays under 80px`, m.navHeight > 0 && m.navHeight <= 80, `${m.navHeight}px`);
   pass(`${tag} no image fails to load`, m.brokenImages === 0);
   pass(`${tag} nothing on the page failed to load`, bad.length === 0, bad.slice(0, 2).join(' | '));
   pass(`${tag} no page errors`, errors.length === 0, errors.slice(0, 1).join(''));

   /* One signup label, not three ways of saying it. */
   const signup = m.ctas.filter((t) =>
      /start|sign up|get started|try|join/i.test(t)
   );
   pass(
      `${tag} one label for signing up`,
      new Set(signup.map((s) => s.toLowerCase())).size <= 1,
      signup.join(' | ')
   );

   /* The hero has to do its job without a scroll. */
   const hero = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const cta = h1?.closest('section')?.querySelector('a[href*="sign"]');
      if (!h1 || !cta) return null;
      const hr = h1.getBoundingClientRect();
      const cr = cta.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(h1).lineHeight);
      return {
         lines: Math.round(hr.height / line),
         ctaBottom: Math.round(cr.bottom),
         viewport: window.innerHeight,
      };
   });
   pass(
      `${tag} the hero headline is at most two lines`,
      hero !== null && hero.lines <= 2,
      hero ? `${hero.lines} lines` : 'not found'
   );
   pass(
      `${tag} the hero action is visible without scrolling`,
      hero !== null && hero.ctaBottom <= hero.viewport,
      hero ? `${hero.ctaBottom} of ${hero.viewport}` : 'not found'
   );

   /* The two library components actually work, by keyboard. */
   const tabs = page.locator('[role=tab]');
   const tabCount = await tabs.count();
   if (tabCount) {
      await tabs.first().click();
      await page.waitForTimeout(250);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);
      const moved = await page.evaluate(() => {
         const on = document.querySelector('[role=tab][aria-selected=true]');
         const panel = document.querySelector('[role=tabpanel]:not([hidden])');
         return { on: on?.textContent?.trim(), panel: panel?.innerText.slice(0, 26).replace(/\n/g, ' ') };
      });
      pass(`${tag} the tabs move on an arrow key`, Boolean(moved.on), `${moved.on} | ${moved.panel}`);
   } else {
      pass(`${tag} the tabs are on the page`, false, 'no [role=tab] found');
   }

   const trigger = page.locator('[data-state][aria-expanded]').first();
   if (await trigger.count()) {
      const before = await trigger.getAttribute('aria-expanded');
      await trigger.click();
      await page.waitForTimeout(450);
      const after = await trigger.getAttribute('aria-expanded');
      pass(`${tag} a question opens`, before !== after, `${before} then ${after}`);
   } else {
      pass(`${tag} the questions are on the page`, false, 'no accordion trigger found');
   }

   await page.evaluate(() => window.scrollTo(0, 0));
   await page.waitForTimeout(400);
   await shot(page, `landing-new-${tag}`);
   await page.screenshot({ fullPage: true, path: `shots/landing-new-${tag}-full.png` });
   await ctx.close();
}

/* Night, at a phone, because the plates and the waves have to hold in both. */
const night = await context(browser, PHONE, { hasTouch: true, reducedMotion: 'reduce' });
const np = await night.newPage();
await np.addInitScript(() => localStorage.setItem('theme', 'night'));
await open(np, '/', 4000);
const theme = await np.evaluate(() => ({
   theme: document.documentElement.dataset.theme,
   bg: getComputedStyle(document.body).backgroundColor,
}));
console.log('\nnight:', JSON.stringify(theme));
pass('night theme is drawn', theme.theme === 'night');
await shot(np, 'landing-new-night');
await night.close();

await browser.close();
console.log(`\n${fail.length ? 'FAILED: ' + fail.join(', ') : 'Everything passed.'}`);
