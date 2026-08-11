import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pptxgen = require("pptxgenjs");
const { imageSize } = require("image-size");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const SHOTS = path.join(DOCS, "chapter4-screenshots");
const API = path.join(os.tmpdir(), "chapter4-api");
const OUT = path.join(DOCS, "Chapter_4_Results_and_Discussion.pptx");
const LOGO = path.join(ROOT, "assets", "icons", "apple-touch-icon.png");

const readJson = name => JSON.parse(fs.readFileSync(path.join(API, `${name}.json`), "utf8")).data;
const data = {
  stats: readJson("stats"), statistics: readJson("statistics"),
  a1: readJson("analysis1"), a2: readJson("analysis2"), a3: readJson("analysis3"),
  a4: readJson("analysis4"), a5: readJson("analysis5"), a6: readJson("analysis6"),
  a7: readJson("analysis7"), a8: readJson("analysis8"), comparison: readJson("comparison")
};

const C = { green: "123524", deep: "0B2D20", gold: "C8A96A", cream: "F8F7F3", white: "FFFFFF", ink: "14251D", muted: "65736B", pale: "E9EFEA", line: "D7DED9", red: "A94E47", blue: "447B71", gray: "AEB8B2" };
const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Traditional Governance Data Analytics and Visualization Platform";
pptx.subject = "Chapter 4 — Results and Discussion";
pptx.title = "Chapter 4 — Results and Discussion";
pptx.company = "University Graduation Project";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Georgia",
  bodyFontFace: "Aptos",
  lang: "en-US"
};
pptx.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.cream },
  objects: [
    { rect: { x: 0, y: 0, w: 13.333, h: 0.12, fill: { color: C.green }, line: { color: C.green } } },
    { rect: { x: 0, y: 7.28, w: 13.333, h: 0.22, fill: { color: C.green }, line: { color: C.green } } }
  ],
  slideNumber: { x: 12.55, y: 7.29, w: 0.4, h: 0.12, color: C.white, fontFace: "Aptos", fontSize: 8, align: "right" }
});

const fmt = n => Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 });
const pFmt = p => p == null ? "Not available" : p < 0.001 ? "< .001" : `= ${Number(p).toFixed(3)}`;
const short = (s, n=85) => s.length > n ? `${s.slice(0,n-1)}…` : s;
let fig = 0;

function addHeader(slide, section, title, subtitle="") {
  slide.addText(section.toUpperCase(), { x: 0.55, y: 0.32, w: 4.0, h: 0.24, fontFace: "Aptos", fontSize: 9, bold: true, color: C.green, charSpacing: 1.2, margin: 0 });
  slide.addShape(pptx.ShapeType.line, { x: 0.55, y: 0.64, w: 0.45, h: 0, line: { color: C.gold, width: 1.5 } });
  slide.addText(title, { x: 0.55, y: 0.72, w: 12.1, h: 0.52, fontFace: "Georgia", fontSize: 25, bold: false, color: C.ink, margin: 0, breakLine: false, fit: "shrink" });
  if (subtitle) slide.addText(subtitle, { x: 0.57, y: 1.28, w: 11.9, h: 0.36, fontFace: "Aptos", fontSize: 11.5, color: C.muted, margin: 0, fit: "shrink" });
}

function addFooterLabel(slide, label="Chapter 4 • Results and Discussion") {
  slide.addText(label, { x: 0.55, y: 7.31, w: 6.8, h: 0.11, fontFace: "Aptos", fontSize: 7.5, color: "DDE7E0", margin: 0 });
}

function base(section, title, subtitle="", notes="") {
  const slide = pptx.addSlide("CONTENT");
  addHeader(slide, section, title, subtitle);
  addFooterLabel(slide);
  slide.addNotes(notes || `Explain that this slide reports the verified result for ${title}. Point to the visual evidence and avoid making causal claims.`);
  return slide;
}

function panel(slide, x,y,w,h, fill=C.white, line=C.line, radius=0.1) {
  slide.addShape(pptx.ShapeType.roundRect, { x,y,w,h, rectRadius: radius, fill:{color:fill}, line:{color:line,width:0.7}, shadow:{type:"outer",color:"AAB7AF",opacity:0.13,blur:1.5,angle:45,distance:1} });
}

function imageFit(file, x,y,w,h, mode="contain") {
  const dim = imageSize(file); const ir = dim.width/dim.height, br=w/h;
  if (mode === "cover") {
    if (ir > br) { const cw=dim.height*br; const sx=(dim.width-cw)/2; return {path:file,x,y,w,h,sizingCrop:{x:sx,y:0,w:cw,h:dim.height}}; }
    const ch=dim.width/br, sy=(dim.height-ch)/2; return {path:file,x,y,w,h,sizingCrop:{x:0,y:sy,w:dim.width,h:ch}};
  }
  if (ir > br) { const ih=w/ir; return {path:file,x,y:y+(h-ih)/2,w,h:ih}; }
  const iw=h*ir; return {path:file,x:x+(w-iw)/2,y,w:iw,h};
}

function addScreenshot(slide, name, x,y,w,h, caption, mode="contain", border=true) {
  const file=path.join(SHOTS,name); if(!fs.existsSync(file)) throw new Error(`Missing screenshot: ${file}`);
  if(border) panel(slide,x-0.04,y-0.04,w+0.08,h+0.08,C.white,C.line);
  slide.addImage(imageFit(file,x,y,w,h,mode));
  fig += 1;
  slide.addText(`Figure 4.${fig}: ${caption}`, { x, y:y+h+0.06, w, h:0.24, fontFace:"Aptos", fontSize:9, italic:true, color:C.muted, align:"center", margin:0, fit:"shrink" });
  return fig;
}

function callout(slide, n, x,y, text, tx,ty,tw=2.2) {
  slide.addShape(pptx.ShapeType.ellipse,{x,y,w:0.34,h:0.34,fill:{color:C.gold},line:{color:C.white,width:1.2}});
  slide.addText(String(n),{x:x+0.01,y:y+0.03,w:0.32,h:0.17,fontFace:"Aptos",fontSize:10,bold:true,color:C.deep,align:"center",margin:0});
  slide.addShape(pptx.ShapeType.line,{x:x+0.17,y:y+0.34,w:tx-x-0.17,h:ty-y-0.34,line:{color:C.gold,width:1,dash:"dash"}});
  slide.addText(text,{x:tx,y:ty,w:tw,h:0.35,fontFace:"Aptos",fontSize:9.5,bold:true,color:C.ink,margin:0,fit:"shrink"});
}

function metric(slide,x,y,w,label,value,accent=C.green) {
  panel(slide,x,y,w,0.85,C.white,C.line);
  slide.addShape(pptx.ShapeType.rect,{x,y,w:0.06,h:0.85,fill:{color:accent},line:{color:accent}});
  slide.addText(label.toUpperCase(),{x:x+0.18,y:y+0.13,w:w-0.3,h:0.16,fontFace:"Aptos",fontSize:7.8,bold:true,color:C.muted,charSpacing:0.7,margin:0,fit:"shrink"});
  slide.addText(String(value),{x:x+0.18,y:y+0.35,w:w-0.3,h:0.28,fontFace:"Georgia",fontSize:18,bold:true,color:C.ink,margin:0,fit:"shrink"});
}

