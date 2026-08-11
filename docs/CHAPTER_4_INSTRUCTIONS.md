TASK: UPDATE THE EXISTING CHAPTER 4 POWERPOINT
RESULTS AND DISCUSSION — FINAL SYSTEM INTERFACES

Use the EXISTING Chapter 4 presentation as the base.

Do NOT rebuild the entire presentation from scratch.

Do NOT redesign the website.

Do NOT modify the database.

Do NOT change the statistical methodology.

Do NOT commit, push, or deploy.

The goal is to improve Chapter 4 so that it clearly presents ALL final website pages, explains what each page contains, what the user can do on it, and how the user benefits from it.

==================================================
1. IMPORTANT CHAPTER 4 EXPLANATION STYLE
==================================================

Chapter 4 is RESULTS AND DISCUSSION.

For the website-interface section, I do NOT want a technical implementation explanation.

For every website page, use this simple structure:

1. What is this page?
2. What does this page display?
3. What can the user do on this page?
4. What information or benefit does the user get from it?

DO NOT explain:

- HTML implementation;
- CSS implementation;
- JavaScript functions;
- Flask code;
- API implementation details;
- SQL queries;
- source-code structure;

unless a technical point is absolutely necessary to understand a result.

The interface explanation should describe the FINAL SYSTEM from the USER'S perspective.

Example:

Do NOT write:

"The Groups page uses JavaScript fetch requests and Flask APIs to retrieve MySQL records."

Instead write:

"The Groups page allows users to browse the traditional governance records in the dataset. Users can search and apply filters to narrow the displayed records and explore the information relevant to their research."

That is the style I want throughout the website-interface section.

==================================================
2. USE THE REAL WORKING WEBSITE
==================================================

Open the REAL current website in the browser.

Do not rely only on old screenshots.

Do not create mockups.

Do not recreate the interface manually.

Use real screenshots captured directly from the working website.

Before capturing any page:

- make sure the backend is running;
- make sure the frontend is running through HTTP;
- make sure database data loads;
- wait for charts/maps/results;
- make sure there is no "Failed to fetch";
- make sure there is no "Loading..." state;
- make sure there are no broken interface elements.

If the integrated browser is unavailable, use the existing working Playwright + headless Microsoft Edge method.

==================================================
3. INCLUDE ALL FINAL WEBSITE PAGES
==================================================

I want the Chapter 4 presentation to include and explain ALL major final website pages.

Inspect the current project first and verify the actual final pages.

At minimum include:

1. Home Page
2. Groups Page
3. Interactive Map Page
4. Statistics Page
5. Geographic Comparison Page
6. Statistical Analysis Page
7. About Page
8. Contact Page

If another important user-facing final page exists in the current project, include it too.

Do NOT invent pages that do not exist.

==================================================
4. HOME PAGE
==================================================

Add/review the Home Page section.

Use a REAL screenshot from the current website.

Explain simply:

- what the Home Page is;
- what main information it presents;
- what overview it gives about the platform;
- what important sections the user can see;
- how the user can use it to begin exploring the platform.

If the Home Page includes:

- summary indicators;
- dataset overview;
- map/geographic overview;
- navigation to other sections;

mention these only if they are actually present.

IMPORTANT:

The current presentation does not explain the Home Page enough.

Improve the explanation slightly, but keep it simple.

Do NOT turn it into multiple technical slides.

The goal is:

"This is the Home Page, this is what it shows, and this is how it helps the user."

==================================================
5. GROUPS PAGE
==================================================

Add/review the Groups Page section.

Use a real screenshot.

Explain:

- that the page presents traditional governance group records;
- what information about the groups is visible;
- how the user can search;
- how the user can use filters;
- how filtering changes the displayed records;
- how the user can inspect the relevant group information.

If useful, use TWO screenshots:

Screenshot A:
Normal Groups interface.

Screenshot B:
A real example after applying a filter/search.

Place them side by side if they remain readable.

The explanation should be simple:

"The user can browse the records and use filters to narrow the results according to the available criteria."

Do NOT explain the backend query or filtering code.

==================================================
6. INTERACTIVE MAP PAGE
==================================================

Add/review the Interactive Map section.

