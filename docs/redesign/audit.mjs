import { chromium } from 'playwright';
import fs from 'node:fs';

const SITE = 'https://fisherfeed.com';
const EMAIL = 'owen@fishlogger.app';
const PASS = 'TestAngler2026!';
const findings = [];
const note = (route, vp, severity, what) => findings.push({ route, vp, severity, what });

const browser = await chromium.launch();

async function signIn(ctx) {
  const p = await ctx.newPage();
  await p.goto(SITE + '/sign-in', { waitUntil: 'networkidle', timeout: 60000 });
  await p.fill('input[type=email]', EMAIL);
  await p.fill('input[type=password]', PASS);
  await p.click('button[type=submit]');
  await p.waitForTimeout(3500);
  await p.close();
}

const ROUTES = [
  ['/', 'landing'], ['/sign-in','sign-in'], ['/sign-up','sign-up'],
  ['/forgot-password','forgot'], ['/verify-email','verify'],
  ['/feed','feed'], ['/catches/me','my-catches'], ['/sites/me','my-spots'],
  ['/gear/me','my-gear'], ['/profile','profile'], ['/account','account'],
  ['/log','quick-log'], ['/catches/new','log-catch'], ['/sites/new','log-spot'],
  ['/sites/me?view=map','spots-map'],
  ['/boards','boards'],
];

for (const vp of [{n:'mobile',w:375,h:812},{n:'desktop',w:1440,h:900}]) {
  const ctx = await browser.newContext({ viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:1 });
  await signIn(ctx);

  for (const [route, label] of ROUTES) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,100)); });
    page.on('pageerror', e => errs.push('pageerror: '+String(e).slice(0,100)));
    try {
      await page.goto(SITE + route, { waitUntil:'networkidle', timeout:45000 });
      await page.waitForTimeout(1400);
    } catch (e) { note(route, vp.n, 'HIGH', 'page failed to load: '+String(e).slice(0,70)); await page.close(); continue; }

    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const out = { hScroll: de.scrollWidth > de.clientWidth + 1, scrollW: de.scrollWidth, clientW: de.clientWidth };
      // visible focus ring on a programmatically focused element
      const a = document.activeElement;
      if (a && a.tagName === 'H1' && a.getAttribute('tabindex') === '-1') {
        const cs = getComputedStyle(a);
        out.focusRing = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      }
      // small tap targets
      const small = [];
      for (const el of document.querySelectorAll('a,button,input,select,textarea')) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.height < 40 && el.offsetParent !== null) {
          // sr-only skip link and hidden file pickers are meant to be invisible
          if (el.classList.contains('sr-only') || el.type === 'file') continue;
          // A stretched link (after:absolute after:inset-0) is clickable across
          // its whole row, which getBoundingClientRect on the <a> cannot see.
          if (/after:absolute/.test(String(el.className))) continue;
          // A link inside running prose is not a standalone control. Forcing it
          // to 44px blows a gap through the paragraph for no usability gain.
          if (el.tagName === 'A' && el.parentElement?.tagName === 'P') continue;
          // Licence attribution is fine print by nature and by requirement.
          if (el.closest('.leaflet-control-attribution')) continue;
          // A radio or checkbox inside a label: the label is the real target.
          if ((el.type === 'radio' || el.type === 'checkbox') &&
              (el.closest('label')?.getBoundingClientRect().height ?? 0) >= 40) continue;
          small.push(`${el.tagName.toLowerCase()}:${Math.round(rect.height)}px "${(el.textContent||'').trim().slice(0,22)}"`);
        }
      }
      out.smallTargets = small.slice(0, 6);
      // inputs: note their styling so we can judge them
      const inputs = [...document.querySelectorAll('input:not([type=hidden])')].slice(0,3).map(i => {
        const cs = getComputedStyle(i);
        return { h: Math.round(i.getBoundingClientRect().height), border: cs.borderBottomWidth+' '+cs.borderStyle, bg: cs.backgroundColor, fs: cs.fontSize, pad: cs.padding };
      });
      out.inputs = inputs;
      // broken images
      out.brokenImages = [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(-45)).slice(0,4);
      out.h1 = document.querySelector('h1')?.textContent?.trim().slice(0,45) || null;
      return out;
    });

    if (r.hScroll) note(route, vp.n, 'HIGH', `horizontal scroll: ${r.scrollW} > ${r.clientW}`);
    if (r.focusRing) note(route, vp.n, 'HIGH', 'focus ring visible on the programmatically focused h1');
    if (r.brokenImages.length) note(route, vp.n, 'HIGH', 'broken images: '+r.brokenImages.join(', '));
    if (r.smallTargets.length) note(route, vp.n, 'MED', 'tap targets under 40px: '+r.smallTargets.join(' | '));
    if (errs.length) note(route, vp.n, 'MED', 'console: '+[...new Set(errs)].slice(0,2).join(' | '));
    if (!r.h1) note(route, vp.n, 'MED', 'no h1 on the page');
    if (vp.n==='mobile' && r.inputs.length) {
      const i = r.inputs[0];
      if (parseFloat(i.fs) < 16) note(route, vp.n, 'HIGH', `input font ${i.fs} under 16px, iOS will zoom`);
    }

    await page.screenshot({ path:`/tmp/fl-audit/shots/${vp.n}-${label}.png`, fullPage:false }).catch(()=>{});
    await page.close();
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync('/tmp/fl-audit/findings.json', JSON.stringify(findings,null,1));
const bySev = s => findings.filter(f=>f.severity===s);
console.log(`\nFINDINGS: ${bySev('HIGH').length} high, ${bySev('MED').length} medium\n`);
for (const s of ['HIGH','MED']) {
  for (const f of bySev(s)) console.log(`  [${s}] ${f.route} (${f.vp}): ${f.what}`);
}
