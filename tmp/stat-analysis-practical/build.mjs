import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'Statistical_Analysis_Practical_Explanation.pptx');
const SHOTS = path.join(HERE, 'screenshots');
const DATA = path.join(HERE, 'data');
const RENDERS = path.join(HERE, 'renders');
await fs.mkdir(RENDERS, { recursive: true });

const C = {
  deep: '#071d14', green: '#123524', green2: '#0b3d2e', jade: '#287a50',
  gold: '#C8A96A', gold2: '#E6C98E', cream: '#F8F7F3', sand: '#EEE9DC',
  white: '#FFFFFF', ink: '#16221C', muted: '#5E6A63', line: '#D8D8CF',
  red: '#B74C45', rose: '#F4DEDC', blue: '#4F7787', blueLite: '#E4EEF1',
  greenLite: '#E5EFE8', goldLite: '#F5EBD8', slate: '#EEF0EC', darkPanel: '#103027'
};

const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const api = {};
for (let i = 1; i <= 6; i++) {
  const raw = JSON.parse(await fs.readFile(path.join(DATA, `a${i}.json`), 'utf8'));
  api[`a${i}`] = raw.data || raw;
}
const shot = {};
for (const name of await fs.readdir(SHOTS)) {
  if (name.endsWith('.png')) shot[name] = await fs.readFile(path.join(SHOTS, name));
}
const logo = await fs.readFile(path.join(ROOT, 'assets', 'icons', 'apple-touch-icon.png'));
const hero = await fs.readFile(path.join(ROOT, 'assets', 'images', 'hero-village.png'));

function addShape(slide, geometry, left, top, width, height, fill = 'none', line = 'none', radius = undefined, shadow = undefined) {
  const o = { geometry, position: { left, top, width, height }, fill,
    line: { style: 'solid', fill: line, width: line === 'none' ? 0 : 1 } };
  if (radius) o.borderRadius = radius;
  if (shadow) o.shadow = shadow;
  return slide.shapes.add(o);
}
function addText(slide, value, left, top, width, height, size = 18, color = C.ink, bold = false, align = 'left', font = undefined) {
  const box = addShape(slide, 'textbox', left, top, width, height, 'none', 'none');
  box.text = String(value);
  box.text.style = { fontSize: size, color, bold, alignment: align, ...(font ? { fontFamily: font } : {}) };
  return box;
}
function line(slide, left, top, width, height, color = C.line, weight = 2) {
  return slide.shapes.add({ geometry: 'line', position: { left, top, width, height }, fill: 'none', line: { style: 'solid', fill: color, width: weight } });
}
function addImage(slide, bytes, left, top, width, height, alt, fit = 'contain', geometry = 'roundRect') {
  addShape(slide, geometry, left - 4, top - 4, width + 8, height + 8, C.white, C.line, 'rounded-xl', 'shadow-sm');
  return slide.images.add({ blob: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), contentType: 'image/png', alt, fit, position: { left, top, width, height }, geometry, borderRadius: 'rounded-lg' });
}
function addLogo(slide, left = 58, top = 24, size = 34) {
  slide.images.add({ blob: logo.buffer.slice(logo.byteOffset, logo.byteOffset + logo.byteLength), contentType: 'image/png', alt: 'Traditional Governance official building icon', fit: 'contain', position: { left, top, width: size, height: size } });
}
function footer(slide, n, dark = false) {
  line(slide, 58, 681, 1164, 0, dark ? '#315145' : C.line, 1);
  addText(slide, 'Traditional Governance Data Analytics â€¢ Statistical Analysis Module', 58, 687, 760, 18, 11, dark ? '#B8C8C0' : '#7B837E');
  addText(slide, String(n).padStart(2, '0'), 1180, 685, 42, 18, 11, dark ? C.gold2 : C.green, true, 'right');
}
function base(title, section, n, dark = false, subtitle = '') {
  const s = deck.slides.add(); s.background.fill = dark ? C.deep : C.cream;
  addLogo(s); addText(s, section.toUpperCase(), 104, 27, 420, 22, 12, dark ? C.gold2 : C.green, true);
  addText(s, title, 58, 70, 1164, 54, 35, dark ? C.white : C.ink, true);
  addShape(s, 'rect', 58, 136, 96, 4, C.gold, 'none');
  if (subtitle) addText(s, subtitle, 178, 124, 1000, 32, 16, dark ? '#C7D2CC' : C.muted);
  footer(s, n, dark); return s;
}
function note(slide, talk, sources = []) {
  const src = Array.isArray(sources) ? sources : [sources];
  slide.speakerNotes.textFrame.setText(`${talk}\n\n[Sources]\n${src.map(x => `- ${x}`).join('\n')}\n[/Sources]`);
  slide.speakerNotes.setVisible(true);
}
function card(slide, left, top, width, height, title, body, accent = C.green, fill = C.white, bodySize = 17) {
  addShape(slide, 'roundRect', left, top, width, height, fill, C.line, 'rounded-xl', 'shadow-sm');
  addShape(slide, 'rect', left, top, 7, height, accent, 'none');
  addText(slide, title, left + 22, top + 16, width - 38, 30, 21, C.ink, true);
  addText(slide, body, left + 22, top + 54, width - 40, height - 66, bodySize, C.muted);
}
function metric(slide, left, top, width, label, value, accent = C.green, suffix = '') {
  addShape(slide, 'roundRect', left, top, width, 106, C.white, C.line, 'rounded-xl', 'shadow-sm');
  addText(slide, label, left + 16, top + 13, width - 32, 22, 15, C.muted, true);
  addText(slide, `${value}${suffix}`, left + 16, top + 40, width - 32, 43, 27, accent, true);
}
function pill(slide, left, top, width, label, fill = C.green, color = C.white) {
  addShape(slide, 'roundRect', left, top, width, 34, fill, 'none', 'rounded-full');
  addText(slide, label, left + 10, top + 7, width - 20, 20, 14, color, true, 'center');
}
function circle(slide, x, y, label, fill = C.green, size = 48, color = C.white) {
  addShape(slide, 'ellipse', x, y, size, size, fill, C.white);
  addText(slide, label, x, y + 11, size, 24, 18, color, true, 'center');
}
function simpleTable(slide, left, top, width, headers, rows, opts = {}) {
  const rowH = opts.rowH || 38, headerH = opts.headerH || 40, weights = opts.weights || headers.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0); const colW = weights.map(w => width * w / total);
  let x = left;
  headers.forEach((h, i) => { addShape(slide, 'rect', x, top, colW[i], headerH, C.green2, C.white); addText(slide, h, x + 8, top + 9, colW[i] - 16, 22, 16, C.white, true, opts.align || 'left'); x += colW[i]; });
  rows.forEach((row, r) => { x = left; row.forEach((v, i) => { addShape(slide, 'rect', x, top + headerH + r * rowH, colW[i], rowH, r % 2 ? C.cream : C.white, C.line); addText(slide, v, x + 8, top + headerH + r * rowH + 8, colW[i] - 16, rowH - 12, opts.bodySize || 16, C.ink, i === 0); x += colW[i]; }); });
}
function screenshotWithLegend(slide, bytes, imagePos, items, alt) {
  addImage(slide, bytes, imagePos.left, imagePos.top, imagePos.width, imagePos.height, alt, 'contain');
  items.forEach((it) => circle(slide, imagePos.left + it.x * imagePos.width, imagePos.top + it.y * imagePos.height, String(it.n), it.color || C.green, 34));
  const lx = imagePos.left + imagePos.width + 32, ly = imagePos.top;
  addText(slide, 'Reading guide', lx, ly, 280, 30, 22, C.green, true);
  items.forEach((it, i) => { circle(slide, lx, ly + 52 + i * 58, String(it.n), it.color || C.green, 30); addText(slide, it.label, lx + 42, ly + 48 + i * 58, 270, 46, 16, C.ink, i === 0); });
}
function flow(slide, nodes, left, top, width, height, colors = []) {
  const gap = 24, w = (width - gap * (nodes.length - 1)) / nodes.length;
  for (let i = 0; i < nodes.length - 1; i++) addShape(slide, 'chevron', left + w + i * (w + gap) + 4, top + height / 2 - 14, gap - 8, 28, C.gold, 'none');
  nodes.forEach((node, i) => { const x = left + i * (w + gap); addShape(slide, 'roundRect', x, top, w, height, colors[i] || (i % 2 ? C.goldLite : C.greenLite), C.line, 'rounded-xl'); addText(slide, node[0], x + 12, top + 18, w - 24, 30, 19, C.ink, true, 'center'); addText(slide, node[1], x + 12, top + 58, w - 24, height - 70, 15, C.muted, false, 'center'); });
}
function codeBox(slide, left, top, width, height, title, code, accent = C.green) {
  addShape(slide, 'roundRect', left, top, width, height, '#101A16', accent, 'rounded-xl', 'shadow-sm');
  addText(slide, title, left + 18, top + 14, width - 36, 26, 18, C.gold2, true);
  addText(slide, code, left + 18, top + 50, width - 36, height - 64, 16, '#E7EEE9', false, 'left', 'Consolas');
}
function fmt(v, d = 3) { return v == null ? 'Not computable' : Number(v).toFixed(d); }
function pv(v) { return v == null ? 'Not computable' : v < 0.001 ? '< 0.001' : Number(v).toFixed(3); }

