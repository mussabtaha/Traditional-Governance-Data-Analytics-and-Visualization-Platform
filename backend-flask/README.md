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
- `GET /api/group-options`
- `GET /api/groups`
- `GET /api/groups/:id`

The groups endpoint performs pagination, filtering, and sorting in MySQL. It
supports:

- `page` and `limit`
- `search`
- `country`, `continent`, and `region`
- `leadership` (`King`, `Chief`, or `Headman`)
- `recognition` (`0`, `1`, or `missing`)
- `any_tpi` (`0`, `1`, or `missing`)
- `sort` and `direction` (`asc` or `desc`)

`GET /api/group-options` returns only the lightweight id, name, Arabic name,
and country fields needed by the comparison selectors. Full comparison records
are loaded from `GET /api/groups/:id` when selected.

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
