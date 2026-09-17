import { chromium } from 'playwright';
const HOST='https://fishlogger-client.vercel.app';
const OUT=new URL('./shots/', import.meta.url).pathname;
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,permissions:['geolocation'],geolocation:{latitude:-34.13,longitude:18.33}});
const p=await ctx.newPage();
const errors=[]; p.on('pageerror', e=>errors.push(String(e.message).slice(0,140)));
const shot=(name,opts={})=>p.screenshot({path:`${OUT}v15-${name}.png`, ...opts});
await p.goto(HOST+'/sign-in',{waitUntil:'load',timeout:60000});
await p.fill('input[type=email]','owen@fishlogger.app'); await p.fill('input[type=password]','TestAngler2026!');
await p.click('button[type=submit]'); await p.waitForTimeout(3500);

await p.goto(HOST+'/',{waitUntil:'load',timeout:60000}); await p.waitForTimeout(7000);
console.log('HOME', JSON.stringify(await p.evaluate(()=>({h1:document.querySelector('h1')?.textContent, lastAt:[...document.querySelectorAll('header p')].map(x=>x.textContent).find(t=>/Last at/.test(t||'')), factTiles:document.querySelectorAll('.fact').length, cols:getComputedStyle(document.querySelector('dl')).gridTemplateColumns.split(' ').length, seasonLabels:[...document.querySelectorAll('ul li a span.lab')].slice(0,3).map(x=>x.textContent), monthBreaks:document.querySelectorAll('ul li.bg-black-block').length}))));
await shot('home', {fullPage:true});

await p.goto(HOST+'/log',{waitUntil:'load',timeout:60000}); await p.waitForTimeout(5000);
console.log('QUICKLOG', JSON.stringify(await p.evaluate(()=>({time:document.querySelector('.g.num')?.textContent, where:[...document.querySelectorAll('span')].map(x=>x.textContent).find(t=>/Phone fix|Getting a fix|No fix/.test(t||'')), sources:[...document.querySelectorAll('[role=radiogroup] [role=radio]')].map(x=>x.textContent), buttons:[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/Drop a pin|Change|Take a photo|Choose one/.test(t)), privacy:[...document.querySelectorAll('span.lab')].map(x=>x.textContent).filter(t=>/Who sees|spot/i.test(t||''))}))));
await shot('quicklog', {fullPage:true});
const dp=p.locator('button:has-text("Drop a pin")').first(); if(await dp.count()){ await dp.click(); await p.waitForTimeout(2500); console.log('PIN MAP open:', await p.$$eval('.leaflet-container', n=>n.length)); await shot('quicklog-pin', {fullPage:true}); }

