# Presentation Build Report

## Deliverables

- `Traditional_Government_Website_Development_Presentation.pptx`
- `POWERPOINT_FINALIZATION_NOTES.txt`
- `presentation_assets/`
- `PRESENTATION_BUILD_REPORT.md`

## Result

The final deck contains 22 editable 16:9 slides. Its narrative follows the real
development path of the project:

1. Project purpose and technology stack
2. Blank browser to complete semantic HTML structure
3. CSS tokens, hero styling, responsive layout, and reusable components
4. JavaScript API loading, filtering, rendering, and shared state
5. Integrated final website and handoff to the live demonstration

Speaker notes are embedded on every slide. Slides intended for Morph are also
identified inside their speaker notes.

## Source Files Inspected

### Frontend pages

- `index.html`
- `groups.html`
- `statistics.html`
- `comparison.html`
- `about.html`
- `contact.html`

### Presentation layer

- `css/style.css`
- `css/home.css`

### Behaviour and preferences

- `js/script.js`
- `js/preferences.js`
- `js/i18n.js`

### Backend contract reviewed for the data-flow slides

- `backend-flask/app.py`
- `backend-flask/config.py`
- `backend-flask/database/db.py`
- `backend-flask/routes/api.py`
- `backend-flask/requirements.txt`
- `backend-flask/README.md`

### Project assets

- `assets/images/hero-village.png`
- `assets/images/world-map.svg`
- Bootstrap, Bootstrap Icons, and Chart.js vendor files

## Real Website Areas Captured

The `presentation_assets/` folder contains live browser captures made from the
running project at a consistent 1440 x 900 desktop viewport:

- `01_homepage_desktop.png`
- `02_homepage_full.png`
- `03_home_map_and_latest.png`
- `04_groups_explorer.png`
- `05_groups_filtered_africa.png`
- `06_group_detail_dialog.png`
- `07_statistics_charts.png`
- `08_statistics_largest.png`
- `09_comparison.png`
- `10_homepage_arabic.png`

The captures confirm real API-backed values, recognizable continent markers,
working filtering, the detail dialog, Chart.js output, comparison results, and
Arabic RTL rendering. Screenshots were used selectively; development diagrams,
code boxes, page structures, component examples, and flow diagrams remain
editable PowerPoint objects.

## Visual System Used

The deck follows the live project palette and typographic character:

- Dark forest green: `#071B12`, `#123524`
- Gold: `#C8A96A`
- Warm white: `#F8F7F3`
- Paper white: `#FFFEFA`
- Ink: `#1D2922`
- Muted text: `#69746D`

Headings use a restrained academic serif/sans-serif combination. Code examples
use Consolas with HTML, CSS, and JavaScript highlighting.

## Quality Assurance

- The live website was opened before the deck was built.
- Screenshots were visually checked before insertion.
- All 22 slides were rendered to PNG after generation.
- Every rendered slide was visually inspected at full size.
- The final PPTX passed the presentation overflow test: **no overflow detected**.
- The deck was re-rendered after final corrections to slide-number badges,
  technology labels, roadmap copy, and the API normalization node.
- The output contains 22 slides and speaker notes on every slide.

## Effects and Limitations

The presentation-generation library does not expose Microsoft PowerPoint's
Morph transition. Morph-ready slide sequences and shared object names were used
instead, and exact manual steps are documented in
`POWERPOINT_FINALIZATION_NOTES.txt`.

No student name, supervisor name, university name, or department name was found
in the reviewed project files. These details were intentionally not invented.

Live totals reflect the database state at capture time and may change when the
underlying MySQL data changes.