function bullets(slide, items, x,y,w,h, opts={}) {
  const runs=[];
  items.forEach((t,i)=>runs.push({text:t,options:{bullet:{indent:14},breakLine:i<items.length-1,hanging:3}}));
  slide.addText(runs,{x,y,w,h,fontFace:"Aptos",fontSize:opts.fontSize||14,color:opts.color||C.ink,breakLine:true,paraSpaceAfterPt:opts.space||10,margin:2,fit:"shrink",valign:"mid"});
}

function table(slide, rows, x,y,w,h, widths, fontSize=9.2) {
  slide.addTable(rows,{x,y,w,h,colW:widths,border:{type:"solid",color:C.line,pt:0.7},fill:C.white,color:C.ink,fontFace:"Aptos",fontSize,margin:0.06,autoFit:false,breakLine:false,rowH:0.3,
    bold:false, valign:"mid",
    fillHeader:C.green,
    colorHeader:C.white,
    boldHeader:true
  });
}

function statStrip(slide, items, y=5.98) {
  const gap=0.12, x=0.6, totalW=12.13, w=(totalW-gap*(items.length-1))/items.length;
  items.forEach((m,i)=>metric(slide,x+i*(w+gap),y,w,m[0],m[1],m[2]||C.green));
}

function addOutcome(slide, text, x=0.7,y=6.55,w=11.9, tone="green") {
  const fill=tone==="gold"?"F6EEDC":"E7F2EB", line=tone==="gold"?C.gold:"5B9B78";
  slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h:0.48,fill:{color:fill},line:{color:line,width:0.8}});
  slide.addText(text,{x:x+0.17,y:y+0.11,w:w-0.34,h:0.22,fontFace:"Aptos",fontSize:10.5,bold:true,color:C.ink,margin:0,fit:"shrink"});
}

// 1 — Title
{
  const s=pptx.addSlide(); s.background={color:C.deep};
  s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:7.5,fill:{color:C.deep},line:{color:C.deep}});
  s.addShape(pptx.ShapeType.arc,{x:9.0,y:0.0,w:4.0,h:4.0,adjustPoint:0.28,rotate:15,line:{color:C.gold,transparency:45,width:2},fill:{color:C.deep,transparency:100}});
  s.addShape(pptx.ShapeType.arc,{x:9.72,y:0.45,w:3.0,h:3.0,adjustPoint:0.28,rotate:15,line:{color:"6F937F",transparency:55,width:1.2},fill:{color:C.deep,transparency:100}});
  s.addImage({path:LOGO,x:0.72,y:0.62,w:0.72,h:0.72});
  s.addText("TRADITIONAL GOVERNANCE DATA ANALYTICS AND VISUALIZATION PLATFORM",{x:1.58,y:0.76,w:7.9,h:0.3,fontFace:"Aptos",fontSize:10,bold:true,color:C.gold,charSpacing:1.25,margin:0,fit:"shrink"});
  s.addText("Chapter 4",{x:0.72,y:2.05,w:5.1,h:0.65,fontFace:"Georgia",fontSize:38,color:C.white,bold:false,margin:0});
  s.addText("Results and Discussion",{x:0.72,y:2.72,w:8.8,h:0.72,fontFace:"Georgia",fontSize:40,bold:true,color:C.white,margin:0,fit:"shrink"});
  s.addShape(pptx.ShapeType.line,{x:0.74,y:3.65,w:1.15,h:0,line:{color:C.gold,width:3}});
  s.addText("Verified implementation outcomes, live-data visualizations, statistical findings, and academic interpretation.",{x:0.72,y:3.92,w:8.8,h:0.7,fontFace:"Aptos",fontSize:17,color:"DBE7DF",margin:0,breakLine:false,fit:"shrink"});
  s.addText("University Graduation Project  •  8 August 2026",{x:0.72,y:6.63,w:6.0,h:0.25,fontFace:"Aptos",fontSize:10.5,color:C.gold,margin:0});
  s.addNotes("Introduce Chapter 4 as the evidence chapter. Explain that every interface screenshot and every numerical result comes from the running project and the connected MySQL database. State that the discussion reports associations, not causal effects.");
}

// 2
{
  const s=base("4.1 • Introduction","What Chapter 4 demonstrates","From implementation to verified evidence.","Explain that this chapter answers two questions: did the system work as intended, and what patterns are visible in the current data? Mention that screenshots, API responses, and statistical outputs were checked together.");
  panel(s,0.65,1.82,3.85,3.95,C.white,C.line); panel(s,4.74,1.82,3.85,3.95,C.white,C.line); panel(s,8.83,1.82,3.85,3.95,C.white,C.line);
  [["01","SYSTEM RESULTS",["Functional pages and navigation","Live Flask–MySQL integration","Responsive bilingual interface"]],["02","DATA RESULTS",["1,557 groups across 130 countries","Descriptive geographic patterns","Filterable charts and comparisons"]],["03","ANALYTICAL RESULTS",["Inferential tests selected by variable type","Missing values excluded transparently","Effect sizes interpreted with p-values"]]].forEach((c,i)=>{
    const x=0.65+i*4.09; s.addText(c[0],{x:x+0.25,y:2.1,w:0.65,h:0.5,fontFace:"Georgia",fontSize:27,bold:true,color:C.gold,margin:0});
    s.addText(c[1],{x:x+0.25,y:2.78,w:3.3,h:0.26,fontFace:"Aptos",fontSize:10,bold:true,color:C.green,charSpacing:0.8,margin:0});
    bullets(s,c[2],x+0.25,3.25,3.25,1.75,{fontSize:13});
  });
  addOutcome(s,"Acceptance criterion: evidence was captured only after the live page finished loading and no fetch or console errors were present.",0.8,6.3,11.7,"gold");
}