// 1 â€” Title
{
  const s = deck.slides.add(); s.background.fill = C.deep;
  s.images.add({ blob: hero.buffer.slice(hero.byteOffset, hero.byteOffset + hero.byteLength), contentType: 'image/png', alt: 'Traditional village landscape used by the project', fit: 'cover', position: { left: 560, top: 0, width: 720, height: 720 } });
  addShape(s, 'rect', 0, 0, 620, 720, C.deep, 'none'); addShape(s, 'rect', 540, 0, 110, 720, C.deep, 'none');
  addLogo(s, 70, 58, 44); addText(s, 'TRADITIONAL GOVERNANCE', 126, 68, 360, 24, 13, C.gold2, true);
  addShape(s, 'rect', 70, 125, 110, 4, C.gold, 'none');
  addText(s, 'Statistical Analysis\nModule', 70, 175, 480, 146, 54, C.white, true);
  addText(s, 'Practical and Technical Explanation', 70, 340, 460, 42, 25, C.gold2, true);
  addText(s, 'Six implemented analyses â€¢ Graduation project defense', 70, 410, 450, 48, 20, '#D2DED7');
  addText(s, 'Musab Taha Ahmed', 70, 535, 360, 30, 22, C.white, true);
  addText(s, 'Student index: 20-312', 70, 570, 360, 25, 17, '#B8C8C0');
  note(s, 'Open by saying that the presentation explains both the statistical reasoning and the actual software path used by the implemented module. The scope is deliberately limited to Analyses 1 through 6.', ['Project README.md', 'Local statistics-analysis.html screenshot captured 1 August 2026']);
}

// 2 â€” Purpose
{
  const s = base('The module moves from description to evidence', 'Introduction', 2);
  addText(s, 'Descriptive statistics', 90, 185, 470, 36, 27, C.green, true);
  addText(s, 'What is present in the sample?', 90, 230, 470, 30, 20, C.ink, true);
  addText(s, 'Counts, percentages, means, medians, ranges and missing values summarize the observed dataset.', 90, 278, 470, 100, 20, C.muted);
  addShape(s, 'chevron', 590, 280, 100, 70, C.gold, 'none');
  addText(s, 'Inferential analysis', 730, 185, 470, 36, 27, C.gold, true);
  addText(s, 'Is the pattern larger than chance?', 730, 230, 470, 30, 20, C.ink, true);
  addText(s, 'Tests, p-values and effect sizes evaluate association or difference without claiming causation.', 730, 278, 470, 100, 20, C.muted);
  card(s, 170, 465, 940, 100, 'Defense message', 'A statistically significant pattern still needs an effect-size interpretation and a clear limitation statement.', C.green, C.greenLite, 20);
  note(s, 'Explain that descriptive results tell us what the sample looks like. Inferential results ask whether an observed pattern is unlikely under a null hypothesis. The module always reports both significance and effect size.', ['README.md statistical analysis sections', 'backend-flask/routes/api.py']);
}

// 3 â€” Six analyses
{
  const s = base('Six questions define the implemented scope', 'Introduction', 3);
  const labels = [
    ['1','Leadership أ— Recognition'],['2','Leadership أ— Functions'],['3','Population أ— Recognition'],
    ['4','Population أ— Functions'],['5','Continent أ— Leadership'],['6','Continent أ— Recognition']
  ];
  labels.forEach((v,i)=>{const x=85+(i%3)*395,y=190+Math.floor(i/3)*190;circle(s,x,y,v[0],i%2?C.gold:C.green,58);addText(s,v[1],x+80,y+5,280,30,21,C.ink,true);addText(s,i<2||i>3?'Categorical relationship':'Population distribution difference',x+80,y+45,280,48,17,C.muted);});
  addText(s, 'Excluded from this deck: selection-method analysis and the removed dynamic engine.', 250, 590, 780, 28, 17, C.red, true, 'center');
  note(s, 'Name the six analyses in order. Emphasize that the deck does not discuss leadership selection methods or the removed dynamic engine, because they are outside the required scope.', ['statistics-analysis.html', 'docs/statistical-analysis-verification-report.md']);
}

// 4 â€” Architecture
{
  const s = base('One traceable path connects MySQL to the researcher', 'System workflow', 4, true);
  flow(s,[['MySQL','tradgov_groups'],['Pool','reusable connections'],['Python','analysis service'],['Pandas / NumPy','clean + group'],['SciPy','statistical test']],58,190,1164,105,[C.greenLite,C.goldLite,C.greenLite,C.goldLite,C.greenLite]);
  flow(s,[['Flask','route + validation'],['REST API','HTTP endpoint'],['JSON','safe data contract'],['JavaScript','render state'],['Chart.js','visual evidence']],58,390,1164,105,[C.goldLite,C.greenLite,C.goldLite,C.greenLite,C.goldLite]);
  addText(s, 'Database truth', 90, 545, 260, 26, 18, C.gold2, true, 'center'); addText(s, 'Statistical evidence', 510, 545, 260, 26, 18, C.gold2, true, 'center'); addText(s, 'Defense-ready explanation', 930, 545, 260, 26, 18, C.gold2, true, 'center');
  note(s, 'Walk left to right. MySQL stores rows, the pool manages connections, Pandas and NumPy prepare valid observations, SciPy calculates the test, Flask exposes a stable endpoint, and JavaScript with Chart.js turns the JSON into the visible page.', ['docs/statistical-analysis-verification-report.md section 2', 'backend-flask/database/db.py', 'backend-flask/routes/api.py', 'js/script.js']);
}

// 5 â€” Roles
{
  const s=base('Each technology has one clear responsibility','System workflow',5);
  const rows=[['MySQL','Stores source records and missing values'],['Connection pool','Reuses bounded database connections'],['Pandas / NumPy','Coerces, filters, groups and summarizes'],['SciPy','Runs Chi-Square, Shapiro-Wilk and Mann-Whitney U'],['Flask','Validates requests and returns JSON'],['JavaScript / Chart.js','Renders results without recalculating statistics']];
  simpleTable(s,95,180,1090,['Component','Responsibility'],rows,{rowH:61,weights:[1,2.7],bodySize:18});
  note(s,'The important design principle is separation of concerns. The browser never reimplements a statistical formula, and MySQL does not decide the statistical interpretation. Each layer has a bounded role.',['docs/statistical-analysis-verification-report.md sections 2 and 5','js/script.js','backend-flask/routes/api.py']);
}