await p.goto(HOST+'/map',{waitUntil:'load',timeout:60000}); await p.waitForTimeout(6000);
console.log('MAP', JSON.stringify(await p.evaluate(()=>({toolbar:[...document.querySelectorAll('.map-surface button, .leaflet-container ~ button, .leaflet-container ~ div button')].map(b=>b.getAttribute('aria-label')||b.textContent.trim()).filter(Boolean).slice(0,8), rowsBelow:document.querySelectorAll('.map-controls').length, legend:!!document.querySelector('[aria-label="What the pins mean"]')}))));
const lg=p.locator('[aria-label="What the pins mean"]'); if(await lg.count()){ await lg.click(); await p.waitForTimeout(800); console.log('LEGEND rows:', await p.$$eval('[data-radix-popper-content-wrapper] li', ls=>ls.length)); await shot('map-legend', {clip:{x:0,y:200,width:1440,height:800}}); await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
const fish=p.locator('button:has-text("Fish")').first(); if(await fish.count()){ await fish.click(); await p.waitForTimeout(600); console.log('FISH picker options:', await p.$$eval('[role=checkbox]', cs=>cs.length)); await shot('map-fish-picker', {clip:{x:0,y:200,width:1440,height:800}}); await p.keyboard.press('Escape'); }

const m=await ctx.newPage(); await m.setViewportSize({width:390,height:844});
await m.goto(HOST+'/feed',{waitUntil:'load',timeout:60000}); await m.waitForTimeout(4000);
console.log('FEED MOBILE', JSON.stringify(await m.evaluate(()=>({pickers:document.querySelectorAll('button[data-state]').length, scrollX:document.documentElement.scrollWidth>document.documentElement.clientWidth, firstPost:Math.round(document.querySelector('article')?.getBoundingClientRect().top)}))));
await m.screenshot({path:`${OUT}v15-feed-mobile.png`});
const sc=m.locator('button:has-text("Scope")').first(); if(await sc.count()){ await sc.click(); await m.waitForTimeout(500); const near=m.locator('[role=option]:has-text("Near me")'); if(await near.count()){ await near.click(); await m.waitForTimeout(3000); console.log('SLIDER', JSON.stringify(await m.evaluate(()=>({thumb:!!document.querySelector('[role=slider]'), value:document.querySelector('output')?.textContent})))); await m.screenshot({path:`${OUT}v15-slider-mobile.png`}); } }

await p.goto(HOST+'/boards',{waitUntil:'load',timeout:60000}); await p.waitForTimeout(5000);
const fp=p.locator('button:has-text("Fish")').first(); if(await fp.count()){ await fp.click(); await p.waitForTimeout(500); const opts=await p.$$('[role=checkbox]'); if(opts[0]) await opts[0].click(); if(opts[1]) await opts[1].click(); await p.keyboard.press('Escape'); await p.waitForTimeout(800); }
console.log('BOARDS', JSON.stringify(await p.evaluate(()=>({boards:document.querySelectorAll('table').length, rows:[...document.querySelectorAll('table')].map(t=>t.querySelectorAll('tbody tr').length), paging:[...document.querySelectorAll('button')].filter(b=>/Next ten|Previous ten/.test(b.textContent)).length, you:!!document.querySelector('.border-teal')}))));
await shot('boards', {fullPage:true});

await p.goto(HOST+'/competitions',{waitUntil:'load',timeout:60000}); await p.waitForTimeout(4000);
console.log('COMPS', JSON.stringify(await p.evaluate(()=>({rows:document.querySelectorAll('ul > li').length, timers:[...document.querySelectorAll('span')].map(x=>x.textContent).filter(t=>/left$/.test(t||'')).slice(0,3), results:[...document.querySelectorAll('span')].filter(x=>x.textContent==='Results').length}))));
await p.click('button:has-text("Start one")'); await p.waitForTimeout(800);
console.log('COMP FORM scope options:', JSON.stringify(await p.$$eval('[role=radiogroup] [role=radio]', rs=>rs.map(r=>r.textContent).filter(t=>/Anyone|Invitation/.test(t)))));
await p.locator('[role=radio]:has-text("Invitation only")').click(); await p.waitForTimeout(1500);
console.log('COMP FORM invite picker:', await p.locator('button:has-text("Followers")').count());
await shot('comp-form', {fullPage:true});

await p.goto(HOST+'/catches/new',{waitUntil:'load',timeout:60000}); await p.waitForTimeout(5000);
await p.click('button:has-text("For a competition?")'); await p.waitForTimeout(2000);
console.log('LOG COMP', JSON.stringify(await p.evaluate(()=>({text:[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/competition|Pick one|None running/i.test(t)).slice(0,3)}))));
await shot('logcatch-comp', {fullPage:true});

await p.goto(HOST+'/insights',{waitUntil:'load',timeout:60000}); await p.waitForTimeout(3000);
console.log('INSIGHTS bars grown:', await p.$$eval('svg[role=img] rect', rs=>rs.filter(r=>Number(r.getAttribute('height'))>0).length), 'rank bar width:', await p.$eval('.rank-bar > span', s=>s.style.width));
await shot('insights', {clip:{x:0,y:0,width:1440,height:1000}});
await p.goto(HOST+'/forecast',{waitUntil:'load',timeout:60000}); await p.waitForTimeout(6000);
console.log('FORECAST tones:', JSON.stringify(await p.evaluate(()=>({coloured:document.querySelectorAll('tbody [class*="text-["]').length, bands:document.querySelectorAll('[role=tab] .h-1').length}))));
await m.goto(HOST+'/forecast',{waitUntil:'load',timeout:60000}); await m.waitForTimeout(6000);
await m.evaluate(()=>{const g=document.querySelector('.overflow-x-auto'); if(g) g.scrollLeft=300;}); await m.waitForTimeout(500);
await m.screenshot({path:`${OUT}v15-forecast-mobile-scrolled.png`});
console.log('PAGE ERRORS', JSON.stringify(errors));
await b.close();
