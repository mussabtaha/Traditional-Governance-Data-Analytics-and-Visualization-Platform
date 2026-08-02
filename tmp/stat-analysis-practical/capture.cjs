const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname);
const OUT = path.join(ROOT, 'screenshots');
const URL = 'http://127.0.0.1:5500/statistics-analysis.html';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
fs.mkdirSync(OUT, { recursive: true });

const statuses = [
  '#analysisStatus', '#functionAnalysisStatus', '#populationAnalysisStatus',
  '#groupSizeFunctionsStatus', '#continentLeadershipStatus', '#continentRecognitionStatus'
];

async function prepare(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction((ids) => ids.every((id) => {
    const el = document.querySelector(id);
    return el && !/loading/i.test(el.textContent || '');
  }), statuses, { timeout: 180000 });
  await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 30000 }).catch(() => {});
  await page.addStyleTag({ content: `
    *,*::before,*::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
    #region-recognition-analysis,#dynamic-analysis-engine { display:none !important; }
  `});
  await page.waitForTimeout(1000);
}

async function shot(page, name, selector, padding = 18) {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const box = await loc.boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  const doc = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  const clip = {
    x: Math.max(0, box.x - padding),
    y: Math.max(0, box.y - padding),
    width: Math.min(doc.w - Math.max(0, box.x - padding), box.width + padding * 2),
    height: Math.min(doc.h - Math.max(0, box.y - padding), box.height + padding * 2),
  };
  await page.screenshot({ path: path.join(OUT, name), clip, animations: 'disabled' });
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('siteLanguage', 'en');
    localStorage.setItem('siteTheme', 'light');
  });
  const page = await context.newPage();
  await prepare(page);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, '01-page-entry.png'), fullPage: false });
  await shot(page, '02-navigation.png', '.site-header', 0);
  await page.screenshot({ path: path.join(OUT, '03-complete-six-analysis-page.png'), fullPage: true, animations: 'disabled' });

  await shot(page, '04-a1-question-quality.png', 'section[aria-labelledby="analysisQuestionTitle"]', 28);
  await shot(page, '05-a1-summary-cards.png', '.analysis-quality-grid', 24);
  await shot(page, '06-a1-result-table.png', '#analysisDetail', 20);
  await shot(page, '07-a1-stacked-chart.png', '#leadershipRecognitionChart', 85);
  await shot(page, '08-a1-recognition-heatmap.png', '#recognitionHeatmap', 70);

  await shot(page, '09-a2-summary-matrix.png', '#leadership-functions-analysis .analysis-summary-card', 24);
  await shot(page, '10-a2-effect-heatmap.png', '#functionEffectHeatmap', 75);
  const firstDetails = page.locator('#functionAnalysisCards details').first();
  await firstDetails.locator('summary').click();
  await shot(page, '11-a2-expanded-result.png', '#functionAnalysisCards details', 20);

  await shot(page, '12-a3-descriptive-statistics.png', '#groupsize-recognition-analysis .analysis-summary-card', 24);
  await shot(page, '13-a3-summary-cards.png', '#groupsize-recognition-analysis .population-summary-grid', 24);
  await shot(page, '14-a3-box-plot.png', '#populationBoxPlot', 80);
  await shot(page, '15-a3-histogram.png', '#populationHistogram', 80);
  await shot(page, '16-a3-result.png', '#groupsize-recognition-analysis .population-result-card', 20);

  await shot(page, '17-a4-summary.png', '#groupsize-functions-analysis .analysis-summary-card', 24);
  await shot(page, '18-a4-function-result.png', '#groupSizeFunctionCards .groupsize-function-result', 20);

  await shot(page, '19-a5-summary.png', '#continent-leadership-analysis .analysis-summary-card', 24);
  await shot(page, '20-a5-grouped-chart.png', '#continentLeadershipGroupedChart', 80);
  await shot(page, '21-a5-stacked-chart.png', '#continentLeadershipStackedChart', 80);
  await shot(page, '22-a5-result.png', '#continent-leadership-analysis .continent-leadership-result', 20);

  await shot(page, '23-a6-summary.png', '#continent-recognition-analysis .analysis-summary-card', 24);
  await shot(page, '24-a6-stacked-chart.png', '#continentRecognitionStackedChart', 80);
  await shot(page, '25-a6-heatmap.png', '#continentRecognitionHeatmap', 70);
  await shot(page, '26-a6-result.png', '#continent-recognition-analysis .continent-recognition-result', 20);

  const api = await context.newPage();
  await api.goto('http://127.0.0.1:3000/api/statistical-analysis/leadership-recognition', { waitUntil: 'networkidle', timeout: 120000 });
  await api.screenshot({ path: path.join(OUT, '27-api-json-response.png'), fullPage: false });
  await api.close();

  await page.evaluate(() => { localStorage.setItem('siteLanguage', 'ar'); localStorage.setItem('siteTheme', 'light'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await prepare(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, '28-arabic-rtl.png'), fullPage: false });

  await page.evaluate(() => { localStorage.setItem('siteLanguage', 'en'); localStorage.setItem('siteTheme', 'dark'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await prepare(page);
  await shot(page, '29-dark-mode.png', '#groupsize-recognition-analysis', 0);
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobileContext.addInitScript(() => { localStorage.setItem('siteLanguage', 'en'); localStorage.setItem('siteTheme', 'light'); });
  const mobile = await mobileContext.newPage();
  await prepare(mobile);
  await mobile.evaluate(() => window.scrollTo(0, 0));
  await mobile.screenshot({ path: path.join(OUT, '30-mobile-responsive.png'), fullPage: false });
  await mobileContext.close();

  const loadingContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await loadingContext.addInitScript(() => { localStorage.setItem('siteLanguage', 'en'); localStorage.setItem('siteTheme', 'light'); });
  const loading = await loadingContext.newPage();
  await loading.route('**/api/statistical-analysis/leadership-recognition', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    await route.continue();
  });
  await loading.goto(URL, { waitUntil: 'domcontentloaded' });
  await loading.waitForSelector('#analysisStatus');
  await loading.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await loading.screenshot({ path: path.join(OUT, '31-loading-state.png'), fullPage: false });
  await loadingContext.close();

  const errorContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await errorContext.addInitScript(() => { localStorage.setItem('siteLanguage', 'en'); localStorage.setItem('siteTheme', 'light'); });
  const errorPage = await errorContext.newPage();
  await errorPage.route('**/api/statistical-analysis/leadership-recognition', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success:false, message:'Service temporarily unavailable' }) });
  });
  await errorPage.goto(URL, { waitUntil: 'domcontentloaded' });
  await errorPage.waitForFunction(() => {
    const el=document.querySelector('#analysisStatus');
    return el && !/loading/i.test(el.textContent || '');
  }, null, { timeout: 30000 });
  await errorPage.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await errorPage.screenshot({ path: path.join(OUT, '32-safe-error-state.png'), fullPage: false });
  await errorContext.close();

  await browser.close();
  console.log(JSON.stringify({ count: fs.readdirSync(OUT).length, output: OUT }));
}

main().catch((error) => { console.error(error); process.exit(1); });