// 3
{
  const s=base("4.2 • Final System Overview","The completed system turns records into evidence","A transparent path from relational data to an interactive research interface.","Walk from left to right. MySQL stores the dataset. Flask performs parameterized queries and statistical preparation. Pandas, NumPy, and SciPy calculate results. The REST API returns JSON. JavaScript and Chart.js render the final interface.");
  const nodes=[["MySQL","1,557 records"],["Flask","REST routes"],["Pandas","Preparation"],["SciPy","Tests"],["JSON","Structured results"],["Frontend","HTML • CSS • JS"],["Chart.js","Visual evidence"]];
  nodes.forEach((n,i)=>{const x=0.45+i*1.82; panel(s,x,2.25,1.48,1.15,i===0?"EAF1EC":C.white,i===3?C.gold:C.line); s.addText(n[0],{x:x+0.08,y:2.49,w:1.32,h:0.24,fontFace:"Georgia",fontSize:16,bold:true,color:C.green,align:"center",margin:0});s.addText(n[1],{x:x+0.08,y:2.83,w:1.32,h:0.18,fontFace:"Aptos",fontSize:9,color:C.muted,align:"center",margin:0,fit:"shrink"}); if(i<nodes.length-1)s.addShape(pptx.ShapeType.chevron,{x:x+1.52,y:2.58,w:0.28,h:0.42,fill:{color:C.gold},line:{color:C.gold}});});
  s.addShape(pptx.ShapeType.line,{x:1.2,y:4.02,w:10.9,h:0,line:{color:C.green,width:2}});
  [["Search & filters","SQL-side"],["Pagination","One page/request"],["Comparisons","Aggregated profiles"],["Statistics","Dynamic scope"],["Analysis","Inferential output"]].forEach((n,i)=>{const x=0.72+i*2.48;s.addShape(pptx.ShapeType.ellipse,{x,y:3.82,w:0.38,h:0.38,fill:{color:C.gold},line:{color:C.white,width:1}});s.addText(String(i+1),{x:x+0.02,y:3.89,w:0.34,h:0.13,fontSize:9,bold:true,align:"center",margin:0,color:C.deep});s.addText(n[0],{x:x-0.18,y:4.36,w:1.7,h:0.24,fontFace:"Aptos",fontSize:11,bold:true,color:C.ink,align:"center",margin:0});s.addText(n[1],{x:x-0.18,y:4.67,w:1.7,h:0.2,fontFace:"Aptos",fontSize:9,color:C.muted,align:"center",margin:0});});
  statStrip(s,[["Dataset rows",fmt(data.stats.total_groups)],["Countries",fmt(data.stats.total_countries)],["Continents",fmt(data.stats.total_continents)],["Regions",fmt(data.stats.total_regions)],["With TPI",fmt(data.stats.groups_with_tpi)]],5.65);
}

// 4
{
  const s=base("4.3 • Home Page","The home dashboard communicates scope immediately","Live counters, navigation, distribution map, and recently added groups.","Point out that the homepage is not a static mock-up. The totals and continent markers were read from the Flask API. Explain that the page gives a researcher an immediate understanding of dataset coverage.");
  addScreenshot(s,"02-home-overview.png",0.62,1.72,12.08,4.78,"Home Page of the Traditional Governance Platform","contain");
  callout(s,1,1.0,2.0,"Primary project purpose",0.65,1.38,2.2);
  callout(s,2,6.0,4.72,"Live summary metrics",5.0,6.62,2.1);
  callout(s,3,11.3,1.95,"Global preferences",10.45,1.37,2.0);
}

// 5
{
  const s=base("4.3 • Home Page","Homepage outcomes verified from the API","The dashboard summarizes the same database used by all analytical modules.","Read the figures aloud. Explain that the homepage totals match GET /api/stats and that the map markers match continent aggregation from the live database.");
  addScreenshot(s,"01-home-full.png",0.62,1.74,5.2,4.95,"Complete Home Dashboard","contain");
  const items=[["Traditional groups",data.stats.total_groups],["Countries",data.stats.total_countries],["With a TPI",data.stats.groups_with_tpi],["Formally recognized",data.stats.total_recognized]];
  items.forEach((m,i)=>metric(s,6.2+(i%2)*3.1,1.9+Math.floor(i/2)*1.12,2.85,m[0],fmt(m[1]),i===3?C.gold:C.green));
  panel(s,6.2,4.25,6.05,1.8,"EAF1EC","C6D8CD");
  s.addText("Interpretation",{x:6.48,y:4.52,w:2.0,h:0.28,fontFace:"Georgia",fontSize:17,bold:true,color:C.green,margin:0});
  bullets(s,["The system exposes broad geographic coverage.","Homepage counts are consistent with the analytical API.","Navigation directs users from summary evidence to record-level detail."],6.45,4.9,5.45,0.98,{fontSize:12});
}

// 6
{
  const s=base("4.4 • Groups Page","Server-side exploration of individual records","Search and filters return only the requested page of matching database rows.","Explain that this interface avoids downloading the whole dataset. Search, continent, region, country, leadership, recognition, sorting, and pagination are sent to Flask and executed in SQL.");
  addScreenshot(s,"05-groups-filter-results.png",0.6,1.78,8.0,4.85,"Group Records and Filtering Interface","contain");
  panel(s,8.92,1.9,3.75,4.5,C.white,C.line);
  s.addText("Verified interaction",{x:9.22,y:2.17,w:3.1,h:0.3,fontFace:"Georgia",fontSize:18,bold:true,color:C.green,margin:0});
  bullets(s,["Search term: Arab","Continent: Africa","6 matching live records","100-record page limit","URL state preserved for sharing"],9.18,2.7,3.05,2.35,{fontSize:13});
  addOutcome(s,"Result: responsive filtering with one API request for the active page—not a preload of all 1,557 records.",8.98,5.72,3.5,"gold");
}

// 7
{
  const s=base("4.4 • Groups Page","From filtered rows to a structured group profile","Detailed information is opened without leaving the explorer.","Use this slide to show the transition from discovery to inspection. The dialog organizes geographic, leadership, selection, governance-function, council, assembly, and recognition fields. Missing data is presented safely as Not Available.");
  addScreenshot(s,"06-group-detail.png",0.6,1.72,7.7,5.05,"Detailed Traditional Group Record","contain");
  panel(s,8.7,1.82,3.95,4.8,C.white,C.line);
  s.addText("Record interpretation",{x:9.02,y:2.12,w:3.3,h:0.3,fontFace:"Georgia",fontSize:18,bold:true,color:C.green,margin:0});
  bullets(s,["Binary values are rendered as Yes / No.","Nulls are rendered as Not Available.","English source names remain readable in RTL pages.","The same dialog is retained after pagination and filtering."],9.0,2.62,3.2,2.35,{fontSize:13});
  s.addText("What this proves",{x:9.02,y:5.2,w:2.3,h:0.22,fontFace:"Aptos",fontSize:10,bold:true,color:C.gold,charSpacing:0.7,margin:0});
  s.addText("The platform supports both overview analysis and auditable record-level inspection.",{x:9.02,y:5.56,w:3.05,h:0.65,fontFace:"Aptos",fontSize:12,bold:true,color:C.ink,margin:0,fit:"shrink"});
}

// 8
{
  const s=base("4.5 • Interactive Map","Geographic distribution is directly explorable","One live marker represents each backend continent category.","Explain that the map uses the current world-map asset and five live markers. The database uses one Americas category, so one marker represents North and South America together.");
  addScreenshot(s,"03-interactive-map-full.png",0.7,1.75,8.2,4.85,"Interactive Geographic Map","contain");
  panel(s,9.18,1.85,3.42,4.5,C.white,C.line);
  s.addText("Live marker totals",{x:9.48,y:2.15,w:2.8,h:0.3,fontFace:"Georgia",fontSize:18,bold:true,color:C.green,margin:0});
  [["Africa",726],["Asia",438],["Americas",302],["Europe",57],["Oceania",34]].forEach((m,i)=>{s.addShape(pptx.ShapeType.ellipse,{x:9.5,y:2.74+i*0.59,w:0.34,h:0.34,fill:{color:i===0?C.green:C.gold},line:{color:C.white,width:1}});s.addText(m[0],{x:9.98,y:2.72+i*0.59,w:1.55,h:0.22,fontFace:"Aptos",fontSize:11.5,bold:true,color:C.ink,margin:0});s.addText(fmt(m[1]),{x:11.55,y:2.72+i*0.59,w:0.55,h:0.22,fontFace:"Aptos",fontSize:11.5,bold:true,color:C.green,align:"right",margin:0});});
  addOutcome(s,"Marker totals sum to 1,557 groups.",9.45,5.85,2.85,"gold");
}

