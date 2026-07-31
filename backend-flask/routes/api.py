"""API routes matching the existing Express backend contract."""

from __future__ import annotations

import json
import math
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import BadRequest

from database.db import fetch_all, fetch_one


api = Blueprint("api", __name__, url_prefix="/api")
MAX_SAFE_INTEGER = 9_007_199_254_740_991
LEADERSHIP_COLUMNS = {
    "king": "king",
    "chief": "chief",
    "headman": "headman",
}
SORT_COLUMNS = {
    "id": "id",
    "groupname": "group_name",
    "group_name": "group_name",
    "country": "country",
    "continent": "continent",
    "region": "region",
    "population": "groupsize",
    "groupsize": "groupsize",
    "formackn": "formackn",
    "recognition": "formackn",
}
STATISTICS_SCOPE_COLUMNS = {
    "country": "country",
    "continent": "continent",
    "region": "region",
}
CONTACT_SUCCESS_MESSAGE = "Your message has been sent successfully."
CONTACT_FAILURE_MESSAGE = "We could not send your message. Please try again later."
RESEND_EMAIL_API_URL = "https://api.resend.com/emails"
CONTACT_FIELD_LIMITS = {
    "name": 120,
    "email": 254,
    "subject": 160,
    "message": 5_000,
}
CONTACT_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _parse_positive_integer(value, default_value: int | None, field_name: str) -> int:
    if value is None:
        if default_value is None:
            raise BadRequest(description=f"{field_name} must be a positive integer.")
        return default_value

    text = str(value)
    if re.fullmatch(r"\d+", text) is None:
        raise BadRequest(description=f"{field_name} must be a positive integer.")

    parsed_value = int(text)
    if parsed_value < 1 or parsed_value > MAX_SAFE_INTEGER:
        raise BadRequest(description=f"{field_name} must be a positive integer.")
    return parsed_value


def _validate_contact_payload(payload) -> tuple[dict[str, str], dict[str, str]]:
    """Return cleaned contact values and field-level validation errors."""

    if not isinstance(payload, dict):
        return {}, {"request": "A JSON object is required."}

    cleaned: dict[str, str] = {}
    errors: dict[str, str] = {}

    for field, maximum_length in CONTACT_FIELD_LIMITS.items():
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip():
            errors[field] = f"{field.capitalize()} is required."
            continue

        cleaned_value = value.strip()
        if len(cleaned_value) > maximum_length:
            errors[field] = (
                f"{field.capitalize()} must not exceed {maximum_length} characters."
            )
            continue
        cleaned[field] = cleaned_value

    email = cleaned.get("email")
    if email and CONTACT_EMAIL_PATTERN.fullmatch(email) is None:
        errors["email"] = "Email must be a valid email address."

    message = cleaned.get("message")
    if message and len(message) < 20:
        errors["message"] = "Message must be at least 20 characters."

    # Prevent user-controlled line breaks from being used in mail headers.
    for field in ("name", "email", "subject"):
        value = cleaned.get(field)
        if value and ("\r" in value or "\n" in value):
            errors[field] = f"{field.capitalize()} must be a single line."

    return cleaned, errors


@api.post("/contact")
def contact():
    """Validate a contact enquiry and deliver it without database storage."""

    values, errors = _validate_contact_payload(request.get_json(silent=True))
    if errors:
        return (
            jsonify(
                success=False,
                message="Please correct the highlighted fields.",
                errors=errors,
            ),
            400,
        )

    resend_api_key = str(current_app.config.get("RESEND_API_KEY", "")).strip()
    contact_email = str(current_app.config.get("CONTACT_EMAIL", "")).strip()
    from_email = str(current_app.config.get("FROM_EMAIL", "")).strip()
    if not resend_api_key or not contact_email or not from_email:
        current_app.logger.error(
            "Contact email delivery is unavailable because Resend configuration is incomplete."
        )
        return jsonify(success=False, message=CONTACT_FAILURE_MESSAGE), 500

    email_text = "\n".join(
        [
            f"Visitor full name: {values['name']}",
            f"Visitor email: {values['email']}",
            f"Selected subject: {values['subject']}",
            "",
            "Visitor message:",
            values["message"],
            "",
            "Source: Traditional Governance website",
        ]
    )

    resend_payload = {
        "from": from_email,
        "to": [contact_email],
        "subject": f"Traditional Governance website contact: {values['subject']}",
        "reply_to": values["email"],
        "text": email_text,
    }
    try:
        resend_request = Request(
            RESEND_EMAIL_API_URL,
            data=json.dumps(resend_payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
                "User-Agent": "traditional-governance-website/1.0",
            },
            method="POST",
        )
        with urlopen(resend_request, timeout=20) as resend_response:
            response_payload = json.loads(resend_response.read().decode("utf-8"))
            if (
                not 200 <= resend_response.status < 300
                or not isinstance(response_payload, dict)
                or not response_payload.get("id")
            ):
                raise ValueError("Unexpected Resend response.")
    except HTTPError as error:
        current_app.logger.error(
            "Contact email delivery failed (Resend HTTP %s).",
            error.code,
        )
        return jsonify(success=False, message=CONTACT_FAILURE_MESSAGE), 500
    except (URLError, TimeoutError, ValueError, UnicodeError) as error:
        # Record only the exception type so provider diagnostics and API keys cannot
        # leak into application logs or the public response.
        current_app.logger.error(
            "Contact email delivery failed (%s).",
            type(error).__name__,
        )
        return jsonify(success=False, message=CONTACT_FAILURE_MESSAGE), 500

    return jsonify(success=True, message=CONTACT_SUCCESS_MESSAGE)