// 6 â€” API screenshot
{
  const s=base('The API returns both evidence and explanation','System workflow',6);
  screenshotWithLegend(s,shot['27-api-json-response.png'],{left:60,top:175,width:790,height:450},[
    {n:1,x:.03,y:.10,label:'HTTP JSON from the real local endpoint'},
    {n:2,x:.35,y:.20,label:'Observed and expected frequencies'},
    {n:3,x:.65,y:.34,label:'p-value, sample size and Cramerâ€™s V'},
    {n:4,x:.45,y:.64,label:'Automatic interpretation and chart data'}
  ],'Live leadership-recognition API response in Microsoft Edge');
  note(s,'Explain that the endpoint does not send only a p-value. It sends the research question, table values, effect size, missing-value counts, interpretation and chart datasets, allowing the frontend to remain a renderer.',['Screenshot 27-api-json-response.png captured from http://127.0.0.1:3000/api/statistical-analysis/leadership-recognition on 1 August 2026']);
}

// 7 â€” user action flow
{
 const s=base('A page load becomes a reproducible result in seven steps','System workflow',7);
 flow(s,[['1. Request','fetch endpoint'],['2. Validate','reject bad query'],['3. Query','parameterized SQL'],['4. Prepare','complete cases']],60,185,1160,110);
 flow(s,[['5. Test','SciPy result'],['6. Serialize','JSON-safe values'],['7. Render','tables + charts']],180,390,920,110,[C.goldLite,C.greenLite,C.goldLite]);
 card(s,260,555,760,72,'No hidden browser calculation','Changing an Analysis 1 selector reuses already-loaded results; it does not invent or recompute statistics.',C.blue,C.blueLite,16);
 note(s,'Describe the flow as deterministic and auditable. The frontend sends one request, the backend validates and calculates, and the response is rendered. The Analysis 1 selector changes only which precomputed result is displayed.',['js/script.js initStatisticalAnalysisPage','docs/statistical-analysis-verification-report.md section 8']);
}

// 8 â€” variable types
{
 const s=base('Correct test selection begins with variable type','Statistical foundations',8);
 card(s,70,185,350,310,'Binary','Two valid states: 1 = present / yes, 0 = absent / no.\n\nExamples: king, chief, headman, formackn, func_land, func_sec, kingheal.',C.green,C.greenLite,18);
 card(s,465,185,350,310,'Categorical','Named groups without numeric distance.\n\nExample: continent with Africa, Americas, Asia, Europe and Oceania.',C.gold,C.goldLite,18);
 card(s,860,185,350,310,'Numeric','Measured quantity with meaningful order and distance.\n\nExample: groupsize, the population estimate.',C.blue,C.blueLite,18);
 addText(s,'Compatibility rule: categorical أ— categorical â†’ Chi-Square; numeric أ— binary â†’ normality check, then t-test or Mann-Whitney.',140,555,1000,48,19,C.ink,true,'center');
 note(s,'Tell the examiner that the test is selected from the measurement level, not from personal preference. Binary indicators are categorical; groupsize is numeric and highly skewed.',['README.md dataset dictionary and statistical analysis sections','backend-flask/routes/api.py']);
}

// 9 â€” contingency table
{
 const s=base('A contingency table converts categories into testable counts','Statistical foundations',9);
 simpleTable(s,120,205,650,['King status','Recognized','Not recognized'],[['Present','268','26'],['Absent','476','263']],{rowH:88,weights:[1.5,1,1],bodySize:22});
 circle(s,830,235,'1',C.green,62); addText(s,'Rows represent leadership status',915,245,280,32,20,C.ink,true);
 circle(s,830,340,'2',C.gold,62); addText(s,'Columns represent recognition status',915,350,280,48,20,C.ink,true);
 circle(s,830,465,'N',C.blue,62); addText(s,'All four cells sum to 1,033 valid records',915,475,280,48,20,C.ink,true);
 note(s,'Use the actual King table. Each record contributes to exactly one cell because King and recognition are both binary for the included sample. The table is the input to Chi-Square.',['Live A1 API snapshot a1.json','docs/statistical-analysis-verification-report.md section 6']);
}

// 10 â€” observed/expected
{
 const s=base('Chi-Square compares observed counts with independence','Statistical foundations',10);
 addText(s,'Observed',115,185,420,34,25,C.green,true,'center'); addText(s,'Expected if independent',745,185,420,34,25,C.blue,true,'center');
 simpleTable(s,80,245,480,['King','Rec.','Not rec.'],[['Present','268','26'],['Absent','476','263']],{rowH:70,weights:[1.4,1,1],bodySize:20});
 addShape(s,'chevron',590,325,90,56,C.gold,'none');
 simpleTable(s,720,245,480,['King','Rec.','Not rec.'],[['Present','211.75','82.25'],['Absent','532.25','206.75']],{rowH:70,weights:[1.4,1,1],bodySize:20});
 card(s,220,510,840,95,'Core idea','Large observedâ€“expected differences increase د‡آ²; expected counts come from row and column totals, not from guesses.',C.green,C.greenLite,19);
 note(s,'Point to the present/not-recognized cell: 26 observed versus about 82 expected under independence. That large difference contributes strongly to the Chi-Square statistic.',['Live A1 API snapshot a1.json','SciPy chi2_contingency documentation: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.chi2_contingency.html']);
}

// 11 â€” Chi-square
{
 const s=base('Chi-Square summarizes all cell differences','Statistical foundations',11);
 addText(s,'د‡آ² = خ£ (Observed âˆ’ Expected)آ² / Expected',250,190,780,64,34,C.green,true,'center');
 const vals=[['Present أ— recognized','268 vs 211.75'],['Present أ— not recognized','26 vs 82.25'],['Absent أ— recognized','476 vs 532.25'],['Absent أ— not recognized','263 vs 206.75']];
 vals.forEach((v,i)=>{const x=95+(i%2)*570,y=315+Math.floor(i/2)*115;addShape(s,'roundRect',x,y,520,82,i===1?C.goldLite:C.white,C.line,'rounded-xl');addText(s,v[0],x+18,y+14,300,26,18,C.ink,true);addText(s,v[1],x+325,y+14,170,30,22,i===1?C.gold:C.green,true,'right');});
 addText(s,'The statistic measures departure from independence; it does not measure effect strength.',160,590,960,32,19,C.red,true,'center');
 note(s,'Explain the formula conceptually rather than deriving it. Every cell adds a non-negative contribution. A larger total means the observed table is less compatible with independence. Effect strength is reported separately by Cramerâ€™s V.',['SciPy chi2_contingency documentation','backend-flask/routes/api.py']);
}

// 12 â€” df
{
 const s=base('Degrees of freedom describe table complexity','Statistical foundations',12);
 addText(s,'df = (rows âˆ’ 1) أ— (columns âˆ’ 1)',330,190,620,52,31,C.green,true,'center');
 const ex=[['2 أ— 2','Leadership أ— recognition','df = 1'],['3 أ— 3','Three categories each','df = 4'],['5 أ— 3','Continent أ— leadership','df = 8']];
 ex.forEach((v,i)=>{const x=95+i*395;addShape(s,'roundRect',x,315,330,190,i===1?C.goldLite:C.white,C.line,'rounded-xl','shadow-sm');addText(s,v[0],x+30,340,270,40,30,i===1?C.gold:C.green,true,'center');addText(s,v[1],x+30,400,270,38,18,C.muted,false,'center');addText(s,v[2],x+30,462,270,30,22,C.ink,true,'center');});
 note(s,'Relate degrees of freedom to the number of independently varying cells. Analysis 1 uses 2 by 2 tables and df equals 1; Analysis 5 uses five continents by three leadership types and df equals 8.',['SciPy chi2_contingency documentation','Live A1 and A5 API snapshots']);
}