Use the real working map.

Explain:

- what the map represents;
- what geographic information is displayed;
- what happens when the user interacts with a country/region/marker;
- what information the user can learn from the geographic view.

Capture a useful real interaction if supported.

For example:

- default map;
- selected continent/country;
- displayed group count/details.

Do not explain how the map library was programmed.

Explain what the user sees and learns.

==================================================
7. STATISTICS PAGE
==================================================

Add/review the Statistics Page.

Use real screenshots after all charts have loaded.

Explain that this page provides a visual/descriptive summary of the dataset.

Explain the important visible sections actually present in the current website, such as:

- leadership distribution;
- leadership selection methods;
- formal recognition;
- governance functions;
- geographic distribution;
- population/group-size information;
- largest groups;
- top countries;

ONLY where these actually exist.

Do not explain Chart.js implementation.

Explain what information the charts communicate to the user.

==================================================
8. GEOGRAPHIC COMPARISON PAGE
==================================================

Add/review the Comparison Page.

The final comparison feature is GEOGRAPHIC.

Verify the current implementation.

The intended comparison levels are:

- Country
- Continent
- Region

Do NOT present Group vs Group comparison if it is no longer part of the final system.

Explain:

- the user first selects the geographic comparison type;
- the user selects Entity A;
- the user selects Entity B;
- the user starts the comparison;
- the page displays differences between the selected geographic entities.

Explain the comparison indicators that are actually present, such as:

- leadership;
- formal recognition;
- governance functions;
- population;

only if currently supported.

==================================================
9. SHOW COUNTRY, CONTINENT, AND REGION
==================================================

Provide visual evidence that the Comparison page supports:

Country comparison
Continent comparison
Region comparison

Do not make the screenshots too small.

You may use:

Option A:
One slide with 3 screenshots ONLY if all three remain readable.

OR:

Option B:
Two slides if that produces better readability.

The priority is readability.

Do not squeeze three full pages into tiny boxes.

==================================================
10. STATISTICAL ANALYSIS PAGE — INTERFACE
==================================================

Add/review the Statistical Analysis Page.

First explain the PAGE ITSELF from the user's perspective.

Before discussing individual statistical findings, explain:

- what the Statistical Analysis page is;
- what type of information it presents;
- where the research question appears;
- where the statistical method appears;
- where sample size appears;
- where the statistical result appears;
- where p-value appears;
- where effect size appears;
- where tables/charts appear;
- where the interpretation appears.

Keep this interface explanation simple.

The detailed statistical results can remain in the following Results/Discussion slides.

==================================================
11. FIX THE CURRENT SLIDE 14
==================================================

The current Statistical Analysis overview slide has a visual problem.

The screenshot currently shows too much of the page at once.

Because the entire long page was placed inside the slide, the interface became too small and difficult to read.

FIX THIS.

Do NOT use the entire long Statistical Analysis page squeezed into one small screenshot.

Recommended solution:

Use TWO large screenshots side by side.

LEFT SCREENSHOT:
The upper part of the Statistical Analysis page.

Show clearly:

- research question;
- statistical method;
- sample/summary cards;
- main result information.

RIGHT SCREENSHOT:
The next important analysis section.

Show clearly:

- result interpretation;
- observed/expected table;
- important chart/heatmap;
- or another useful result area.

Use the two most useful sections of the actual page.

If two screenshots still make the content too small, use ONE large screenshot instead.

READABILITY IS MORE IMPORTANT THAN SHOWING THE ENTIRE PAGE.

==================================================
12. GENERAL SCREENSHOT RULE
==================================================

Review ALL interface slides.

Do not include a screenshot simply to say that a screenshot exists.

Every screenshot must communicate something.

If a full-page screenshot is so small that the examiner cannot read or understand it, replace it with:

- a useful cropped section;
- two readable screenshots;
- or one large screenshot.

Do not overload slides.

A screenshot should help explain the page.

==================================================
13. ABOUT PAGE
==================================================

ADD the About Page if it is missing.

Open the real About page.

Capture a real screenshot.

Explain simply:

- what the About page is;
- what information it provides about the project/platform;
- what the user learns about the purpose and scope of the system.