@api.get("/health")
def health():
    try:
        fetch_one("SELECT 1 AS connected")
        return jsonify(
            success=True,
            data={"backend": "connected", "database": "connected"},
        )
    except Exception as error:  # Health must report database availability without stopping Flask.
        current_app.logger.error("Database health check failed: %s", error)
        return (
            jsonify(
                success=False,
                message="Backend is running, but the database connection failed.",
                data={"backend": "connected", "database": "disconnected"},
            ),
            503,
        )


@api.get("/stats")
def stats():
    row = fetch_one(
        """
        SELECT
          COUNT(DISTINCT country) AS total_countries,
          COUNT(DISTINCT continent) AS total_continents,
          COUNT(DISTINCT region) AS total_regions,
          COUNT(*) AS total_groups,
          COALESCE(SUM(any_tpi = 1), 0) AS groups_with_tpi,
          COALESCE(SUM(formackn = 1), 0) AS total_recognized,
          COALESCE(SUM(formackn = 0), 0) AS total_not_recognized,
          COALESCE(SUM(formackn IS NULL), 0) AS total_recognition_missing,
          COALESCE(SUM(func_land = 1), 0) AS total_func_land,
          COALESCE(SUM(func_sec = 1), 0) AS total_func_sec,
          COALESCE(SUM(kingheal = 1), 0) AS total_func_heal
        FROM tradgov_groups
        """
    )
    return jsonify(success=True, data=row)


def _statistics_scope() -> tuple[str, str | None, str, list[object]]:
    """Validate one optional geographic statistics scope."""

    supplied_scopes = [
        scope for scope in STATISTICS_SCOPE_COLUMNS if scope in request.args
    ]
    if len(supplied_scopes) > 1:
        raise BadRequest(
            description="Use only one statistics filter: country, continent, or region."
        )

    if not supplied_scopes:
        return "all", None, "", []

    scope_type = supplied_scopes[0]
    scope_value = request.args.get(scope_type, "").strip()
    if not scope_value:
        raise BadRequest(description=f"{scope_type} cannot be empty.")

    scope_column = STATISTICS_SCOPE_COLUMNS[scope_type]
    existing_value = fetch_one(
        (
            f"SELECT {scope_column} AS value "
            f"FROM tradgov_groups WHERE {scope_column} = %s LIMIT 1"
        ),
        [scope_value],
    )
    if existing_value is None:
        raise BadRequest(description=f"Unknown {scope_type}: {scope_value}.")

    return scope_type, scope_value, f" WHERE {scope_column} = %s", [scope_value]