// 13 â€” p-value
{
 const s=base('The p-value measures evidenceâ€”not importance','Statistical foundations',13);
 addText(s,'Stronger evidence',110,225,260,28,19,C.green,true); addText(s,'Weaker evidence',910,225,260,28,19,C.muted,true,'right');
 addShape(s,'roundRect',120,290,1040,68,C.slate,'none','rounded-full'); addShape(s,'roundRect',120,290,410,68,C.green,'none','rounded-full'); addShape(s,'rect',530,275,4,98,C.gold,'none');
 addText(s,'0',110,375,40,22,16,C.muted); addText(s,'خ± = 0.05',485,375,110,22,17,C.gold,true,'center'); addText(s,'1',1135,375,30,22,16,C.muted,'right');
 card(s,150,455,450,118,'p < 0.05','Reject the null hypothesis of independence or equal distributions.',C.green,C.greenLite,18);
 card(s,680,455,450,118,'p â‰¥ 0.05','The sample does not provide enough evidence to reject the null.',C.gold,C.goldLite,18);
 addText(s,'Never say: â€œp is the probability that the null hypothesis is true.â€‌',220,610,840,30,18,C.red,true,'center');
 note(s,'Use the project threshold alpha equals 0.05. A small p-value is evidence against the null model; it is not the probability that the null is true and it does not quantify importance.',['Project API alpha=0.05 conventions','SciPy statistical test documentation']);
}

// 14 â€” Cramer's V
{
 const s=base('Cramerâ€™s V answers the missing question: how strong?','Statistical foundations',14);
 const scale=[['Very weak','< .10',C.slate],['Weak','.10â€“.29',C.greenLite],['Moderate','.30â€“.49',C.goldLite],['Strong','.50â€“.69',C.gold],['Very strong','â‰¥ .70',C.green]];
 scale.forEach((v,i)=>{const x=60+i*232;addShape(s,'rect',x,260,220,110,v[2],C.white);addText(s,v[0],x+10,280,200,28,20,i===4?C.white:C.ink,true,'center');addText(s,v[1],x+10,325,200,24,17,i===4?C.white:C.muted,true,'center');});
 addText(s,'0',55,385,35,24,16,C.muted);addText(s,'1',1190,385,35,24,16,C.muted,'right');
 card(s,170,460,940,112,'Report p and V together','p answers whether evidence exists. Cramerâ€™s V answers whether the association is practically small, moderate or strong.',C.green,C.white,19);
 addText(s,'V has no direction; percentages and charts show the pattern.',280,610,720,28,18,C.muted,true,'center');
 note(s,'State that Cramerâ€™s V ranges from zero to one. The five-level scale shown is the one documented for the leadership-function module. Analysis 1 returns its own implemented strength labels, so always report the API label and the numeric V together.',['README.md Analysis #2 effect scale','backend-flask/routes/api.py effect-size helpers']);
}

// 15 â€” Shapiro
{
 const s=base('Shapiroâ€“Wilk decides whether a parametric test is plausible','Statistical foundations',15);
 flow(s,[['Population values','split by 0 / 1'],['Shapiroâ€“Wilk','test each group'],['Both normal?','compare p to .05'],['Choose test','Welch t or Mannâ€“Whitney']],70,210,1140,120);
 card(s,150,420,430,120,'If both groups appear normal','Use Welchâ€™s independent samples t-test to compare means without assuming equal variance.',C.green,C.greenLite,18);
 card(s,700,420,430,120,'If either group is non-normal','Use the two-sided Mannâ€“Whitney U test on ranked observations.',C.gold,C.goldLite,18);
 addText(s,'The live population analyses follow the non-normal branch.',280,590,720,30,20,C.green,true,'center');
 note(s,'Explain that normality is assessed after missing and invalid values are removed. The current database fails normality in at least one group for Analyses 3 and 4, so the module selects Mann-Whitney automatically.',['SciPy shapiro documentation: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.shapiro.html','backend-flask/routes/api.py']);
}

// 16 â€” Mann Whitney
{
 const s=base('Mannâ€“Whitney compares ranks when population is skewed','Statistical foundations',16);
 addText(s,'Raw values',95,190,220,30,22,C.green,true); const raw=['10','90','14k','112k','223k','1.1m','91m','104m'];
 raw.forEach((v,i)=>{circle(s,95+i*140,245,v,i<4?C.greenLite:C.goldLite,64,C.ink);});
 addShape(s,'chevron',570,345,140,60,C.gold,'none'); addText(s,'Convert to ordered ranks',450,415,380,30,20,C.gold,true,'center');
 const ranks=['1','2','3','4','5','6','7','8']; ranks.forEach((v,i)=>{circle(s,95+i*140,480,v,i<4?C.green:C.gold,58);});
 addText(s,'The test compares rank distributions, making it less sensitive to extreme population values.',170,590,940,34,19,C.ink,true,'center');
 note(s,'Clarify that Mann-Whitney is not simply a median test. It compares the rank distributions of two independent groups. The module uses a two-sided test and reports rank-biserial correlation as effect size.',['SciPy mannwhitneyu documentation: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mannwhitneyu.html','Live A3 API snapshot']);
}

// 17 â€” interpretation
{
 const s=base('Significance, effect and causation answer different questions','Statistical foundations',17,true);
 circle(s,160,220,'p',C.jade,70);circle(s,605,220,'V',C.gold,70);circle(s,1050,220,'â†”',C.blue,70);
 addText(s,'Evidence',105,315,180,28,22,C.white,true,'center');addText(s,'Effect size',550,315,180,28,22,C.white,true,'center');addText(s,'Association only',985,315,200,28,22,C.white,true,'center');
 line(s,100,385,1080,0,C.gold,2);
 addText(s,'Allowed',115,430,150,26,19,C.gold2,true);addText(s,'â€œLeadership and recognition are statistically associated.â€‌',285,430,820,30,20,C.white);
 addText(s,'Not allowed',115,490,150,26,19,'#EBA7A1',true);addText(s,'â€œLeadership causes formal recognition.â€‌',285,490,820,30,20,'#EBA7A1');
 addText(s,'Observational data cannot remove every confounder or establish temporal causality.',190,585,900,32,18,'#C7D2CC',true,'center');
 note(s,'This is a defense-critical distinction. A significant p-value establishes evidence of association or difference. Effect size describes magnitude. Neither establishes causation because the data are observational.',['docs/statistical-analysis-verification-report.md section 11','Project endpoint interpretations']);
}

// 18 â€” A1 question
{
 const s=base('A1 asks whether leadership and recognition move together','Analysis 1',18);
 card(s,70,185,500,160,'Research question','Is King, Chief or Headman status associated with formal state recognition?',C.green,C.greenLite,21);
 flow(s,[['Leadership','king / chief / headman'],['أ—','three separate tests'],['Recognition','formackn = 0 / 1']],650,190,540,110,[C.greenLite,C.goldLite,C.greenLite]);
 metric(s,105,430,245,'Database rows','1,557',C.green);metric(s,390,430,245,'Final sample / test','1,033',C.gold);metric(s,675,430,245,'Excluded','524',C.red);metric(s,960,430,245,'Tests','3',C.blue);
 addText(s,'Missing-data rule: include rows with binary leadership and binary recognition for the tested variable.',150,580,980,38,18,C.muted,true,'center');
 note(s,'Explain why there are three tests: King, Chief and Headman are separate binary indicators and can overlap. Each is tested against formal recognition. All three live tests use 1,033 records because 524 recognition values are missing.',['Live A1 API snapshot','docs/statistical-analysis-verification-report.md section 5']);
}

// 19 â€” A1 result screenshot
{
 const s=base('A1 exposes the complete evidence for one leadership type','Analysis 1',19);
 screenshotWithLegend(s,shot['06-a1-result-table.png'],{left:55,top:170,width:830,height:470},[
  {n:1,x:.12,y:.09,label:'Selected leadership result'}, {n:2,x:.18,y:.24,label:'د‡آ² and p-value'},
  {n:3,x:.52,y:.24,label:'df, V and sample size'}, {n:4,x:.20,y:.46,label:'Automatic interpretation'},
  {n:5,x:.20,y:.70,label:'Observed and expected tables'}
 ],'Real Analysis 1 result card and frequency tables');
 note(s,'Use this screenshot to demonstrate traceability. Point from the research result title to the five metrics, then to the interpretation and the two frequency tables. Explain that expected frequencies are calculated by SciPy under independence.',['Screenshot 06-a1-result-table.png captured from the live local page on 1 August 2026','Live A1 API snapshot']);
}

