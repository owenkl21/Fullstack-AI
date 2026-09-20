import { chromium } from 'playwright';
const file = 'file:///private/tmp/claude-501/-Users-owenkleinhans/5cdb79aa-e9b0-4da5-89d1-31a54b7058ac/scratchpad/landing-rework/Landing%20Page.dc.html';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.goto(file, { waitUntil: 'load', timeout: 60000 });
console.log(JSON.stringify(await p.evaluate(() => {
   const top = [...document.querySelectorAll('section')].filter((s) => !s.parentElement.closest('section'));
   return top.map((s) => ({
      id: s.id || '-',
      bg: getComputedStyle(s).backgroundColor,
      colour: getComputedStyle(s).color,
      svgWaves: s.querySelectorAll('svg path').length,
      h: Math.round(s.getBoundingClientRect().height),
   }));
}), null, 1));
await b.close();
