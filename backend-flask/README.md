# Traditional Governance Flask API

This folder is a Flask replacement for the existing Express backend. It keeps
the same routes, response keys, MySQL schema, filters, pagination structure,
CORS origins, and port so the frontend does not need to change.

## Requirements

- Python 3.10 or newer
- MySQL with the existing `tradgov_db` database
- The existing `tradgov_groups` table and summary views

## Setup on Windows PowerShell

```powershell
cd backend-flask
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and replace the placeholder MySQL credentials. Do not commit the
real `.env` file or put the database password in source code.

## Run

Stop the Node.js backend first because both implementations use port 3000.
Then run:

```powershell
python app.py
```

The API will be available at `http://localhost:3000/api`.

## API routes

- `GET /api/health`
- `GET /api/stats`
- `GET /api/countries`
- `GET /api/continents`
- `GET /api/regions`
- `GET /api/leadership`
- `GET /api/largest-groups`
- `GET /api/top-countries`
- `GET /api/comparison/options`
- `GET /api/comparison`
- `GET /api/statistics`
- `GET /api/statistical-analysis/leadership-recognition`
- `GET /api/statistical-analysis/leadership-functions`
- `GET /api/statistical-analysis/groupsize-recognition`
- `GET /api/statistical-analysis/groupsize-functions`
- `GET /api/statistical-analysis/continent-leadership`
- `GET /api/statistical-analysis/continent-recognition`
- `GET /api/statistical-analysis/region-recognition`
- `GET /api/statistical-analysis/run`
- `GET /api/groups`
- `GET /api/groups/:id`
- `POST /api/contact`

The groups endpoint performs pagination, filtering, and sorting in MySQL. It
supports:

- `page` and `limit`
- `search`
- `country`, `continent`, and `region`
- `leadership` (`King`, `Chief`, or `Headman`)
- `recognition` (`0`, `1`, or `missing`)
- `any_tpi` (`0`, `1`, or `missing`)
- `sort` and `direction` (`asc` or `desc`)

`GET /api/comparison/options?type=country|continent|region` returns current,
non-empty geographic values for the matching selectors. `GET /api/comparison`
accepts `type`, `entity_a`, and `entity_b`; it requires two distinct entities of
the same type and returns two live aggregate profiles plus chart-ready datasets.
The endpoint uses a grouped aggregate query and two MySQL window queries for the
median population and largest group. Values are parameterized and SQL columns
come only from a server-side allowlist.

## Statistical analysis

`GET /api/statistical-analysis/leadership-recognition` uses current MySQL
counts and SciPy's Pearson Chi-Square Test of Independence to analyze `king`,
`chief`, and `headman` separately against `formackn`. Each result contains the
observed and expected 2 × 2 table, Chi-Square statistic, degrees of freedom,
p-value, Cramer's V, sample size, missing-value exclusions, interpretation, and
chart-ready values.

Rows with a missing `formackn` value are excluded. A row with a missing value
for the leadership variable under test is also excluded from that specific
table. The endpoint reports the exact exclusion counts and performs no
imputation, prediction, or database write.

`GET /api/statistical-analysis/leadership-functions` performs nine independent
tests by crossing `king`, `chief`, and `headman` with `func_land`, `func_sec`,
and `kingheal`. It returns the complete test results, a nine-row summary,
Cramer's V heatmap values, and function-present percentages for significant
relationships. Rows with `NULL` in either tested variable are excluded per
pair and reported explicitly. All nine observed tables come from one MySQL
aggregate query; SciPy calculates the statistical results.

`GET /api/statistical-analysis/groupsize-recognition` implements Analysis #3.
It compares `groupsize` between `formackn = 1` and `formackn = 0`. Pandas and
NumPy clean the two source fields and calculate descriptive summaries. SciPy
performs Shapiro-Wilk normality assessments and automatically selects either
Welch's independent samples t-test or the two-sided Mann-Whitney U test. The
response includes data-preparation counts, descriptive statistics, normality
results, test statistic, p-value, correlation effect size, chart-ready box-plot
and histogram data, and an interpretation. Missing or invalid values are
excluded; no imputation or database write is performed.

`GET /api/statistical-analysis/groupsize-functions` implements Analysis #4.
It reads `groupsize`, `func_land`, `func_sec`, and `kingheal` once and
performs three independent population comparisons. Missing values are excluded
per function. Pandas and NumPy calculate descriptive summaries; SciPy performs
Shapiro-Wilk normality assessments and automatically selects Welch's
independent samples t-test or Mann-Whitney U. The response contains the three
tests, effect sizes, sample and exclusion counts, interpretations, and
chart-ready box-plot and histogram values. No imputation or database write is
performed.

