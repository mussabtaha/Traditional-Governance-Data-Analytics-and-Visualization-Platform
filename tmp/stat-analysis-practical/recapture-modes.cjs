const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'screenshots');
const URL = 'http://127.0.0.1:5500/statistics-analysis.html';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const statuses = ['#analysisStatus','#functionAnalysisStatus','#populationAnalysisStatus','#groupSizeFunctionsStatus','#continentLeadershipStatus','#continentRecognitionStatus'];
async function ready(page){
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(ids=>ids.every(id=>{const el=document.querySelector(id);return el&&!/loading/i.test(el.textContent||'')}),statuses,{timeout:180000});
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}#region-recognition-analysis,#dynamic-analysis-engine{display:none!important}'});
  await page.waitForTimeout(800);
}
async function clip(page,selector,file,pad=0){
  const loc=page.locator(selector).first();await loc.scrollIntoViewIfNeeded();const b=await loc.boundingBox();
  await page.screenshot({path:path.join(OUT,file),clip:{x:Math.max(0,b.x-pad),y:Math.max(0,b.y-pad),width:b.width+pad*2,height:b.height+pad*2}});
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:EDGE});
 const ar=await browser.newContext({viewport:{width:1440,height:1000}});
 await ar.addInitScript(()=>{localStorage.setItem('siteLanguage','ar');localStorage.setItem('siteTheme','light')});
 const arp=await ar.newPage();await ready(arp);await arp.evaluate(()=>scrollTo(0,0));await arp.screenshot({path:path.join(OUT,'28-arabic-rtl.png')});await ar.close();
 const dark=await browser.newContext({viewport:{width:1440,height:1000}});
 await dark.addInitScript(()=>{localStorage.setItem('siteLanguage','en');localStorage.setItem('siteTheme','dark')});
 const dp=await dark.newPage();await ready(dp);await clip(dp,'#groupsize-recognition-analysis','29-dark-mode.png',0);await dark.close();
 await browser.close();
 console.log('recaptured Arabic RTL and dark mode');
})().catch(e=>{console.error(e);process.exit(1)});