Do NOT explain how the page was coded.

Example style:

"The About page provides background information about the Traditional Governance platform. It explains the purpose and scope of the project and helps users understand the role of the system."

Use the actual content of the current page when writing the final explanation.

==================================================
14. CONTACT PAGE
==================================================

ADD the Contact Page if it is missing.

Open the real Contact page.

Capture a real screenshot.

Explain:

- what the Contact page is for;
- what fields are available;
- what the user enters;
- how the user submits a message;
- what type of communication the page supports.

For example, if the current form contains:

- name;
- email;
- subject;
- message;

explain those fields.

IMPORTANT:

Test/inspect the current implementation before claiming where the message goes.

If the form REALLY sends the message to an email address, you may state that.

If it does NOT actually send email and is only a frontend/interface feature, do NOT falsely claim that the message reaches an email inbox.

Describe only the functionality that actually exists.

==================================================
15. SIMPLE EXPLANATION RULE FOR EVERY PAGE
==================================================

For ALL website pages, the explanation should answer:

WHAT IS IT?
WHAT DOES IT SHOW?
WHAT CAN THE USER DO?
WHAT DOES THE USER LEARN OR GAIN?

Example:

Groups Page:

"This page displays the traditional governance group records available in the dataset. Users can search and apply filters to narrow the displayed records. This makes it easier to find and inspect groups relevant to a specific country, region, or research question."

That level of explanation is enough.

Do not over-explain internal implementation.

==================================================
16. USE CALLOUTS ONLY WHEN USEFUL
==================================================

For important screenshots, use simple numbered callouts.

For example:

1 — Search
2 — Filter
3 — Results
4 — Group Information

or:

1 — Research Question
2 — Statistical Method
3 — p-value
4 — Effect Size
5 — Interpretation

Do NOT place 10–15 annotations on one screenshot.

Keep visual explanation clean.

==================================================
17. KEEP THE EXISTING STATISTICAL RESULTS SECTION
==================================================

Do NOT remove the existing statistical findings and discussion.

After the simple Statistical Analysis interface explanation, keep the important analysis-result slides.

The statistical section should continue to explain:

- research question;
- statistical test;
- sample size;
- statistic;
- degrees of freedom where applicable;
- p-value;
- effect size;
- interpretation;
- important observed/expected tables;
- discussion.

This is where Chapter 4 becomes more analytical.

==================================================
18. OBSERVED VS EXPECTED
==================================================

Keep the explanation of Observed vs Expected Frequencies.

Explain:

Observed Frequencies:
Actual database counts.

Expected Frequencies:
Theoretical values calculated under the null hypothesis.

Expected frequencies may contain decimals.

For example:

387.48

does not mean that there is 0.48 of a real group.

It is a theoretical statistical expectation.

==================================================
19. EFFECT-SIZE CONSISTENCY
==================================================

Review the Cramer's V strength labels throughout the presentation.

Use ONE consistent interpretation scale.

The presentation currently uses approximately:

0.00–0.09 = Very weak
0.10–0.29 = Weak
0.30–0.49 = Moderate
0.50–0.69 = Strong
0.70–1.00 = Very strong

Therefore:

Headman × Formal Recognition
Cramer's V ≈ 0.070

should be labeled consistently as:

Very weak

if this is the scale used by the current project.

Check all slides for consistency.

==================================================
20. CONTINENT × LEADERSHIP EXPLANATION
==================================================

Do NOT automatically change the existing statistical calculation.

But make the explanation precise.

King, Chief, and Headman are separate binary indicators.

They are NOT necessarily mutually exclusive.

One traditional governance group may have more than one leadership indicator.

Therefore, if the analysis reports leadership occurrences, clearly explain that:

"Leadership occurrences are not the same as the number of unique groups because leadership indicators may overlap."

Add this to the slide or speaker notes where relevant.

==================================================
21. MISSING DATA
==================================================

Keep/improve the Missing Data slide.

Explain clearly that missing values are different from "No".

If verified by the current backend implementation, state:

"Missing values were not treated as 'No'. Inferential analyses used valid complete cases for the variables required by each test."

Verify this before adding it.

==================================================
22. RECOMMENDED WEBSITE INTERFACE SECTION ORDER
==================================================