// 20 â€” A1 visuals
{
 const s=base('A1 charts show both counts and direction','Analysis 1',20);
 addImage(s,shot['07-a1-stacked-chart.png'],60,180,550,360,'Real stacked recognition chart for leadership types');
 addImage(s,shot['08-a1-recognition-heatmap.png'],670,180,550,360,'Real recognition percentage heatmap');
 circle(s,95,215,'1',C.green,34);circle(s,705,215,'2',C.gold,34);
 addText(s,'1  Stacked bars preserve counts, including missing recognition.',80,565,520,38,18,C.ink,true);
 addText(s,'2  Heatmap shows direction as recognized vs not recognized percentages.',660,565,560,38,18,C.ink,true);
 note(s,'Explain why the two visuals are complementary. Counts show sample composition and missingness. Percentages make the recognition pattern easier to compare across leadership types.',['Screenshots 07-a1-stacked-chart.png and 08-a1-recognition-heatmap.png','Live A1 API chart payload']);
}

// 21 â€” A1 results/examiner
{
 const s=base('A1 finds significant but weak associations','Analysis 1',21);
 const rows=api.a1.analyses.map(x=>[x.label,fmt(x.chi_square),pv(x.p_value),fmt(x.cramers_v),x.effect_strength]);
 simpleTable(s,60,175,760,['Leadership','د‡آ²','p','V','Strength'],rows,{rowH:60,weights:[1.4,1,1,1,1.2],bodySize:18});
 card(s,860,175,350,150,'Correct conclusion','All three indicators are associated with recognition, but the effects are weak. Headman is numerically the smallest.',C.green,C.greenLite,18);
 card(s,860,355,350,120,'Do not claim','Leadership causes recognition, or that a weak effect is unimportant for every policy context.',C.red,C.rose,18);
 card(s,860,505,350,120,'Examiner question','Why report Cramerâ€™s V? Because p depends partly on sample size; V describes association magnitude.',C.gold,C.goldLite,17);
 note(s,'State the live values: King د‡آ² 74.664, Chief 53.382 and Headman 5.043. All p-values are below .05. The endpoint labels all three effects weak, with Headman V=.070 being numerically very small.',['Live A1 API snapshot captured 1 August 2026']);
}

// 22 â€” A2 design
{
 const s=base('A2 expands the design into nine independent tests','Analysis 2',22);
 addText(s,'Leadership indicators',90,190,420,30,24,C.green,true);addText(s,'Governance functions',770,190,420,30,24,C.gold,true,'right');
 ['King','Chief','Headman'].forEach((x,i)=>{circle(s,120+i*150,270,x[0],C.green,58);addText(s,x,100+i*150,340,100,24,16,C.ink,true,'center');});
 addShape(s,'chevron',560,280,130,70,C.gold,'none');
 ['Land','Security','Healing'].forEach((x,i)=>{circle(s,760+i*150,270,x[0],C.gold,58);addText(s,x,740+i*150,340,100,24,16,C.ink,true,'center');});
 addText(s,'3 أ— 3 = 9 Chi-Square tests',385,430,510,44,30,C.green,true,'center');
 card(s,150,520,980,95,'Why separate tests?','Each pair asks a distinct question and uses its own complete-case sample. Healing has much more missing data than land or security.',C.blue,C.blueLite,19);
 note(s,'Explain that the module does not combine the nine pairs into one opaque score. It preserves each leadership-function question, its sample size, its missing values, its p-value and its Cramerâ€™s V.',['Live A2 API snapshot','README.md Analysis #2']);
}

// 23 â€” A2 matrix
{
 const s=base('A2 uses a heatmap to compare effect sizes fairly','Analysis 2',23);
 screenshotWithLegend(s,shot['10-a2-effect-heatmap.png'],{left:70,top:185,width:760,height:420},[
  {n:1,x:.18,y:.19,label:'Rows: King, Chief, Headman'}, {n:2,x:.55,y:.18,label:'Columns: Land, Security, Healing'},
  {n:3,x:.33,y:.49,label:'Cell value: Cramerâ€™s V'}, {n:4,x:.82,y:.30,label:'Not Available = not computable'}
 ],'Real Analysis 2 Cramerâ€™s V heatmap');
 note(s,'Read the matrix row by row. Larger numbers indicate stronger associations. King أ— Healing is shown as not available because the valid data lack enough variation for a valid contingency calculationâ€”not because the result is non-significant.',['Screenshot 10-a2-effect-heatmap.png','Live A2 API snapshot']);
}

// 24 â€” A2 expanded
{
 const s=base('A2 distinguishes â€œnot significantâ€‌ from â€œnot computableâ€‌','Analysis 2',24);
 addImage(s,shot['11-a2-expanded-result.png'],60,175,740,420,'Real expanded Analysis 2 result with metrics and tables');
 card(s,840,175,370,140,'Not significant','A valid test exists, but p â‰¥ .05. Example: Headman أ— Healing, p = .894.',C.gold,C.goldLite,18);
 card(s,840,345,370,155,'Not computable','A valid Chi-Square table cannot be formed because the available King أ— Healing values have insufficient variation.',C.red,C.rose,18);
 card(s,840,530,370,90,'Missingness matters','Healing uses only 306 valid rows; land and security use 1,139.',C.blue,C.blueLite,17);
 circle(s,90,205,'1',C.green,34);circle(s,430,300,'2',C.gold,34);circle(s,700,520,'3',C.blue,34);
 note(s,'This distinction is a likely examiner question. Non-significant means a valid test produced insufficient evidence. Non-computable means the mathematical assumptions could not be satisfied. The system returns null values and a warning rather than fabricating a statistic.',['Screenshot 11-a2-expanded-result.png','docs/statistical-analysis-verification-report.md section 7','Live A2 API snapshot']);
}

// 25 â€” A2 results
{
 const s=base('A2 finds broad land and security patterns, but weak effects','Analysis 2',25);
 const selected=api.a2.summary.map(x=>[`${x.leadership_label} أ— ${x.function_label==='Land Administration'?'Land':x.function_label}`,pv(x.p_value),fmt(x.cramers_v),x.p_value==null?'Not computable':x.significant?'Yes':'No']);
 simpleTable(s,55,165,700,['Pair','p','V','Significant?'],selected,{rowH:43,weights:[2.2,1,1,1.2],bodySize:16});
 card(s,800,175,410,150,'Pattern','Eight tests are computable; seven are significant. Effects remain weak or very weak.',C.green,C.greenLite,19);
 card(s,800,355,410,120,'Largest V','Chief أ— Land: V = 0.239. This is still classified as weak.',C.gold,C.goldLite,19);
 card(s,800,505,410,120,'Examiner answer','Why not correct for nine tests? The implemented module reports independent exploratory tests; multiplicity is a stated limitation for confirmatory claims.',C.blue,C.blueLite,16);
 note(s,'State the key values rather than reading every row. Chief أ— Land is the largest effect at .239. Headman أ— Healing is not significant. King أ— Healing is not computable. Mention the multiple-testing limitation if asked.',['Live A2 API snapshot captured 1 August 2026']);
}

// 26 â€” A3 method
{
 const s=base('A3 compares population distributions by recognition status','Analysis 3',26);
 flow(s,[['groupsize','positive numeric'],['formackn','0 or 1'],['Shapiroâ€“Wilk','assess both groups'],['Mannâ€“Whitney','non-normal branch']],65,190,1150,110);
 metric(s,120,375,260,'Total observations','1,557',C.green);metric(s,400,375,260,'Excluded','650',C.red);metric(s,680,375,260,'Final sample','907',C.gold);metric(s,960,375,220,'Test','Mannâ€“Whitney',C.blue);
 card(s,185,535,910,86,'Why not a t-test?','At least one recognition group failed or could not satisfy the Shapiroâ€“Wilk normality assessment.',C.gold,C.goldLite,18);
 note(s,'Explain the automatic selection logic. After removing invalid population and missing recognition values, the system tests normality in the two groups. Because normality is not satisfied, it selects the two-sided Mann-Whitney U test.',['Live A3 API snapshot','SciPy shapiro and mannwhitneyu documentation']);
}