// 9
{
  const s=base("4.5 • Interactive Map","A marker click becomes a reproducible filter","The map transfers context through the URL and the Groups page applies it after data loads.","Describe the tested path: Africa marker, query parameter, continent filter, then 726 matching records. This verifies that the visualization is interactive rather than decorative.");
  addScreenshot(s,"07-map-africa-filter-result.png",0.65,1.75,8.2,4.9,"Map Marker Navigation to Africa-Filtered Records","contain");
  const steps=[["1","Select","Africa marker"],["2","Navigate","?continent=Africa"],["3","Load","First filtered page"],["4","Verify","726 records"]];
  steps.forEach((v,i)=>{const y=1.95+i*1.02;panel(s,9.15,y,3.4,0.78,i===3?"E7F2EB":C.white,i===3?"5B9B78":C.line);s.addText(v[0],{x:9.34,y:y+0.2,w:0.35,h:0.26,fontFace:"Georgia",fontSize:18,bold:true,color:C.gold,margin:0});s.addText(v[1],{x:9.85,y:y+0.13,w:1.0,h:0.18,fontFace:"Aptos",fontSize:9,bold:true,color:C.green,margin:0});s.addText(v[2],{x:9.85,y:y+0.38,w:2.35,h:0.18,fontFace:"Aptos",fontSize:11.5,bold:i===3,color:C.ink,margin:0,fit:"shrink"});});
}

// 10
{
  const s=base("4.6 • Statistics Page","Descriptive statistics reveal the dataset structure","Seven charts update from one scoped statistics request.","Explain that the page combines summary totals with leadership, leadership selection, functions, recognition, geography, largest populations, and top-country views. The charts reuse their instances and update with new values.");
  addScreenshot(s,"09-statistics-overview.png",0.6,1.72,8.4,4.95,"Descriptive Statistics Dashboard","contain");
  panel(s,9.3,1.86,3.3,4.55,C.white,C.line);
  s.addText("All-data scope",{x:9.58,y:2.15,w:2.7,h:0.3,fontFace:"Georgia",fontSize:18,bold:true,color:C.green,margin:0});
  bullets(s,["Leadership types","Selection methods","Governance functions","Recognition status","Continent distribution","Largest groups","Top 10 countries"],9.55,2.62,2.65,2.95,{fontSize:12.5,space:7});
  addOutcome(s,"The dashboard reads aggregated values—not raw rows—reducing browser memory and network load.",9.48,5.65,2.75,"gold");
}

// 11
{
  const s=base("4.6 • Statistics Page","Geographic scope changes the entire dashboard","A single continent filter refreshes metrics and charts without rebuilding the interface.","Point to the current scope label and the Africa metrics. Explain that the backend applies one geographic filter and returns a complete statistics payload for the selected scope.");
  addScreenshot(s,"11-statistics-africa-filter.png",0.62,1.72,8.75,4.95,"Africa-Scoped Statistics Dashboard","contain");
  metric(s,9.72,1.95,2.55,"Groups","726",C.green); metric(s,9.72,3.0,2.55,"Countries","50",C.gold); metric(s,9.72,4.05,2.55,"With TPI","685",C.green); metric(s,9.72,5.1,2.55,"Recognized","445",C.gold);
  addOutcome(s,"The selected scope is visible, reproducible, and reflected in every chart title.",9.62,6.18,2.75,"green");
}

// 12
{
  const s=base("4.7 • Geographic Comparison","Africa and Asia compared from database aggregates","The comparison endpoint returns two complete, normalized geographic profiles.","Explain why comparison is useful: the same indicators are aligned side by side, avoiding manual cross-page reading. The selected entities here are Africa and Asia.");
  addScreenshot(s,"13-comparison-controls-profiles.png",0.62,1.72,8.65,4.95,"Geographic Comparison Interface","contain");
  const af=data.comparison.profiles.find(p=>p.name==="Africa"), as=data.comparison.profiles.find(p=>p.name==="Asia");
  panel(s,9.55,1.85,2.7,4.65,C.white,C.line);
  s.addText("Verified profile",{x:9.83,y:2.12,w:2.2,h:0.3,fontFace:"Georgia",fontSize:17,bold:true,color:C.green,margin:0});
  [["Groups",af.general.total_groups,as.general.total_groups],["Countries",af.general.total_countries,as.general.total_countries],["Recognized",af.recognition.recognized,as.recognition.recognized],["Kings",af.leadership.king,as.leadership.king],["Chiefs",af.leadership.chief,as.leadership.chief]].forEach((r,i)=>{const y=2.7+i*0.57;s.addText(r[0],{x:9.78,y,w:0.9,h:0.2,fontSize:9.5,color:C.muted,margin:0});s.addText(fmt(r[1]),{x:10.67,y,w:0.6,h:0.2,fontSize:11,bold:true,color:C.green,align:"right",margin:0});s.addText(fmt(r[2]),{x:11.38,y,w:0.6,h:0.2,fontSize:11,bold:true,color:C.gold,align:"right",margin:0});});
  s.addText("AFRICA",{x:10.51,y:5.65,w:0.8,h:0.18,fontSize:8,bold:true,color:C.green,align:"right",margin:0});s.addText("ASIA",{x:11.36,y:5.65,w:0.62,h:0.18,fontSize:8,bold:true,color:C.gold,align:"right",margin:0});
}

// 13
{
  const s=base("4.7 • Geographic Comparison","Aligned charts make differences visible","Leadership, recognition, governance functions, and normalized indicators share one visual grammar.","Explain that raw counts and normalized percentages answer different questions. Raw counts show scale; normalized values help compare profiles with different numbers of groups.");
  addScreenshot(s,"14-comparison-charts.png",0.7,1.72,8.5,4.98,"Comparison Charts for Africa and Asia","contain");
  panel(s,9.5,1.88,3.0,4.6,C.white,C.line);
  s.addText("How to read",{x:9.78,y:2.16,w:2.4,h:0.28,fontFace:"Georgia",fontSize:18,bold:true,color:C.green,margin:0});
  bullets(s,["Counts show absolute institutional presence.","Recognition bars separate recognized, non-recognized, and missing values.","Radar values are normalized to each entity's total groups.","Comparison describes patterns; it does not explain their historical causes."],9.75,2.68,2.35,2.95,{fontSize:12});
}