The website interface part of Chapter 4 should follow a logical order:

4.1 Introduction

4.2 Final System Overview

4.3 Home Page

4.4 Groups Page

4.5 Interactive Map

4.6 Statistics Page

4.7 Geographic Comparison

4.8 Statistical Analysis Interface

4.9 About Page

4.10 Contact Page

Then continue with:

Statistical Results
Key Findings
Discussion
Limitations / Missing Data
System Result Summary
Chapter Summary

You may adjust numbering to fit the existing presentation, but maintain a clear logical flow.

==================================================
23. FIGURE CAPTIONS
==================================================

Every important website screenshot should have a clear academic caption.

Examples:

Figure 4.X: Home Page of the Traditional Governance Platform

Figure 4.X: Group Records and Filtering Interface

Figure 4.X: Interactive Geographic Map

Figure 4.X: Descriptive Statistics Dashboard

Figure 4.X: Geographic Comparison Interface

Figure 4.X: Statistical Analysis Interface

Figure 4.X: About Page

Figure 4.X: Contact Page

Renumber all figures sequentially after adding the missing pages.

Do not leave duplicate figure numbers.

==================================================
24. SPEAKER NOTES
==================================================

Add or improve speaker notes for all major interface slides.

Speaker notes should help me explain the slide during the graduation defense.

Use simple academic English, approximately B1-B2.

For every page, speaker notes should follow this pattern:

"This is the [Page Name]. It allows the user to..."

"This section shows..."

"The user can..."

"The benefit of this page is..."

Do not put programming details in the speaker notes unless necessary.

==================================================
25. VISUAL DESIGN
==================================================

Keep the existing professional visual identity.

Use:

- dark/deep green;
- gold accents;
- light neutral backgrounds;
- clean academic layouts.

Do NOT redesign the presentation unnecessarily.

Improve only what is needed.

Keep:

- 16:9 widescreen;
- readable text;
- large screenshots;
- consistent headings;
- consistent captions;
- clean spacing.

==================================================
26. FINAL VISUAL REVIEW
==================================================

After making the changes, inspect EVERY slide.

Verify specifically:

- Home Page is included and sufficiently explained.
- Groups Page is included and explained.
- Interactive Map is included and explained.
- Statistics Page is included and explained.
- Comparison Page is included and explained.
- Country comparison is demonstrated.
- Continent comparison is demonstrated.
- Region comparison is demonstrated.
- Statistical Analysis interface is included and explained.
- Current Slide 14 is fixed and readable.
- About Page is included.
- Contact Page is included.
- Statistical results remain intact.
- No screenshot is unnecessarily tiny.
- No screenshot is stretched.
- No text overflow exists.
- No Failed to fetch appears.
- No Loading state appears.
- Figure numbering is sequential.
- Speaker notes exist where needed.
- Statistical terminology is consistent.

==================================================
27. OUTPUT
==================================================

Use the existing Chapter 4 PowerPoint as the base.

Do NOT overwrite the original until the new version is verified.

Save the improved version as:

docs/Chapter_4_Results_and_Discussion_Updated.pptx

Also export:

docs/Chapter_4_Results_and_Discussion_Updated.pdf

if PDF export is available.

==================================================
28. FINAL REPORT
==================================================

At the end, report:

- original slide count;
- final slide count;
- slides added;
- slides modified;
- pages documented;
- screenshots added/replaced;
- how Slide 14 was fixed;
- whether Home explanation was improved;
- whether Groups was explained;
- whether Map was explained;
- whether Statistics was explained;
- whether Country/Continent/Region comparison was demonstrated;
- whether Statistical Analysis interface was improved;
- whether About was added;
- whether Contact was added;
- effect-size corrections made;
- figure numbering status;
- PPTX path;
- PDF path;
- any limitation discovered.

IMPORTANT FINAL RULE:

Chapter 4 should present the FINAL SYSTEM from the USER'S perspective.

For every page:

What is this page?
What does it show?
What can the user do?
What does the user gain from it?

Do NOT turn the website-interface section into a programming or implementation explanation.

Do NOT commit.
Do NOT push.
Do NOT deploy.