// 27 â€” A3 descriptives
{
 const s=base('A3 reports the distribution before testing it','Analysis 3',27);
 screenshotWithLegend(s,shot['12-a3-descriptive-statistics.png'],{left:55,top:185,width:850,height:300},[
  {n:1,x:.08,y:.25,label:'Separate recognized and not-recognized rows'}, {n:2,x:.35,y:.45,label:'Mean and median reveal skew'},
  {n:3,x:.72,y:.45,label:'Maximum values are extreme'}, {n:4,x:.89,y:.45,label:'IQR describes the middle 50%'}
 ],'Real Analysis 3 descriptive statistics table');
 card(s,170,525,940,88,'Observed pattern','Recognized groups have a higher median (223,000 vs 112,200), while extreme values make both means much larger than the medians.',C.green,C.greenLite,18);
 note(s,'Use the mean-versus-median gap to explain skewness. The live recognized median is 223,000 and not-recognized median is 112,200. Extreme maxima exceed 91 million and 104 million, so a rank-based test is more defensible.',['Screenshot 12-a3-descriptive-statistics.png','Live A3 API snapshot']);
}

// 28 â€” A3 visuals
{
 const s=base('A3 uses two charts to show shape and spread','Analysis 3',28);
 addImage(s,shot['14-a3-box-plot.png'],55,175,560,385,'Real logarithmic population box plot');
 addImage(s,shot['15-a3-histogram.png'],665,175,560,385,'Real population distribution histogram');
 circle(s,90,210,'1',C.green,34);circle(s,700,210,'2',C.gold,34);
 addText(s,'1  Logarithmic box plot: compare center, spread and extreme range.',70,590,540,42,18,C.ink,true);
 addText(s,'2  Histogram: inspect the long right tail and group overlap.',650,590,560,42,18,C.ink,true);
 note(s,'Explain the logarithmic scale: it compresses very large population values so both distributions remain visible. The histogram confirms strong right skew and overlap, so the significant difference should not be described as complete separation.',['Screenshots 14-a3-box-plot.png and 15-a3-histogram.png','Live A3 API chart payload']);
}

// 29 â€” A3 result
{
 const s=base('A3 detects a significant difference with a small effect','Analysis 3',29);
 addImage(s,shot['16-a3-result.png'],55,170,720,430,'Real Analysis 3 statistical result');
 metric(s,825,180,180,'U statistic','97,855.5',C.green);metric(s,1020,180,180,'p-value','< 0.001',C.gold);
 metric(s,825,315,180,'Effect','0.120',C.blue);metric(s,1020,315,180,'Sample','907',C.green);
 card(s,825,450,375,150,'Defense conclusion','Recognized groups tend to have larger population ranks, but the rank-biserial effect is small. Association does not imply recognition was caused by population.',C.green,C.greenLite,17);
 note(s,'State the exact result: U=97,855.5, p=.000293, rank-biserial correlation=.120, small effect, N=907. The correct conclusion is a statistically significant distribution difference, not a causal statement.',['Screenshot 16-a3-result.png','Live A3 API snapshot']);
}

// 30 â€” A4 design
{
 const s=base('A4 repeats the population comparison for three functions','Analysis 4',30);
 const items=[['Land','func_land','N = 993'],['Security','func_sec','N = 993'],['Healing','kingheal','N = 252']];
 items.forEach((v,i)=>{const x=90+i*400;addShape(s,'roundRect',x,205,330,250,i===1?C.goldLite:C.white,C.line,'rounded-xl','shadow-sm');circle(s,x+135,235,v[0][0],i===1?C.gold:C.green,60);addText(s,v[0],x+40,320,250,30,24,C.ink,true,'center');addText(s,'Population: present vs absent',x+35,370,260,28,17,C.muted,false,'center');addText(s,v[2],x+60,415,210,28,20,i===2?C.red:C.green,true,'center');});
 card(s,180,530,920,90,'Same disciplined pipeline','For each function: clean complete cases â†’ test normality â†’ select test â†’ report effect size and interpretation.',C.blue,C.blueLite,18);
 note(s,'Explain that A4 is three independent numeric-versus-binary comparisons. Land and security share the same missingness. Healing has far fewer valid rows because kingheal has 1,251 missing values before population missingness is combined.',['Live A4 API snapshot','docs/statistical-analysis-verification-report.md missingness table']);
}

// 31 â€” A4 screenshot/results
{
 const s=base('A4 shows significant differences can still be negligible','Analysis 4',31);
 addImage(s,shot['18-a4-function-result.png'],55,165,690,470,'Real Analysis 4 function-specific result and population plots');
 simpleTable(s,785,175,430,['Function','p','Effect','Decision'],[
  ['Land','.006','.088','Significant'],['Security','.003','.096','Significant'],['Healing','.882','.010','Not significant']
 ],{rowH:60,weights:[1.2,1,1,1.4],bodySize:16});
 card(s,785,445,430,150,'Interpretation','Land and security show statistically detectable population differences, yet their effect sizes are negligible. Healing shows no significant difference.',C.green,C.greenLite,18);
 circle(s,90,200,'1',C.green,34);circle(s,450,350,'2',C.gold,34);circle(s,680,570,'3',C.blue,34);
 note(s,'Use the real result panel to show that the page reports data preparation, test selection, effect size and charts for each function. Emphasize that statistical significance does not automatically mean practical importance.',['Screenshot 18-a4-function-result.png','Live A4 API snapshot']);
}

// 32 â€” A4 examiner
{
 const s=base('A4â€™s main lesson is practicalâ€”not just statistical','Analysis 4',32);
 circle(s,115,190,'1',C.green,62);addText(s,'Land',210,198,180,28,23,C.ink,true);addText(s,'p=.006, effect=.088, negligible',420,198,600,28,20,C.muted);
 circle(s,115,305,'2',C.gold,62);addText(s,'Security',210,313,180,28,23,C.ink,true);addText(s,'p=.003, effect=.096, negligible',420,313,600,28,20,C.muted);
 circle(s,115,420,'3',C.blue,62);addText(s,'Healing',210,428,180,28,23,C.ink,true);addText(s,'p=.882, effect=.010, negligible',420,428,600,28,20,C.muted);
 card(s,120,545,1040,82,'Examiner question: Why can a tiny effect be significant?','With hundreds of observations, a small systematic rank difference can produce a low p-value. Effect size communicates practical magnitude.',C.gold,C.goldLite,17);
 note(s,'Answer the likely question directly: sample size affects statistical power. Land and security have 993 observations, so small rank differences can be detected. Their negligible effect sizes prevent overstatement.',['Live A4 API snapshot']);
}

// 33 â€” A5 design
{
 const s=base('A5 treats leadership as overlapping occurrences','Analysis 5',33);
 addText(s,'5 continents',120,190,300,32,26,C.green,true,'center');addText(s,'3 binary indicators',860,190,300,32,26,C.gold,true,'center');
 ['Africa','Americas','Asia','Europe','Oceania'].forEach((x,i)=>pill(s,70+i*230,260,200,x,i%2?C.goldLite:C.greenLite,C.ink));
 addShape(s,'chevron',555,335,170,68,C.gold,'none');
 ['King','Chief','Headman'].forEach((x,i)=>{circle(s,320+i*310,455,x[0],i===1?C.gold:C.green,62);addText(s,x,290+i*310,530,120,28,18,C.ink,true,'center');});
 card(s,250,560,780,86,'Critical limitation','One group can have more than one leadership indicator; 1,557 groups become 1,494 recorded leadership occurrences.',C.red,C.rose,16);
 note(s,'Explain the multi-label structure carefully. King, Chief and Headman are not a single mutually exclusive category. The Chi-Square table counts recorded leadership occurrences, so the test sample is 1,494 occurrences while the group dataset contains 1,557 rows.',['Live A5 API snapshot','docs/statistical-analysis-verification-report.md section 11']);
}