@api.get("/statistics")
def filtered_statistics():
    """Return all statistics required by the interactive statistics page."""

    scope_type, scope_value, where_clause, query_parameters = _statistics_scope()
    summary = fetch_one(
        f"""
              SELECT
          COUNT(*) AS total_groups,
          COUNT(DISTINCT country) AS total_countries,
          COUNT(DISTINCT continent) AS total_continents,
          COUNT(DISTINCT region) AS total_regions,
          COALESCE(SUM(any_tpi = 1), 0) AS groups_with_tpi,
          COALESCE(SUM(formackn = 1), 0) AS recognized,
          COALESCE(SUM(formackn = 0), 0) AS not_recognized,
          COALESCE(SUM(formackn IS NULL), 0) AS recognition_missing,
          COALESCE(SUM(king = 1), 0) AS king,
          COALESCE(SUM(chief = 1), 0) AS chief,
          COALESCE(SUM(headman = 1), 0) AS headman,

          COALESCE(SUM(kinginher = 1), 0) AS hereditary,
          COALESCE(SUM(kingelect = 1), 0) AS elected,
          COALESCE(SUM(kingapp = 1), 0) AS appointed,
          COALESCE(
            SUM(
              king = 1
              AND kinginher IS NULL
              AND kingelect IS NULL
              AND kingapp IS NULL
            ),
            0
          ) AS leadership_selection_missing,

          COALESCE(SUM(func_land = 1), 0) AS land,
          COALESCE(SUM(func_sec = 1), 0) AS security,
          COALESCE(SUM(kingheal = 1), 0) AS healing
        FROM tradgov_groups{where_clause}
        """,
        query_parameters,
    ) or {}

    distribution_field = {
        "all": "continent",
        "continent": "region",
        "region": "country",
    }.get(scope_type)
    geographic_distribution: list[dict[str, object]] = []
    if distribution_field:
        distribution_conditions = list(query_parameters)
        separator = " AND " if where_clause else " WHERE "
        geographic_distribution = fetch_all(
            (
                f"SELECT {distribution_field} AS label, COUNT(*) AS total_groups "
                f"FROM tradgov_groups{where_clause}{separator}"
                f"{distribution_field} IS NOT NULL "
                f"AND TRIM({distribution_field}) <> '' "
                f"GROUP BY {distribution_field} "
                f"ORDER BY total_groups DESC, {distribution_field} ASC"
            ),
            distribution_conditions,
        )

    largest_groups = fetch_all(
        (
            "SELECT id, group_name, group_name_ar, country, groupsize "
            f"FROM tradgov_groups{where_clause}"
            f"{' AND' if where_clause else ' WHERE'} groupsize IS NOT NULL "
            "ORDER BY groupsize DESC, id ASC LIMIT 10"
        ),
        query_parameters,
    )

    top_countries: list[dict[str, object]] = []
    if scope_type != "country":
        top_countries = fetch_all(
            (
                "SELECT country, COUNT(*) AS total_groups "
                f"FROM tradgov_groups{where_clause}"
                f"{' AND' if where_clause else ' WHERE'} country IS NOT NULL "
                "AND TRIM(country) <> '' "
                "GROUP BY country "
                "ORDER BY total_groups DESC, country ASC LIMIT 10"
            ),
            query_parameters,
        )

    scope_label = (
        "All Data"
        if scope_type == "all"
        else f"{scope_type.title()}: {scope_value}"
    )
    return jsonify(
        success=True,
        data={
            "scope": {
                "type": scope_type,
                "value": scope_value,
                "label": scope_label,
            },
            "summary": {
                "total_groups": summary.get("total_groups", 0),
                "total_countries": summary.get("total_countries", 0),
                "total_continents": summary.get("total_continents", 0),
                "total_regions": summary.get("total_regions", 0),
                "groups_with_tpi": summary.get("groups_with_tpi", 0),
            },
            "recognition": {
                "recognized": summary.get("recognized", 0),
                "not_recognized": summary.get("not_recognized", 0),
                "missing": summary.get("recognition_missing", 0),
            },
            "leadership": {
                "king": summary.get("king", 0),
                "chief": summary.get("chief", 0),
                "headman": summary.get("headman", 0),
            },
            "leadership_selection": {
                "hereditary": summary.get("hereditary", 0),
             "elected": summary.get("elected", 0),
              "appointed": summary.get("appointed", 0),
              "missing": summary.get("leadership_selection_missing", 0),
            },
            "functions": {
                "land": summary.get("land", 0),
                "security": summary.get("security", 0),
                "healing": summary.get("healing", 0),
            },
            "geographic_distribution": {
                "type": distribution_field,
                "items": geographic_distribution,
            },
            "largest_groups": largest_groups,
            "top_countries": top_countries,
        },
    )


@api.get("/countries")
def countries():
    rows = fetch_all("SELECT * FROM vw_country_summary ORDER BY total_groups DESC")
    return jsonify(success=True, data=rows)


@api.get("/continents")
def continents():
    rows = fetch_all("SELECT * FROM vw_continent_summary ORDER BY total_groups DESC")
    return jsonify(success=True, data=rows)


@api.get("/regions")
def regions():
    rows = fetch_all("SELECT * FROM vw_region_summary ORDER BY total_groups DESC")
    return jsonify(success=True, data=rows)


@api.get("/leadership")
def leadership():
    rows = fetch_all("SELECT * FROM vw_leadership_summary")
    return jsonify(success=True, data=rows)


@api.get("/largest-groups")
def largest_groups():
    rows = fetch_all(
        """
        SELECT group_name, group_name_ar, country, groupsize
        FROM tradgov_groups
        WHERE groupsize IS NOT NULL
        ORDER BY groupsize DESC
        LIMIT 10
        """
    )
    return jsonify(success=True, data=rows)


@api.get("/top-countries")
def top_countries():
    rows = fetch_all(
        """
        SELECT
          country,
          COUNT(*) AS total_groups
        FROM tradgov_groups
        GROUP BY country
        ORDER BY total_groups DESC
        LIMIT 10
        """
    )
    return jsonify(success=True, data=rows)


