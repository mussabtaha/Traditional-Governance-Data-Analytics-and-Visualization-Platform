# Backend Presentation Build Report

## Deliverable summary

- Source deck: `Traditional_Government_Website_Development_Presentation.pptx`
- Updated editable deck: `Traditional_Government_Full_Stack_Development_Presentation.pptx`
- Original slide count: 22
- Frontend slides preserved before the backend section: 20
- Backend slides added: 16 (slides 21–36)
- Updated integration and final-result slides: 2 (slides 37–38)
- Final slide count: 38
- Output format: editable PowerPoint only; no PDF was created.

## Backend files inspected

- `backend-flask/app.py`
- `backend-flask/config.py`
- `backend-flask/requirements.txt`
- `backend-flask/.env.example`
- `backend-flask/database/__init__.py`
- `backend-flask/database/db.py`
- `backend-flask/routes/__init__.py`
- `backend-flask/routes/api.py`
- `backend-flask/migrations/001_add_group_name_ar.sql`
- `backend-flask/migrations/002_fix_confirmed_group_name_encoding.sql`
- `backend-flask/migrations/reviewed_arabic_group_names.sql`
- `backend-flask/scripts/encoding_diagnosis.py`
- `backend-flask/scripts/apply_encoding_repairs.py`
- `backend-flask/README.md`
- Frontend connection and rendering logic in `js/script.js`
- Related HTML pages and current presentation screenshots in `presentation_assets/`

Generated folders such as `.venv`, dependency caches, and `__pycache__` were excluded from the presentation structure slide.

## Confirmed implementation

### Flask entry point

- File: `backend-flask/app.py`
- Factory: `create_app()`
- Module application: `app = create_app()`
- Local startup: `app.run(host="0.0.0.0", port=app.config["PORT"], debug=False, use_reloader=False, threaded=True)`
- Default local API address: `http://localhost:3000/api`

### Backend dependencies

- Python
- Flask
- Flask-CORS
- mysql-connector-python
- python-dotenv
- MySQL
- JSON via Flask `jsonify`

No SQLAlchemy, authentication, login, user-account, admin-panel, or ORM behavior was presented because those features are not present in the inspected implementation.

### Routes found and verified

All routes are registered through a Flask Blueprint with the `/api` prefix.

1. `GET /api/health`
2. `GET /api/stats`
3. `GET /api/countries`
4. `GET /api/continents`
5. `GET /api/regions`
6. `GET /api/leadership`
7. `GET /api/largest-groups`
8. `GET /api/top-countries`
9. `GET /api/groups`
10. `GET /api/groups/<group_id>`

Live verification returned HTTP 200 and `success: true` for all ten endpoint patterns, using group id 1 for the detail route.

### Database technology and objects

- Library: `mysql.connector.pooling.MySQLConnectionPool`
- Database configured through `DB_NAME`; `.env.example` uses `tradgov_db`
- Pool name: `tradgov_pool`
- Pool size: 10
- Main table: `tradgov_groups`
- Views: `vw_country_summary`, `vw_continent_summary`, `vw_region_summary`, and `vw_leadership_summary`

Connections use dictionary cursors. `fetch_all()` and `fetch_one()` close the cursor and return the pooled connection in `finally` blocks. Decimal values are retained as strings for API compatibility, and byte values are decoded as UTF-8 before JSON serialization.

### Request parameters confirmed

The `/api/groups` route reads:

- `page` — positive integer, default 1
- `limit` — positive integer, default 20, maximum 100
- `search` — optional; searches `group_name`, `group_name_ar`, or `country`
- `continent` — optional exact match
- `region` — optional exact match
- `any_tpi` — optional and restricted to `0` or `1`

### Important SQL demonstrated

1. Paginated group count:
   `SELECT COUNT(*) AS total FROM tradgov_groups{where_clause}`
2. Paginated group records:
   `SELECT * FROM tradgov_groups{where_clause} ORDER BY id ASC LIMIT %s OFFSET %s`
3. Continent summary view:
   `SELECT * FROM vw_continent_summary ORDER BY total_groups DESC`
4. Overall statistics using `COUNT(DISTINCT ...)`, `COUNT(*)`, and `COALESCE(SUM(any_tpi = 1), 0)`
5. Top countries using `COUNT(*)`, `GROUP BY country`, `ORDER BY total_groups DESC`, and `LIMIT 10`
6. Group detail:
   `SELECT * FROM tradgov_groups WHERE id = %s LIMIT 1`

The presentation shows the real parameterized execution pattern:

`cursor.execute(query, tuple(parameters))`

It explains that values remain separate from SQL text, without claiming complete application security.

### JSON contract confirmed

The groups endpoint returns the existing structure:

```json
{
  "success": true,
  "data": {
    "groups": [],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total_items": 1557,
      "total_pages": 16
    }
  }
}
```

The values above match the live response at build time. The key names were verified directly from `routes/api.py` and the running API.