// 14
{
  const s=base("4.8 • Statistical Analysis Module","The module moves beyond description","Implemented analyses test relationships, differences, and effect sizes using complete cases.","Explain that descriptive charts show what is present, while inferential tests examine whether observed patterns are unlikely under a null model. Mention that the current project contains seven predefined analyses and one dynamic engine.");
  addScreenshot(s,"15-statistical-analysis-full.png",0.62,1.73,4.75,4.95,"Complete Statistical Analysis Interface","contain");
  panel(s,5.72,1.85,6.65,4.6,C.white,C.line);
  s.addText("Analytical pipeline",{x:6.05,y:2.14,w:3.0,h:0.32,fontFace:"Georgia",fontSize:19,bold:true,color:C.green,margin:0});
  [["1","Prepare","Exclude missing/invalid values"],["2","Select","Method follows variable types"],["3","Calculate","SciPy statistics and effect sizes"],["4","Visualize","Tables, charts, and heatmaps"],["5","Interpret","Association/difference—not causation"]].forEach((n,i)=>{const y=2.7+i*0.62;s.addShape(pptx.ShapeType.ellipse,{x:6.05,y,w:0.35,h:0.35,fill:{color:i===4?C.gold:C.green},line:{color:C.white,width:1}});s.addText(n[0],{x:6.07,y:y+0.07,w:0.31,h:0.12,fontSize:8.5,bold:true,color:C.white,align:"center",margin:0});s.addText(n[1],{x:6.55,y:y+0.01,w:1.05,h:0.18,fontSize:10,bold:true,color:C.green,margin:0});s.addText(n[2],{x:7.62,y:y+0.01,w:4.1,h:0.2,fontSize:11.2,color:C.ink,margin:0,fit:"shrink"});});
  addOutcome(s,"Every displayed value was compared with the current API response before presentation generation.",6.02,5.98,5.95,"gold");
}

// 15
{
  const s=base("4.8 • Statistical Analysis Module","How to read the inferential results","Statistical significance and practical strength answer different questions.","Use this slide before the individual analyses. A small p-value indicates evidence against independence or equal distributions. The effect size describes strength. Observed frequencies are real counts; expected frequencies are theoretical null-model values.");
  const cards=[["CHI-SQUARE","Compares observed and expected categorical counts.","χ² increases as the tables diverge."],["p-VALUE","Probability of an equal-or-more-extreme result under H₀.","p < .05 is treated as statistically significant."],["CRAMER'S V","Effect size for Chi-Square association.","Near 0 = weak; larger values = stronger."],["MANN–WHITNEY U","Compares ranked values between two groups.","Used when population distributions are non-normal."]];
  cards.forEach((c,i)=>{const x=0.62+(i%2)*6.18,y=1.82+Math.floor(i/2)*2.05;panel(s,x,y,5.85,1.72,C.white,C.line);s.addText(c[0],{x:x+0.26,y:y+0.24,w:2.1,h:0.22,fontSize:10,bold:true,color:C.gold,charSpacing:0.7,margin:0});s.addText(c[1],{x:x+0.26,y:y+0.62,w:5.25,h:0.35,fontFace:"Georgia",fontSize:15,bold:true,color:C.ink,margin:0,fit:"shrink"});s.addText(c[2],{x:x+0.26,y:y+1.14,w:5.25,h:0.3,fontSize:10.5,color:C.muted,margin:0,fit:"shrink"});});
  addOutcome(s,"A significant result does not prove causation. It reports an association or distributional difference in this observational dataset.",0.72,6.23,11.9,"green");
}

// 16
{
  const s=base("4.8 • Analysis 1","Leadership type × formal recognition","Research question: Is leadership type associated with formal state recognition?","Explain that King, Chief, and Headman were tested separately against binary formal recognition using Chi-Square. For the displayed King result, N is 1,033 after 524 rows with missing recognition were excluded.");
  addScreenshot(s,"16-analysis-1-leadership-recognition.png",0.55,1.68,7.35,4.82,"Leadership Type and Formal Recognition Result","contain");
  const rows=[["Leadership","χ²","df","p","V","Strength"],...data.a1.analyses.map(a=>[a.label,fmt(a.chi_square),String(a.degrees_of_freedom),pFmt(a.p_value),Number(a.cramers_v).toFixed(3),a.effect_strength])];
  table(s,rows,8.18,1.95,4.55,1.72,[1.15,0.72,0.42,0.72,0.58,0.96],9);
  panel(s,8.18,3.92,4.55,2.1,"EAF1EC","C6D8CD");
  s.addText("Interpretation",{x:8.48,y:4.2,w:2.0,h:0.25,fontFace:"Georgia",fontSize:17,bold:true,color:C.green,margin:0});
  s.addText("All three leadership indicators are associated with recognition. The King and Chief effects are weak; the Headman effect is very weak. These results do not show that a leadership title causes recognition.",{x:8.45,y:4.65,w:3.85,h:0.92,fontSize:12,color:C.ink,margin:0,fit:"shrink",breakLine:false});
}

// 17
{
  const s=base("4.8 • Analysis 2","Leadership type × governance functions","Nine Chi-Square tests examine Land, Security, and Healing responsibilities.","Explain that seven relationships were significant. King–Healing could not be estimated safely from the available complete table, and Headman–Healing was not significant. Most measurable effects were weak or very weak.");
  addScreenshot(s,"17-analysis-2-leadership-functions.png",0.55,1.7,6.25,4.85,"Leadership and Governance Functions Interface","contain");
  const rows=[["Relationship","χ²","p","V","N"],...data.a2.analyses.map(a=>[`${a.leadership_label}–${a.function_label.replace(" Administration","")}`,a.chi_square==null?"N/A":fmt(a.chi_square),a.p_value==null?"N/A":pFmt(a.p_value),a.cramers_v==null?"N/A":Number(a.cramers_v).toFixed(3),fmt(a.sample_size)])];
  table(s,rows,7.05,1.76,5.65,4.58,[2.25,0.75,0.78,0.7,0.78],8.1);
  addOutcome(s,"Strongest observed relationship: Chief × Land Administration, V = .239 (weak).",7.18,6.42,5.38,"gold");
}

// 18
{
  const s=base("4.8 • Analysis 3","Group population size × formal recognition","Non-normal population distributions required a Mann–Whitney U test.","Explain the method selection: Shapiro–Wilk indicated non-normality, so a rank-based test was used. The result is significant, but the rank-biserial effect is small. Recognized groups tend to have larger populations in rank terms.");
  addScreenshot(s,"19-analysis-3-result.png",0.55,1.68,7.25,4.88,"Population Size and Formal Recognition Result","contain");
  const t=data.a3.statistical_test;
  metric(s,8.1,1.86,2.1,"Test","Mann–Whitney U",C.green);metric(s,10.45,1.86,2.1,"Sample",fmt(t.sample_size),C.gold);
  metric(s,8.1,2.98,2.1,"U statistic",fmt(t.statistic),C.green);metric(s,10.45,2.98,2.1,"p-value",pFmt(t.p_value),C.gold);
  metric(s,8.1,4.1,2.1,"Effect",Number(t.effect_size.value).toFixed(3),C.green);metric(s,10.45,4.1,2.1,"Strength",t.effect_size.strength,C.gold);
  panel(s,8.1,5.25,4.45,1.1,"EAF1EC","C6D8CD");
  s.addText("Finding",{x:8.35,y:5.47,w:0.8,h:0.18,fontSize:9,bold:true,color:C.green,margin:0});s.addText("Significant difference; recognized groups tend to rank higher in population, but the effect is small.",{x:8.35,y:5.75,w:3.95,h:0.35,fontSize:11.2,bold:true,color:C.ink,margin:0,fit:"shrink"});
}

