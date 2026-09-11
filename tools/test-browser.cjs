// npm install --no-save playwright && npx playwright install --with-deps chromium
// Start a local server, then run: node tools/test-browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true});
 const page = await browser.newPage({viewport:{width:1500,height:950}});
 const errors=[];
 page.on('pageerror', e=>errors.push(e.message));
 const base=process.env.TEST_URL || 'http://127.0.0.1:8000';
 for (const lang of ['de','en']) {
  await page.goto(`${base}/${lang==='de'?'index':'en'}.html`);
  await page.waitForFunction(()=>document.querySelectorAll('#chat-questions button').length===5);
  assert.equal(await page.locator('html').getAttribute('lang'),lang);
  assert.equal(await page.locator('.language-switch [aria-current]').getAttribute('data-language'),lang);
  for(const width of [320,375,768,1024,1399,1400,1500]) {
   await page.setViewportSize({width,height:950});
   await page.waitForTimeout(120);
   const box=await page.locator('.language-switch').boundingBox();
   assert(box.x>=0 && box.x+box.width<=width,`switch clipped: ${lang} ${width}`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow: ${lang} ${width}`);
  }
  await page.locator('#validate-import').click();
  assert.match(await page.locator('#import-log').innerText(),lang==='en'?/Required fields missing/:/Pflichtfelder fehlen/);
  await page.locator('#auto-map').click();
  await page.locator('#validate-import').click();
  await page.locator('#run-import').click();
  await page.waitForFunction(()=>!importBusy);
  assert.match(await page.locator('#import-summary').innerText(),lang==='en'?/TEST IMPORT RESULTS/i:/Testimport Ergebnis/i);
  await page.locator('#reset-import').click();
  await page.locator('#analyze-btn').click();
  await page.waitForFunction(()=>leadStatus_==='done');
  assert.match(await page.locator('#leads').innerText(),lang==='en'?/COLD/:/KALT/);
  await page.locator('#reset-leads').click();
  for(let i=0;i<6;i++) {
   await page.locator('#timeline-buttons button').nth(i).click();
   assert((await page.locator('#timeline-panel h3').innerText()).length>4);
  }
  for(let i=0;i<5;i++) {
   await page.locator('#chat-questions button').nth(i).click();
   // The existing streaming UI allows click-to-complete.
   await page.waitForTimeout(2300);
   await page.locator('#chat-log [data-text]').last().click();
   await page.waitForFunction(()=>!chatBusy);
  }
  await page.waitForTimeout(1500);
  await page.locator('#chat-log [data-text]').last().click();
  await page.waitForTimeout(300);
  assert.match(await page.locator('#chat-log').innerText(),lang==='en'?/Interview complete/:/Interview abgeschlossen/);
  await page.locator('#chat-reset').click();
  assert.equal(await page.locator('#chat-questions button:disabled').count(),0);
  console.log(`PASS: ${lang}: layouts, timeline, import, lead scorer, five chat answers, closing and reset`);
 }
 await page.goto(`${base}/index.html#demos`);
 await page.locator('[data-language="en"]').click();
 await page.waitForURL('**/en.html#demos');
 await page.reload();
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 await page.locator('[data-language="de"]').click();
 await page.waitForURL('**/index.html#demos');
 await page.setViewportSize({width:375,height:812});
 await page.locator('#menu-toggle').click();
 assert(await page.locator('#mobile-menu').evaluate(el=>el.classList.contains('open')));
 assert.deepEqual(errors,[]);
 console.log('PASS: language round trip, anchor, reload, mobile menu; no JavaScript errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