### Frontend request connection confirmed

- Base URL: `http://localhost:3000/api`
- Request helper: `loadApiData(endpoint)`
- Transport: `fetch()` with `Accept: application/json`
- JSON parsing: `await response.json()`
- Groups loader: requests `/groups?page=1&limit=100`, then loads remaining pages and normalizes the combined records.

Important accuracy note: the current Groups Explorer filters `state.groups` in the browser after all paginated records load. The backend independently supports optional `search`, `continent`, `region`, and `any_tpi` query parameters for direct API use or a future server-filtered interface. Slide 33 explicitly distinguishes these two real paths.

## Slides added

| Slide | Title | Main source |
|---:|---|---|
| 21 | Backend — Processing, Data, and APIs | `app.py`, `db.py`, project architecture |
| 22 | One backend supplies every data-driven page | Confirmed endpoint responsibilities |
| 23 | The project uses a compact, verified backend stack | `requirements.txt`, imports |
| 24 | The backend folder separates startup, routes, configuration, and data access | Actual `backend-flask/` tree |
| 25 | The application factory assembles the Flask server | `app.py:create_app()` |
| 26 | The local server starts on the port the frontend already expects | `app.py` startup and `Config.PORT` |
| 27 | A Blueprint turns URL paths into Python functions | `/api/continents` route |
| 28 | The browser request lands on the matching Flask route | `js/script.js` and `/api/groups` |
| 29 | Query parameters become validated Python values | `request.args` and `_parse_positive_integer()` |
| 30 | A shared connection pool links Flask to MySQL safely | `config.py`, `database/db.py` |
| 31 | Optional filters build one real parameterized SQL query | `/api/groups`, `cursor.execute()` |
| 32 | Database rows become a predictable JSON response | `fetch_all()`, conversion, `jsonify()` |
| 33 | The live explorer filters locally after paginated API loading | `loadGroups()`, `applyExplorerFilters()` |
| 34 | Aggregate SQL powers the statistics dashboard | `/api/stats`, `/api/top-countries` |
| 35 | Validation and error handlers keep failures understandable | 400, 404, 500, and 503 paths |
| 36 | One page load completes the full request–response cycle | Full groups-page workflow |

Slides 37 and 38 update the integration and final-result story to include Flask, MySQL, the JSON API, search/filtering, visualisations, and the bilingual interface.

## Code snippets displayed

All displayed code is editable PowerPoint text and is limited to verified lines from:

- `backend-flask/app.py`
- `backend-flask/routes/api.py`
- `backend-flask/database/db.py`
- `js/script.js`

Large functions, dependency code, and generated files were not copied into the deck.

## Sensitive-value handling

- No real `.env` file was opened or copied into the presentation.
- No real database password, token, secret key, or private hostname appears in the deck.
- The only password label displayed is `DB_PASSWORD = [REDACTED]`.
- The deck lists environment-variable names, not their private values.

## Visual and structural preservation

- Slides 1–20 preserve the existing frontend development sequence, screenshots, design system, and speaker notes.
- The backend section uses the same 1280×720 canvas, forest green, warm white, gold accents, Georgia/Aptos/Consolas typography, rounded cards, code panels, spacing, and footer treatment.
- Slides 37–38 retain the existing project screenshots while updating the integration and final-result claims.
- Code, labels, arrows, and diagrams remain editable native PowerPoint objects.

## Speaker notes and animations

- Speaker notes exist on all 38 slides.
- Every new backend slide contains beginner-friendly narration and explicit click cues.
- Native PowerPoint animation and transition timing could not be authored reliably by the available presentation library.
- No unsupported animation is falsely claimed as embedded.
- Slides were built with stable, repeated object names for manual Fade/Appear/Wipe sequencing and Morph preparation.
- Exact manual instructions are in `BACKEND_ANIMATION_GUIDE.txt`.

## Quality control completed

1. Verified displayed endpoint names, request parameters, SQL fragments, database objects, JSON keys, and frontend request code against the source.
2. Ran `node --check` on the presentation build script successfully.
3. Generated and visually inspected rendered images for all 38 slides, including enlarged backend-section montages.
4. Corrected a final-slide label wrap found during visual inspection.
5. Ran the presentation slide test: `Test passed. No overflow detected.`
6. Confirmed the generated PPTX contains 38 slide XML parts and 38 speaker-note XML parts.
7. Called every live API endpoint pattern and confirmed HTTP 200 with `success: true`.
8. Saved representative live JSON responses and visual evidence in `backend_presentation_assets/`.

## Manual adjustments still required

- Apply the recommended PowerPoint animations and Morph transitions manually using `BACKEND_ANIMATION_GUIDE.txt`.
- Set every transition to **On Mouse Click**, with no automatic slide advance.
- Run one final slideshow check in Microsoft PowerPoint after applying animations, because the build environment cannot exercise PowerPoint’s native animation engine or Presenter View.