// 19
{
  const s=base("4.8 • Analysis 4","Group population size × governance functions","Three Mann–Whitney tests compare function-present and function-absent groups.","Explain that all three population/function distributions were non-normal. Land and Security differences were statistically significant, but both effects were negligible. Healing was not significant and had a much smaller sample because of missing values.");
  addScreenshot(s,"21-analysis-4-results.png",0.55,1.7,6.5,4.84,"Population Size and Governance Functions Results","contain");
  const rows=[["Function","U","p","Effect","N","Finding"],...data.a4.analyses.map(a=>{const t=a.statistical_test;return[a.function_label,fmt(t.statistic),pFmt(t.p_value),Number(t.effect_size.value).toFixed(3),fmt(t.sample_size),t.significant?"Significant":"Not significant"];})];
  table(s,rows,7.28,2.0,5.35,1.84,[1.2,0.9,0.85,0.7,0.7,1.0],8.8);
  panel(s,7.28,4.12,5.35,1.92,"F6EEDC","E0C88F");
  s.addText("Interpretation",{x:7.56,y:4.38,w:2.0,h:0.25,fontFace:"Georgia",fontSize:17,bold:true,color:C.green,margin:0});
  bullets(s,["Land and Security: significant, negligible effects.","Healing: no significant population-size difference.","Statistical significance should not be confused with a large practical difference."],7.53,4.77,4.65,0.95,{fontSize:11.2,space:6});
}

// 20
{
  const s=base("4.8 • Analysis 5","Continent × leadership distribution","Chi-Square tests whether leadership structures vary geographically.","Explain that leadership fields are separate binary indicators, so a group may contribute more than one leadership occurrence. The inferential sample of 1,494 therefore counts complete leadership occurrences, not unique groups.");
  addScreenshot(s,"23-analysis-5-result.png",0.55,1.67,7.35,4.88,"Continental Leadership Distribution Result","contain");
  const t=data.a5.statistical_test;
  metric(s,8.2,1.86,2.1,"Chi-Square",fmt(t.chi_square),C.green);metric(s,10.52,1.86,2.1,"df",t.degrees_of_freedom,C.gold);
  metric(s,8.2,2.98,2.1,"p-value",pFmt(t.p_value),C.green);metric(s,10.52,2.98,2.1,"Cramer's V",Number(t.cramers_v).toFixed(3),C.gold);
  metric(s,8.2,4.1,2.1,"Occurrences",fmt(t.sample_size),C.green);metric(s,10.52,4.1,2.1,"Strength",t.effect_strength,C.gold);
  addOutcome(s,"Leadership structure differs by continent, but the association is weak; geography is not a causal explanation.",8.2,5.4,4.42,"green");
}

// 21
{
  const s=base("4.8 • Analysis 6","Continent × formal recognition","Recognition status differs significantly across continents.","Explain the complete-case table: N is 1,033 after missing recognition values are excluded. Africa has the highest complete-case recognition rate and Asia the lowest in the current data.");
  addScreenshot(s,"24-analysis-6-continent-recognition.png",0.55,1.7,7.0,4.82,"Recognition Distribution by Continent","contain");
  const t=data.a6.statistical_test;
  metric(s,7.85,1.82,2.18,"Chi-Square",fmt(t.chi_square),C.green);metric(s,10.28,1.82,2.18,"df",t.degrees_of_freedom,C.gold);
  metric(s,7.85,2.94,2.18,"p-value",pFmt(t.p_value),C.green);metric(s,10.28,2.94,2.18,"Cramer's V",Number(t.cramers_v).toFixed(3),C.gold);
  metric(s,7.85,4.06,2.18,"Sample",fmt(t.sample_size),C.green);metric(s,10.28,4.06,2.18,"Strength",t.effect_strength,C.gold);
  panel(s,7.85,5.25,4.62,1.12,"F6EEDC","E0C88F");
  s.addText(`Rates among complete cases: Africa ${data.a6.summary.highest_recognition_rate.recognition_percentage.toFixed(1)}% • Asia ${data.a6.summary.lowest_recognition_rate.recognition_percentage.toFixed(1)}%`,{x:8.12,y:5.52,w:4.06,h:0.38,fontSize:12,bold:true,color:C.ink,margin:0,fit:"shrink",align:"center"});
}

// 22
{
  const s=base("4.8 • Analysis 6","Observed counts versus expected frequencies","Expected values are calculated under the null hypothesis of independence.","Point to both tables. Observed values are actual database counts and therefore whole numbers. Expected values are theoretical values distributed according to the row and column totals, so decimals are mathematically correct and do not represent fractional groups.");
  addScreenshot(s,"25-analysis-6-observed-expected.png",0.58,1.67,8.45,4.95,"Observed and Expected Continent-Recognition Frequencies","contain");
  panel(s,9.32,1.84,3.25,2.0,"EAF1EC","C6D8CD");
  s.addText("OBSERVED",{x:9.62,y:2.13,w:1.2,h:0.18,fontSize:9,bold:true,color:C.green,charSpacing:0.7,margin:0});
  s.addText("Actual database counts",{x:9.62,y:2.48,w:2.4,h:0.3,fontFace:"Georgia",fontSize:17,bold:true,color:C.ink,margin:0});
  s.addText("Whole numbers only",{x:9.62,y:3.05,w:2.25,h:0.22,fontSize:11.5,color:C.muted,margin:0});
  panel(s,9.32,4.08,3.25,2.0,"F6EEDC","E0C88F");
  s.addText("EXPECTED",{x:9.62,y:4.37,w:1.2,h:0.18,fontSize:9,bold:true,color:C.gold,charSpacing:0.7,margin:0});
  s.addText("Theoretical null-model values",{x:9.62,y:4.72,w:2.42,h:0.42,fontFace:"Georgia",fontSize:16,bold:true,color:C.ink,margin:0,fit:"shrink"});
  s.addText("Decimals are correct; they are not fractional real groups.",{x:9.62,y:5.34,w:2.38,h:0.4,fontSize:11.5,color:C.muted,margin:0,fit:"shrink"});
}