// 34 â€” A5 charts
{
 const s=base('A5 needs both raw counts and normalized composition','Analysis 5',34);
 addImage(s,shot['20-a5-grouped-chart.png'],55,175,560,390,'Real grouped continent leadership chart');
 addImage(s,shot['21-a5-stacked-chart.png'],665,175,560,390,'Real 100 percent stacked leadership chart');
 circle(s,95,210,'1',C.green,34);circle(s,705,210,'2',C.gold,34);
 addText(s,'1  Grouped bars answer: how many recorded occurrences?',70,590,540,34,18,C.ink,true);
 addText(s,'2  100% bars answer: what is each continentâ€™s composition?',650,590,560,34,18,C.ink,true);
 note(s,'Explain why normalization matters. Africa has many more records, so raw counts dominate. The 100 percent chart removes total-size differences and reveals composition within each continent.',['Screenshots 20-a5-grouped-chart.png and 21-a5-stacked-chart.png','Live A5 API chart payload']);
}

// 35 â€” A5 result
{
 const s=base('A5 finds geographic variation with a weak association','Analysis 5',35);
 addImage(s,shot['22-a5-result.png'],55,170,720,430,'Real Analysis 5 result card and observed/expected tables');
 metric(s,815,180,180,'د‡آ²','128.891',C.green);metric(s,1015,180,180,'df','8',C.gold);
 metric(s,815,315,180,'p-value','< 0.001',C.blue);metric(s,1015,315,180,'V','0.208',C.green);
 card(s,815,450,380,150,'Defense conclusion','Leadership occurrence distributions differ across continents, but the association is weak. Overlapping indicators limit a strict independence interpretation.',C.gold,C.goldLite,17);
 note(s,'State د‡آ²=128.891, df=8, p<.001, Cramerâ€™s V=.208, weak. Then state the limitation: a group can contribute more than one leadership occurrence. This is association, not a geographic cause.',['Screenshot 22-a5-result.png','Live A5 API snapshot']);
}

// 36 â€” A6 design
{
 const s=base('A6 compares recognition percentages across continents','Analysis 6',36);
 flow(s,[['continent','5 categories'],['formackn','recognized / not'],['5 أ— 2 table','counts'],['Chi-Square','association']],70,190,1140,110);
 metric(s,100,380,250,'Total rows','1,557',C.green);metric(s,390,380,250,'Missing removed','524',C.red);metric(s,680,380,250,'Final sample','1,033',C.gold);metric(s,970,380,210,'df','4',C.blue);
 card(s,170,535,940,90,'Why percentages?','Continents contain different numbers of valid observations. Percentages compare recognition composition fairly; Chi-Square still uses counts.',C.green,C.greenLite,18);
 note(s,'Explain the separation between inference and presentation. The contingency test uses observed counts, while the stacked chart and heatmap use percentages so continents with different sample sizes can be compared fairly.',['Live A6 API snapshot']);
}

// 37 â€” A6 visuals
{
 const s=base('A6 shows where recognition rates differ','Analysis 6',37);
 addImage(s,shot['24-a6-stacked-chart.png'],55,175,560,390,'Real 100 percent recognition chart by continent');
 addImage(s,shot['25-a6-heatmap.png'],665,175,560,390,'Real recognition percentage heatmap by continent');
 circle(s,95,210,'1',C.green,34);circle(s,705,210,'2',C.gold,34);
 addText(s,'1  Every bar totals 100%; green is recognized.',70,590,540,34,18,C.ink,true);
 addText(s,'2  Heatmap highlights Africa highest and Asia lowest.',650,590,560,34,18,C.ink,true);
 note(s,'Read the percentages: Africa has about 82.7 percent recognized among valid observations, while Asia has about 55.4 percent. The chart communicates composition; the heatmap makes ranking immediately visible.',['Screenshots 24-a6-stacked-chart.png and 25-a6-heatmap.png','Live A6 API snapshot']);
}

// 38 â€” A6 result
{
 const s=base('A6 finds recognition varies by continent, but weakly','Analysis 6',38);
 addImage(s,shot['26-a6-result.png'],55,170,720,430,'Real Analysis 6 result and frequency tables');
 metric(s,815,180,180,'د‡آ²','70.837',C.green);metric(s,1015,180,180,'df','4',C.gold);
 metric(s,815,315,180,'p-value','< 0.001',C.blue);metric(s,1015,315,180,'V','0.262',C.green);
 card(s,815,450,380,150,'Defense conclusion','Formal recognition distributions differ across continents. The association is weak and cannot establish that continent determines recognition.',C.green,C.greenLite,17);
 note(s,'State the current result: د‡آ²=70.837, df=4, p<.001, Cramerâ€™s V=.262, weak, N=1,033. Recognition differs geographically, but legal systems and history are possible confounders outside this dataset.',['Screenshot 26-a6-result.png','Live A6 API snapshot']);
}

// 39 â€” Missing data
{
 const s=base('Missing values change the sample for every question','Data quality and limitations',39);
 const cats=['groupsize','king','chief','headman','formackn','func_land','func_sec','kingheal'];
 const vals=[187,334,334,334,524,418,418,1251];
 s.charts.add('bar',{position:{left:60,top:175,width:760,height:390},categories:cats,series:[{name:'Missing records',values:vals,fill:C.green}],barOptions:{direction:'bar',grouping:'clustered',gapWidth:35},hasLegend:false,xAxis:{majorGridlines:{style:'solid',fill:C.line,width:1},textStyle:{fontSize:13,fill:C.muted}},yAxis:{textStyle:{fontSize:15,fill:C.ink}},dataLabels:{showValue:true,position:'outEnd',textStyle:{fontSize:14,fill:C.ink,bold:true}}});
 card(s,855,185,355,150,'Largest gap','kingheal is missing for 1,251 of 1,557 rows. This reduces Healing samples to 306 in A2 and 252 in A4.',C.red,C.rose,18);
 card(s,855,365,355,125,'Complete-case rule','Each test excludes only rows missing the variables needed for that specific question.',C.green,C.greenLite,18);
 card(s,855,520,355,95,'Defense wording','â€œThe sample size is analysis-specific, not a single fixed dataset size.â€‌',C.gold,C.goldLite,17);
 note(s,'Use the chart to explain why sample sizes differ. Missingness remains stored in MySQL; it is not converted to zero. The largest limitation is kingheal, which makes healing results less precise and sometimes non-computable.',['docs/statistical-analysis-verification-report.md section 4','Live A2 and A4 API snapshots']);
}

// 40 â€” Code path
{
 const s=base('The implementation keeps calculation on the server','Software implementation',40);
 codeBox(s,55,175,565,185,'Flask + database','@api.get("/statistical-analysis/\n  groupsize-recognition")\ndef groupsize_recognition_analysis():\n    rows = fetch_all(\n      "SELECT groupsize, formackn "\n      "FROM tradgov_groups")');
 codeBox(s,660,175,565,185,'Pandas + SciPy','valid = data.dropna()\nnormal = shapiro(group).pvalue >= .05\nresult = mannwhitneyu(\n  recognized, not_recognized,\n  alternative="two-sided")',C.gold);
 codeBox(s,55,400,565,190,'JSON contract','return jsonify(success=True, data={\n  "statistical_test": {...},\n  "descriptive_statistics": {...},\n  "charts": {...},\n  "interpretation": text\n})',C.blue);
 codeBox(s,660,400,565,190,'Frontend renderer','const data = await loadApiData(endpoint);\nrenderSummary(data);\nrenderResult(data);\nnew Chart(canvas, {\n  type: "bar", data, options\n});',C.green);
 note(s,'Explain the code path in four short steps. The query selects only required columns, Pandas prepares valid data, SciPy performs the test, Flask serializes the result, and JavaScript renders the supplied values. The snippets are shortened from the actual project.',['backend-flask/routes/api.py','js/script.js']);
}