@api.get("/group-options")
def group_options():
    """Return the lightweight fields required by the comparison selectors."""
    rows = fetch_all(
        """
        SELECT id, group_name, group_name_ar, country
        FROM tradgov_groups
        ORDER BY group_name IS NULL ASC, group_name ASC, id ASC
        """
    )
    return jsonify(success=True, data=rows)


@api.get("/groups")
def groups():
    page = _parse_positive_integer(request.args.get("page"), 1, "page")
    requested_limit = _parse_positive_integer(request.args.get("limit"), 20, "limit")

    if requested_limit > 100:
        raise BadRequest(description="limit cannot be greater than 100.")

    where_conditions: list[str] = []
    query_parameters: list[object] = []

    search = request.args.get("search")
    if search is not None and search.strip() != "":
        search_term = f"%{search.strip()}%"
        where_conditions.append(
            "(group_name LIKE %s OR group_name_ar LIKE %s OR country LIKE %s)"
        )
        query_parameters.extend([search_term, search_term, search_term])

    country = request.args.get("country")
    if country is not None and country.strip() != "":
        where_conditions.append("country = %s")
        query_parameters.append(country.strip())

    continent = request.args.get("continent")
    if continent is not None and continent.strip() != "":
        where_conditions.append("continent = %s")
        query_parameters.append(continent.strip())

    region = request.args.get("region")
    if region is not None and region.strip() != "":
        where_conditions.append("region = %s")
        query_parameters.append(region.strip())

    leadership = request.args.get("leadership")
    if leadership is not None and leadership.strip() != "":
        leadership_column = LEADERSHIP_COLUMNS.get(leadership.strip().casefold())
        if leadership_column is None:
            raise BadRequest(description="leadership must be King, Chief, or Headman.")
        where_conditions.append(f"{leadership_column} = 1")

    recognition = request.args.get("recognition")
    if recognition is not None and recognition != "":
        if recognition == "missing":
            where_conditions.append("formackn IS NULL")
        elif recognition in {"0", "1"}:
            where_conditions.append("formackn = %s")
            query_parameters.append(int(recognition))
        else:
            raise BadRequest(description="recognition must be 0, 1, or missing.")

    any_tpi = request.args.get("any_tpi")
    if any_tpi is not None and any_tpi != "":
        if any_tpi == "missing":
            where_conditions.append("any_tpi IS NULL")
        elif any_tpi in {"0", "1"}:
            where_conditions.append("any_tpi = %s")
            query_parameters.append(int(any_tpi))
        else:
            raise BadRequest(description="any_tpi must be 0, 1, or missing.")

    requested_sort = (request.args.get("sort") or "group_name").strip()
    sort_column = SORT_COLUMNS.get(requested_sort.casefold())
    if sort_column is None:
        raise BadRequest(description="Unsupported sort field.")

    sort_direction = (request.args.get("direction") or "asc").strip().lower()
    if sort_direction not in {"asc", "desc"}:
        raise BadRequest(description="direction must be asc or desc.")

    where_clause = f" WHERE {' AND '.join(where_conditions)}" if where_conditions else ""
    offset = (page - 1) * requested_limit
    order_clause = (
        f" ORDER BY {sort_column} IS NULL ASC, "
        f"{sort_column} {sort_direction.upper()}, id ASC"
    )

    rows = fetch_all(
        (
            f"SELECT *, COUNT(*) OVER() AS __total_items "
            f"FROM tradgov_groups{where_clause}{order_clause} LIMIT %s OFFSET %s"
        ),
        [*query_parameters, requested_limit, offset],
    )

    if rows:
        total_items = int(rows[0].pop("__total_items", 0))
        for row in rows[1:]:
            row.pop("__total_items", None)
    elif page > 1:
        # An out-of-range direct URL has no row carrying the window count.
        count_row = fetch_one(
            f"SELECT COUNT(*) AS total FROM tradgov_groups{where_clause}",
            query_parameters,
        )
        total_items = int(count_row["total"] if count_row else 0)
    else:
        total_items = 0
    total_pages = math.ceil(total_items / requested_limit)
    return jsonify(
        success=True,
        data={
            "groups": rows,
            "pagination": {
                "page": page,
                "limit": requested_limit,
                "total_items": total_items,
                "total_pages": total_pages,
            },
        },
    )


@api.get("/groups/<group_id>")
def group_detail(group_id: str):
    group_id_value = _parse_positive_integer(group_id, None, "id")
    row = fetch_one(
        "SELECT * FROM tradgov_groups WHERE id = %s LIMIT 1",
        [group_id_value],
    )
    if row is None:
        return jsonify(success=False, message="Group not found."), 404
    return jsonify(success=True, data=row)