// 23
{
  const s=base("4.8 • Analysis 7","Region × formal recognition","Regional variation has the largest geographic recognition effect in the module.","Explain that the seven-region table produced a significant moderate association. The highest complete-case rate is Middle East and North Africa, and the lowest is South Asia. Missing recognition is still displayed descriptively even though the test uses complete binary cases.");
  addScreenshot(s,"27-analysis-7-result.png",0.55,1.68,7.35,4.9,"Regional Recognition Statistical Result","contain");
  const t=data.a7.statistical_test;
  metric(s,8.2,1.84,2.1,"Chi-Square",fmt(t.chi_square),C.green);metric(s,10.52,1.84,2.1,"df",t.degrees_of_freedom,C.gold);
  metric(s,8.2,2.96,2.1,"p-value",pFmt(t.p_value),C.green);metric(s,10.52,2.96,2.1,"Cramer's V",Number(t.cramers_v).toFixed(3),C.gold);
  metric(s,8.2,4.08,2.1,"Sample",fmt(t.sample_size),C.green);metric(s,10.52,4.08,2.1,"Strength",t.effect_strength,C.gold);
  panel(s,8.2,5.28,4.42,1.08,"EAF1EC","C6D8CD");
  s.addText(`Highest: ${short(data.a7.summary.highest_recognition_rate.region,26)} (${data.a7.summary.highest_recognition_rate.recognition_percentage.toFixed(1)}%)\nLowest: ${data.a7.summary.lowest_recognition_rate.region} (${data.a7.summary.lowest_recognition_rate.recognition_percentage.toFixed(1)}%)`,{x:8.46,y:5.49,w:3.9,h:0.5,fontSize:11,bold:true,color:C.ink,margin:0,fit:"shrink"});
}

// 24
{
  const s=base("4.8 • Dynamic Analysis Engine","Researchers can select compatible variable pairs","The engine automatically prepares complete cases and chooses the statistical method.","Explain that this is a capability demonstration, not an additional independent finding. For the verified sample, Continent and Formal Recognition reproduce Analysis 6 and therefore return the same Chi-Square values.");
  addScreenshot(s,"29-analysis-8-result.png",0.55,1.68,7.7,4.9,"Dynamic Continent × Formal Recognition Analysis","contain");
  const t=data.a8.statistical_test;
  panel(s,8.55,1.86,3.95,4.48,C.white,C.line);
  s.addText("Verified sample run",{x:8.88,y:2.16,w:3.2,h:0.3,fontFace:"Georgia",fontSize:19,bold:true,color:C.green,margin:0});
  bullets(s,["Variable X: Continent","Variable Y: Formal Recognition","Selected test: Chi-Square","N = 1,033; 524 excluded","χ²(4) = 70.837; p < .001","Cramer's V = .262 (weak)"],8.87,2.68,3.12,2.55,{fontSize:12.5,space:7});
  addOutcome(s,"The engine complements predefined analyses; it does not change their methodology.",8.77,5.62,3.5,"gold");
}

// 25
{
  const s=base("4.9 • Statistical Findings","Verified findings at a glance","Significance is reported together with effect size and the relevant complete-case sample.","Summarize the pattern: many associations are statistically significant, but most effects are weak, very weak, small, or negligible. The strongest effect in the predefined module is the moderate region-recognition association.");
  const rows=[
    ["Analysis","Test","Statistic","p","Effect","N","Conclusion"],
    ["King × Recognition","Chi-Square","74.664","< .001","V=.269 weak","1,033","Significant"],
    ["Chief × Land","Chi-Square","64.975","< .001","V=.239 weak","1,139","Significant"],
    ["Population × Recognition","Mann–Whitney","97,855.5","< .001","r=.120 small","907","Significant"],
    ["Population × Land","Mann–Whitney","110,623","=.006","r=.088 negligible","993","Significant"],
    ["Continent × Leadership","Chi-Square","128.891","< .001","V=.208 weak","1,494*","Significant"],
    ["Continent × Recognition","Chi-Square","70.837","< .001","V=.262 weak","1,033","Significant"],
    ["Region × Recognition","Chi-Square","93.836","< .001","V=.301 moderate","1,033","Significant"]
  ];
  table(s,rows,0.58,1.82,12.16,4.55,[2.2,1.35,1.1,0.78,1.45,0.8,1.25],8.7);
  s.addText("* Leadership indicators can overlap; N = 1,494 counts complete leadership occurrences, while the dataset contains 1,557 group rows.",{x:0.78,y:6.48,w:11.8,h:0.28,fontSize:9.3,italic:true,color:C.muted,margin:0,fit:"shrink"});
}

// 26
{
  const s=base("4.9 • Statistical Findings","Effect size prevents overstatement","A low p-value can coexist with a weak practical relationship.","Use the effect-size scale to explain why the chapter does not describe every significant result as strong. Large datasets can produce small p-values for modest differences. Region-recognition is moderate; most remaining relationships are weak or smaller.");
  s.addText("CRAMER'S V",{x:0.72,y:1.9,w:2.0,h:0.23,fontSize:10,bold:true,color:C.gold,charSpacing:0.9,margin:0});
  const effects=[{label:"Very weak",from:0,to:.1,color:"DDE5E0"},{label:"Weak",from:.1,to:.3,color:"AAC2B4"},{label:"Moderate",from:.3,to:.5,color:"6F9B82"},{label:"Strong",from:.5,to:.7,color:"397052"},{label:"Very strong",from:.7,to:1,color:C.green}];
  effects.forEach((e,i)=>{const x=0.75+i*2.38;s.addShape(pptx.ShapeType.rect,{x,y:2.38,w:2.22,h:0.56,fill:{color:e.color},line:{color:C.white,width:1}});s.addText(e.label,{x:x+0.08,y:2.56,w:2.05,h:0.18,fontSize:10,bold:true,color:i>2?C.white:C.ink,align:"center",margin:0});s.addText(`${e.from.toFixed(1)}–${e.to.toFixed(1)}`,{x:x+0.2,y:3.06,w:1.8,h:0.18,fontSize:9,color:C.muted,align:"center",margin:0});});
  const marks=[[.269,"King × recognition"],[.208,"Continent × leadership"],[.262,"Continent × recognition"],[.301,"Region × recognition"]];
  marks.forEach((m,i)=>{const x=0.75+m[0]*11.9;s.addShape(pptx.ShapeType.line,{x,y:3.52,w:0,h:0.55,line:{color:i===3?C.gold:C.deep,width:2.3}});s.addText(`${m[1]}\n${m[0].toFixed(3)}`,{x:Math.max(.7,Math.min(10.7,x-.85)),y:4.15+(i%2)*0.52,w:1.7,h:0.36,fontSize:8.5,bold:true,color:i===3?C.gold:C.ink,align:"center",margin:0,fit:"shrink"});});
  addOutcome(s,"The most defensible conclusion is that several variables are associated, but most measured relationships are modest.",0.78,6.15,11.75,"green");
}