`GET /api/statistical-analysis/continent-leadership` implements Analysis #5.
It reads `continent`, `king`, `chief`, and `headman` once. Pandas excludes
missing or blank continents and aggregates group totals, leadership counts,
prevalence percentages, and normalized leadership shares for every continent.
SciPy performs the Chi-Square Test of Independence and calculates expected
frequencies, p-value, and Cramer's V.

The response includes data-preparation counts, per-continent descriptives,
observed and expected contingency tables, test statistics, Cramer's V,
summary-card values, grouped-bar data, 100% stacked-bar data, and an automatic
interpretation.

Because leadership fields are independent binary indicators, one group can
contribute multiple leadership occurrences. The response distinguishes the
Chi-Square occurrence sample from the final group sample. No imputation,
database write, or causal claim is made.

`GET /api/statistical-analysis/continent-recognition` implements Analysis #6.
It reads `continent` and `formackn` once. Pandas removes missing or blank
continents and missing or non-binary recognition values, then aggregates group
totals, recognized and not-recognized counts, and recognition percentages by
continent.

SciPy performs the Chi-Square Test of Independence and calculates expected
frequencies, p-value, and Cramer's V. The response contains data-preparation
counts, per-continent descriptives, observed and expected contingency tables,
test statistics, summary-card values, 100% stacked-bar data, heatmap data, and
an automatic interpretation.

Each valid group contributes exactly one recognition outcome. No imputation,
database write, or causal claim is made.


`GET /api/statistical-analysis/region-recognition` implements Analysis #7. It
reads `region` and `formackn` once. Pandas retains rows with a valid region for
regional descriptive statistics, then excludes missing or non-binary
recognition values from the inferential sample.

For each region, the response reports total groups, recognized groups,
not-recognized groups, missing recognition, and the recognition percentage
among valid outcomes. SciPy performs the Chi-Square Test of Independence and
returns the observed and expected tables, Chi-Square statistic, degrees of
freedom, p-value, Cramer's V, assumption warnings, sample size, and automatic
interpretation.

The response also contains total, highest, lowest, and weighted-average
summary values; three-part 100% stacked chart data; and recognition heatmap
data. Missing recognition remains visible descriptively but is never included
in the Chi-Square test. No imputation, database write, or causal claim is made.

### Dynamic Statistical Analysis Engine

`GET /api/statistical-analysis/run` implements Analysis #8. Required query
parameters are `variable_x` and `variable_y`. They must be different keys in
the strict registry in `statistical_engine.py`; only their mapped SQL columns
are selected.

Supported variables:

```text
king chief headman formackn func_land func_sec kingheal
kinginher kingelect kingapp continent region country groupsize
```

Automatic method selection:

- two categorical or binary variables: Chi-Square Test of Independence;
- numeric plus exactly two observed categories: Shapiro-Wilk followed by
  Welch's independent samples t-test or Mann-Whitney U;
- numeric plus more than two categories: Kruskal-Wallis;
- two numeric variables: Shapiro-Wilk followed by Pearson or Spearman
  correlation.

Example:

```http
GET /api/statistical-analysis/run?variable_x=groupsize&variable_y=continent
```

The response contains `analysis_type`, variable metadata, data-preparation
counts, normality results where applicable, descriptive statistics,
`statistical_test`, chart-ready datasets, the supported-variable catalog,
and a non-causal interpretation.

The engine uses complete-case analysis. Unknown variables, identical pairs,
missing required parameters, and unsupported query parameters return HTTP 400.
A pair with no complete observations returns safe JSON with HTTP 422. No
dynamic identifier bypasses the variable registry, no database write occurs,
and no result is interpreted as causal.

## Optional Arabic group names


Run `migrations/001_add_group_name_ar.sql` against `tradgov_db` before starting
this version of the API. The migration checks `information_schema` first, so it
is safe to execute repeatedly. It adds this nullable column without changing
the original name:

```sql
group_name_ar VARCHAR(255) NULL
```

Arabic group names are optional. When `group_name_ar` is `NULL` or empty, the
frontend displays the original `group_name` in both languages. English mode
always displays `group_name`.

Do not automatically translate or overwrite group names. Add translations only
after manual review. Use `migrations/reviewed_arabic_group_names.sql` as the
controlled update template; it deliberately contains no executable sample
translations.

The `/api/groups`, `/api/groups/:id`, and `/api/largest-groups` responses now
include both `group_name` and `group_name_ar`. Group search checks both name
columns while retaining the existing country search.
