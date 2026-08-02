# Statistical Analysis Integration Verification Report

**Project:** Traditional Governance Data Analytics and Visualization Platform
**Verification date:** 1 August 2026
**Scope:** Analyses #1 through #6
**Environment:** Local Flask application with the configured live MySQL database

## 1. Deployment-readiness decision

**Conditionally ready, but not fully cleared for deployment.**

The database, statistical service, API, JSON contracts, and static frontend integration passed. The remaining release gate is visual browser verification because the local browser-control runtime fails before connecting with a Windows `deny-read ACLs` error. Console inspection, screenshots, responsive viewport checks, Arabic RTL, and dark-mode rendering must be completed manually or after that environment issue is repaired.

No deployment, commit, push, or database schema change was performed.

## 2. Verified data flow

```text
tradgov_groups (MySQL)
  -> mysql-connector connection pool
  -> analysis-specific SQL query
  -> Pandas / NumPy preparation
  -> SciPy statistical test
  -> Flask /api/statistical-analysis/* endpoint
  -> JSON-safe response
  -> shared frontend JavaScript
  -> cards, tables, interpretations, and Chart.js charts
```

Statistics are calculated only in Python. The frontend renders API values and contains no SciPy-equivalent or manually entered statistical results.

## 3. Files changed during this verification pass

- `backend-flask/database/db.py`
  - Explicit `utf8mb4`, Unicode, and collation settings were added to the existing pool.
- `backend-flask/app.py`
  - Generic failures now log only the exception class so connector messages cannot leak credentials.
- `backend-flask/routes/api.py`
  - All six statistical endpoints reject unsupported parameters with HTTP 400.
  - Chi-Square responses now expose expected-frequency assumption warnings.
- `backend-flask/tests/test_database_layer.py`
  - Pool configuration, parameterized execution, and resource cleanup tests.
- `backend-flask/tests/test_statistical_api_integration.py`
  - Cross-endpoint invalid-parameter, safe-error, and assumption-warning tests.
- `README.md`
  - Reproducible statistical integration and verification guidance.
- `docs/statistical-analysis-verification-report.md`
  - This detailed verification report.

## 4. Database verification

| Check | Result |
|---|---|
| Configuration source | `backend-flask/.env` loaded by `python-dotenv` |
| Current database | `tradgov_db` |
| Required table | `tradgov_groups` exists |
| Total rows | 1,557 |
| Table columns | 22 |
| Required analysis columns | All 14 verified |
| Connection pool | Lazy shared `MySQLConnectionPool`, size 10 |
| Cursor cleanup | Verified by unit test |
| Connection return | Verified by unit test |
| Character set | Explicit `utf8mb4` |
| Schema changes | None |

Verified required columns:

`country`, `continent`, `region`, `groupsize`, `king`, `chief`,
`headman`, `formackn`, `func_land`, `func_sec`, `kingheal`,
`kinginher`, `kingelect`, and `kingapp`.

### Live missingness and validation

| Field | Missing | Invalid non-binary / invalid positive size |
|---|---:|---:|
| continent | 0 | — |
| groupsize | 187 | 0 |
| king | 334 | 0 |
| chief | 334 | 0 |
| headman | 334 | 0 |
| formackn | 524 | 0 |
| func_land | 418 | 0 |
| func_sec | 418 | 0 |
| kingheal | 1,251 | 0 |

Missing values remain in MySQL and are excluded only by each analysis-specific rule.

## 5. Data extraction and statistical service audit

| Analysis | SQL columns / query scope | Live final sample | Test |
|---|---|---:|---|
| #1 Leadership and recognition | One aggregate query over `king`, `chief`, `headman`, `formackn` | 1,033 per test | 3 Chi-Square tests |
| #2 Leadership and functions | One aggregate query over the three leadership and three function indicators | 306 or 1,139 | 9 Chi-Square tests |
| #3 Population and recognition | `SELECT groupsize, formackn FROM tradgov_groups` | 907 | Mann-Whitney U on live data |
| #4 Population and functions | `SELECT groupsize, func_land, func_sec, kingheal FROM tradgov_groups` | 993, 993, 252 | 3 automatically selected tests |
| #5 Continent and leadership | `SELECT continent, king, chief, headman FROM tradgov_groups` | 1,557 groups / 1,494 occurrences | Chi-Square |
| #6 Continent and recognition | `SELECT continent, formackn FROM tradgov_groups` | 1,033 | Chi-Square |

The aggregate SQL fragments are assembled only from fixed internal column dictionaries. No statistical endpoint accepts a filter value. Unsupported query parameters now return HTTP 400 rather than being ignored.