// 27
{
  const s=base("4.10 • Discussion","What the combined results suggest","Patterns vary by leadership form, population distribution, continent, and region.","Discuss the results cautiously. Leadership institutions and governance responsibilities are related in several tests, but effect sizes are generally weak. Recognition varies geographically, with regional classification showing the strongest association. Population differences exist but are small in practical terms.");
  const themes=[["Leadership & recognition","All three indicators are significant; effects range from very weak to weak."],["Functions","Land and security show more consistent relationships than healing, which has extensive missingness."],["Population","Recognized and function-present groups often rank higher, but effects are small or negligible."],["Geography","Recognition varies across continents and regions; the regional effect is moderate."],["Interpretive boundary","The dataset is observational and cross-sectional. Historical mechanisms require separate research."]];
  themes.forEach((t,i)=>{const x=i<3?0.62+i*4.13:2.7+(i-3)*4.18,y=i<3?1.82:4.38,w=i<3?3.85:3.9;panel(s,x,y,w,1.85,i===4?"F6EEDC":C.white,i===4?"E0C88F":C.line);s.addText(String(i+1).padStart(2,"0"),{x:x+0.22,y:y+0.23,w:0.55,h:0.32,fontFace:"Georgia",fontSize:21,bold:true,color:C.gold,margin:0});s.addText(t[0],{x:x+0.9,y:y+0.25,w:w-1.15,h:0.26,fontSize:11,bold:true,color:C.green,margin:0,fit:"shrink"});s.addText(t[1],{x:x+0.25,y:y+0.83,w:w-0.5,h:0.66,fontSize:11.5,color:C.ink,margin:0,fit:"shrink"});});
}

// 28
{
  const s=base("4.10 • Discussion","Missing data shapes the strength of inference","Complete-case samples differ across analyses and must be reported explicitly.","Explain that missing values are not treated as No. They are excluded from inferential tests unless they form a separate descriptive category. Healing has the largest missingness, so conclusions about healing are the least stable.");
  const miss=[["Formal recognition",524,C.gold],["Leadership variables",334,C.green],["Land / Security",418,C.blue],["Healing",1251,C.red],["Population",187,C.gray]];
  const max=1557;
  miss.forEach((m,i)=>{const y=1.95+i*0.8;s.addText(m[0],{x:0.75,y:y+0.05,w:1.8,h:0.2,fontSize:10.5,bold:true,color:C.ink,margin:0});s.addShape(pptx.ShapeType.rect,{x:2.7,y,w:7.5,h:0.35,fill:{color:"E6E9E7"},line:{color:"E6E9E7"}});s.addShape(pptx.ShapeType.rect,{x:2.7,y,w:7.5*m[1]/max,h:0.35,fill:{color:m[2]},line:{color:m[2]}});s.addText(`${fmt(m[1])} missing`,{x:10.42,y:y+0.05,w:1.25,h:0.2,fontSize:10.5,bold:true,color:m[2],align:"right",margin:0});});
  panel(s,8.75,5.98,3.7,0.72,"F6EEDC","E0C88F");
  s.addText("Key limitation: healing analyses use much smaller complete-case samples and should be interpreted cautiously.",{x:8.98,y:6.16,w:3.25,h:0.31,fontSize:10.5,bold:true,color:C.ink,margin:0,fit:"shrink"});
}

// 29
{
  const s=base("4.10 • Discussion","The interface supports bilingual and dark-mode use","Presentation preferences persist across the multi-page website.","Explain that Arabic changes document language and direction to RTL, while English source group names remain isolated for readability. Dark mode applies consistently to cards, tables, forms, charts, and navigation.");
  addScreenshot(s,"34-arabic-rtl-home.png",0.62,1.75,5.9,4.65,"Arabic Right-to-Left Interface","contain");
  addScreenshot(s,"35-dark-mode-statistics.png",6.82,1.75,5.9,4.65,"Dark-Mode Statistics Interface","contain");
  addOutcome(s,"Saved preferences remain active across page navigation and refresh.",3.2,6.64,6.9,"gold");
}

// 30
{
  const s=base("4.11 • System Result Summary","The completed platform meets its research-interface goals","The same database supports discovery, visualization, comparison, and statistical testing.","Summarize the system result in six points. Emphasize integration: these are not isolated mock-ups. Each page consumes the Flask API and reflects the same MySQL source.");
  const items=[["EXPLORE","Search, filters, sorting, pagination, detail dialog"],["MAP","Five live continent totals and marker navigation"],["DESCRIBE","Scoped dashboard with seven dynamic charts"],["COMPARE","Country, continent, and region profiles"],["ANALYZE","Predefined tests plus a dynamic method selector"],["PRESENT","Responsive, bilingual, accessible, dark-mode interface"]];
  items.forEach((it,i)=>{const x=0.65+(i%3)*4.18,y=1.8+Math.floor(i/3)*2.2;panel(s,x,y,3.85,1.82,C.white,C.line);s.addText(String(i+1).padStart(2,"0"),{x:x+0.22,y:y+0.2,w:0.55,h:0.35,fontFace:"Georgia",fontSize:23,bold:true,color:C.gold,margin:0});s.addText(it[0],{x:x+0.94,y:y+0.23,w:2.5,h:0.2,fontSize:10,bold:true,color:C.green,charSpacing:0.8,margin:0});s.addText(it[1],{x:x+0.25,y:y+0.86,w:3.28,h:0.58,fontSize:12,bold:true,color:C.ink,margin:0,fit:"shrink"});});
  statStrip(s,[["Groups",fmt(data.stats.total_groups)],["Countries",fmt(data.stats.total_countries)],["Continents",fmt(data.stats.total_continents)],["Recognized",fmt(data.stats.total_recognized)],["API errors","0"]],6.22);
}

// 31
{
  const s=base("4.12 • Chapter Summary","Chapter 4 established both technical and analytical outcomes","The platform is functional, evidence-based, and ready to support the final conclusions.","Close the chapter. State that the implementation was verified end to end and that the statistical evidence was interpreted with effect sizes, missing-value limitations, and non-causal language. Transition to Chapter 5, which should synthesize conclusions, recommendations, and future work.");
  panel(s,0.72,1.85,7.15,4.5,C.white,C.line);
  s.addText("Established in this chapter",{x:1.08,y:2.2,w:3.8,h:0.36,fontFace:"Georgia",fontSize:21,bold:true,color:C.green,margin:0});
  bullets(s,["The final frontend is connected to live Flask–MySQL services.","Search, filters, map navigation, statistics, and comparisons are operational.","Inferential outputs match the current API and preserve decimal expected frequencies.","Most significant relationships have weak, very weak, small, or negligible effects.","Geographic recognition differences are evident, with the regional result showing a moderate effect.","Findings describe association or difference—not causation."],1.05,2.85,6.4,2.75,{fontSize:13.2,space:8});
  panel(s,8.2,1.85,4.35,4.5,"EAF1EC","C6D8CD");
  s.addText("NEXT",{x:8.58,y:2.2,w:1.0,h:0.2,fontSize:10,bold:true,color:C.gold,charSpacing:1,margin:0});
  s.addText("Chapter 5",{x:8.58,y:2.62,w:3.2,h:0.48,fontFace:"Georgia",fontSize:27,bold:true,color:C.green,margin:0});
  s.addText("Conclusions, recommendations, and future development priorities.",{x:8.58,y:3.38,w:3.42,h:0.9,fontSize:16,bold:true,color:C.ink,margin:0,fit:"shrink"});
  s.addShape(pptx.ShapeType.rightArrow,{x:8.58,y:5.18,w:2.05,h:0.56,fill:{color:C.gold},line:{color:C.gold}});
}

await pptx.writeFile({ fileName: OUT, compression: true });
console.log(JSON.stringify({ output: OUT, slides: pptx._slides.length, figures: fig }, null, 2));