// 41 â€” Modes
{
 const s=base('The same evidence remains usable across interface modes','Website behavior',41);
 addImage(s,shot['28-arabic-rtl.png'],55,175,360,310,'Real Arabic RTL Statistical Analysis page');
 addImage(s,shot['29-dark-mode.png'],460,175,360,310,'Real dark-mode Analysis 3 section');
 addImage(s,shot['30-mobile-responsive.png'],865,155,250,430,'Real narrow responsive Statistical Analysis page');
 pill(s,130,520,210,'Arabic + RTL',C.green,C.white);pill(s,535,520,210,'Dark mode',C.gold,C.ink);pill(s,885,610,210,'390 px mobile',C.blue,C.white);
 addText(s,'Language and theme change presentationâ€”not the API values or statistical method.',190,585,620,42,18,C.ink,true,'center');
 note(s,'Demonstrate that language, direction and theme are presentation preferences. They do not alter the API or the statistical result. The mobile screenshot confirms that the page remains readable at a narrow viewport.',['Screenshots 28-arabic-rtl.png, 29-dark-mode.png and 30-mobile-responsive.png captured 1 August 2026']);
}

// 42 â€” loading/error
{
 const s=base('Loading and failure states remain explicit and safe','Website behavior',42);
 addImage(s,shot['31-loading-state.png'],55,180,550,360,'Real loading state with delayed statistical endpoint');
 addImage(s,shot['32-safe-error-state.png'],675,180,550,360,'Real safe error state after simulated 503 response');
 circle(s,90,215,'1',C.green,34);circle(s,710,215,'2',C.red,34);
 addText(s,'1  Loading status is announced while data is pending.',70,570,530,38,18,C.ink,true);
 addText(s,'2  A provider failure shows a user-safe messageâ€”no credentials or stack trace.',650,570,570,50,18,C.ink,true);
 note(s,'Clarify that these screenshots were produced by delaying and rejecting the real endpoint in an isolated browser test. The application itself was not modified. The error message is safe and preserves the rest of the page.',['Screenshots 31-loading-state.png and 32-safe-error-state.png captured through isolated browser routing on 1 August 2026','docs/statistical-analysis-verification-report.md API safe-error contract']);
}

// 43 â€” one minute A1-A3
{
 const s=base('One-minute defense explanations: Analyses 1â€“3','Defense preparation',43,true);
 card(s,55,170,370,430,'Analysis 1','Three 2أ—2 Chi-Square tests compare King, Chief and Headman with formal recognition. N=1,033 per test. All are significant, but Cramerâ€™s V shows weak effects. I report association, not causation.',C.green,C.white,17);
 card(s,455,170,370,430,'Analysis 2','Nine Chi-Square tests link three leadership indicators to land, security and healing. Most are significant but weak. King أ— Healing is not computable because the valid data lack variation; healing is heavily missing.',C.gold,C.white,17);
 card(s,855,170,370,430,'Analysis 3','Population is numeric and recognition is binary. Normality failed, so Mannâ€“Whitney was selected. U=97,855.5, p<.001, effect=.120: recognized groups tend to rank larger, but the effect is small.',C.blue,C.white,17);
 note(s,'Practice each box as a short spoken answer. Use the sequence: question, variables, cleaning, test, key result, effect size, limitation. Do not read the slide word-for-word; use it as a memory structure.',['Live A1, A2 and A3 API snapshots']);
}

// 44 â€” one minute A4-A6 / mistakes
{
 const s=base('One-minute defense explanations: Analyses 4â€“6','Defense preparation',44,true);
 card(s,55,165,370,365,'Analysis 4','Three Mannâ€“Whitney tests compare population by land, security and healing. Land and security are significant but negligible; healing is non-significant. Missing healing data reduces N to 252.',C.green,C.white,17);
 card(s,455,165,370,365,'Analysis 5','A 5أ—3 Chi-Square table compares continent with leadership occurrences. د‡آ²=128.891, p<.001, V=.208. The association is weak, and leadership indicators overlap within groups.',C.gold,C.white,17);
 card(s,855,165,370,365,'Analysis 6','A 5أ—2 Chi-Square table compares continent with recognition. د‡آ²=70.837, p<.001, V=.262. Recognition varies geographically, but continent does not determine recognition.',C.blue,C.white,17);
 addText(s,'Avoid: causal language â€¢ ignoring missing data â€¢ reporting p without effect size â€¢ confusing non-significant with not computable',90,570,1100,48,18,'#F0B7B2',true,'center');
 note(s,'Close the defense-preparation section by naming common mistakes. Examiners usually reward precise limitations: overlapping leadership indicators, analysis-specific missingness, skewed population, and no causal claims.',['Live A4, A5 and A6 API snapshots','docs/statistical-analysis-verification-report.md section 11']);
}

// 45 â€” source log / close
{
 const s=base('The module turns database records into cautious, reproducible evidence','Source log and final summary',45);
 addText(s,'Capture and verification log',70,175,500,34,26,C.green,true);
 simpleTable(s,70,225,650,['Item','Verified source'],[
  ['Frontend','http://127.0.0.1:5500/statistics-analysis.html'],
  ['Backend','http://127.0.0.1:3000/api/statistical-analysis/*'],
  ['Capture date','1 August 2026'],
  ['Database','Connected MySQL tradgov_groups'],
  ['Project sources','README.md, api.py, script.js, verification report'],
  ['Deployment note','Deployed statistical page/routes returned 404; local verified fallback used']
 ],{rowH:49,weights:[1,2.6],bodySize:16});
 addShape(s,'roundRect',780,205,410,340,C.green,C.green,'rounded-xl','shadow-sm');
 addText(s,'Defense formula',820,245,330,34,26,C.gold2,true,'center');
 const steps=['Question','Variables','Cleaning','Method','Evidence','Meaning','Limitation'];
 steps.forEach((x,i)=>{circle(s,820,305+i*34,String(i+1),i%2?C.gold:C.white,26,i%2?C.ink:C.green);addText(s,x,860,308+i*34,250,22,17,C.white,true);});
 addText(s,'Results are a database snapshot and may change when the connected data change.',760,580,450,42,17,C.red,true,'center');
 note(s,'End with the seven-part defense formula: research question, variables, cleaning, method, evidence, meaning and limitation. Mention that the screenshots and numbers are a verified database snapshot from 1 August 2026.',['All 32 authentic screenshots in tmp/stat-analysis-practical/screenshots','Local API snapshots a1.json through a6.json','README.md and docs/statistical-analysis-verification-report.md']);
}

// Export previews and PPTX.
for (const [index, slide] of deck.slides.items.entries()) {
  const name = `slide-${String(index + 1).padStart(2, '0')}.png`;
  const png = await deck.export({ slide, format: 'png', scale: 1 });
  await fs.writeFile(path.join(RENDERS, name), new Uint8Array(await png.arrayBuffer()));
}
const montage = await deck.export({ format: 'webp', montage: true, scale: 0.3 });
await fs.writeFile(path.join(HERE, 'deck-montage.webp'), new Uint8Array(await montage.arrayBuffer()));
const proto = deck.toProto();
const bad=[];
function scan(v,p='root') { if(!v||typeof v!=='object') return; if(v.bbox&&(Number(v.bbox.widthEmu)<0||Number(v.bbox.heightEmu)<0)) bad.push({p,bbox:v.bbox}); for(const [k,x] of Object.entries(v)){if(k==='bbox')continue;if(Array.isArray(x))x.forEach((z,i)=>scan(z,`${p}.${k}[${i}]`));else scan(x,`${p}.${k}`);} }
scan(proto); if(bad.length) throw new Error(`Negative extents: ${JSON.stringify(bad.slice(0,5))}`);
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(OUT);
console.log(JSON.stringify({ slides: deck.slides.items.length, output: OUT, screenshots: Object.keys(shot).length }));