Pandas and NumPy perform coercion, valid-value selection, grouping, descriptive statistics, and chart-data preparation. SciPy performs Chi-Square, Mann-Whitney U, Welch's t-test, Shapiro-Wilk, correlations, and Cramer's V. Statsmodels is not used and is not declared.

## 6. Independent statistical cross-check

Analysis #1, King leadership versus formal recognition, was rebuilt independently from live MySQL.

### Direct MySQL observed table

| | Recognized | Not recognized |
|---|---:|---:|
| King present | 268 | 26 |
| King absent | 476 | 263 |

- Excluded rows: 524
- Final sample: 1,033

### Independent SciPy result

- Expected frequencies: `[[211.7483059051, 82.2516940949], [532.2516940949, 206.7483059051]]`
- Chi-Square: `74.6637210266`
- Degrees of freedom: `1`
- p-value: `5.58123805398e-18`
- Cramer's V: `0.2688466655`

Every value matched the live Flask endpoint within `1e-12` relative tolerance. Observed totals, expected totals, sample size, and excluded-row count also matched exactly.

## 7. API verification

All endpoints returned HTTP 200, `success: true`, and JSON with no `NaN` or `Infinity`:

- `/api/statistical-analysis/leadership-recognition`
- `/api/statistical-analysis/leadership-functions`
- `/api/statistical-analysis/groupsize-recognition`
- `/api/statistical-analysis/groupsize-functions`
- `/api/statistical-analysis/continent-leadership`
- `/api/statistical-analysis/continent-recognition`

Unsupported parameters return HTTP 400. Simulated database failure returns:

```json
{
  "success": false,
  "message": "An internal server error occurred."
}
```

Neither the response nor captured application log contains the simulated credential text.

### Statistical warning

`king_healing` in Analysis #2 has 306 valid rows but insufficient contingency-table variation. The API returns a non-computable result with an explicit warning rather than fabricating a p-value.

## 8. Frontend verification

Static integration checks passed:

- each statistical endpoint is referenced exactly once;
- all loading/error status elements are wired;
- every chart and table target ID exists;
- no `data/groups.json` dependency is used;
- no statistical formula is implemented in frontend JavaScript;
- all tables are inside responsive wrappers;
- Arabic translation entries exist for Analyses #1-#6;
- RTL and dark-mode styles exist;
- all seven HTML pages parse;
- all local `href` and `src` paths resolve;
- every JavaScript file passes `node --check`.

The page loads each analysis once. Analysis #1 selection changes only the already-loaded local result view, so no stale network request can occur. Other analysis sections have no interactive remote filter. Page reloads create fresh chart instances; no repeated in-page initialization path was found.

### Unresolved browser verification

Automated browser control failed before page access with:

```text
windows sandbox failed: helper_unknown_error: apply deny-read ACLs
```

Therefore these items remain a manual release gate:

- browser console has no runtime errors;
- cards, tables, and charts visually match the API;
- loading, failure, and empty states are visually correct;
- Arabic RTL rendering;
- dark-mode rendering;
- desktop, tablet, and mobile layouts;
- absence of horizontal page overflow.

## 9. Broader regression verification

The following live endpoints returned HTTP 200:

- `/api/health`
- `/api/stats`
- `/api/statistics`
- `/api/groups?page=1&limit=10`
- `/api/group-options`

The full Flask suite passed **46 tests with 0 failures**. Whole-site HTML asset checks and JavaScript syntax checks also passed.

## 10. Commands used

From `backend-flask`:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
.\.venv\Scripts\python.exe -m compileall -q .
.\.venv\Scripts\python.exe -m pip check
```

From the project root:

```powershell
node --check js/script.js
node --check js/i18n.js
git diff --check
```

Live endpoint examples:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3002/api/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3002/api/statistical-analysis/leadership-recognition
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3002/api/statistical-analysis/leadership-functions
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3002/api/statistical-analysis/groupsize-recognition
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3002/api/statistical-analysis/groupsize-functions
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3002/api/statistical-analysis/continent-leadership
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3002/api/statistical-analysis/continent-recognition
```

## 11. Limitations and warnings

- Association does not imply causation.
- Missing-value exclusions differ by analysis and variable pair.
- Population distributions are strongly skewed; non-parametric tests are selected where required.
- Leadership indicators are multi-label in Analysis #5, so its Chi-Square sample counts leadership occurrences separately from group rows.
- Some contingency tables may be non-computable or violate expected-frequency guidance; warnings are now returned explicitly.
- Live hosted MySQL response time was approximately 20-38 seconds for cold statistical requests during this audit.
- Browser visual verification is still required before deployment.

## 12. Final confirmation

All statistical values inspected in production code originate from live records in `tradgov_groups`. No hardcoded result, static JSON result, frontend statistical calculation, fabricated interpretation, schema mutation, commit, push, or deployment was introduced.
