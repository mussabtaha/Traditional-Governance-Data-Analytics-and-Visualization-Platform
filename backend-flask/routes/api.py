"""API routes matching the existing Express backend contract."""

from __future__ import annotations

import math
import re

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import BadRequest

from database.db import fetch_all, fetch_one


api = Blueprint("api", __name__, url_prefix="/api")
MAX_SAFE_INTEGER = 9_007_199_254_740_991


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
          COALESCE(SUM(any_tpi = 1), 0) AS groups_with_tpi
        FROM tradgov_groups
        """
    )
    return jsonify(success=True, data=row)


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

    continent = request.args.get("continent")
    if continent is not None and continent.strip() != "":
        where_conditions.append("continent = %s")
        query_parameters.append(continent.strip())

    region = request.args.get("region")
    if region is not None and region.strip() != "":
        where_conditions.append("region = %s")
        query_parameters.append(region.strip())

    any_tpi = request.args.get("any_tpi")
    if any_tpi is not None and any_tpi != "":
        if any_tpi not in {"0", "1"}:
            raise BadRequest(description="any_tpi must be either 0 or 1.")
        where_conditions.append("any_tpi = %s")
        query_parameters.append(int(any_tpi))

    where_clause = f" WHERE {' AND '.join(where_conditions)}" if where_conditions else ""
    offset = (page - 1) * requested_limit

    count_row = fetch_one(
        f"SELECT COUNT(*) AS total FROM tradgov_groups{where_clause}",
        query_parameters,
    )
    rows = fetch_all(
        f"SELECT * FROM tradgov_groups{where_clause} ORDER BY id ASC LIMIT %s OFFSET %s",
        [*query_parameters, requested_limit, offset],
    )

    total_items = int(count_row["total"] if count_row else 0)
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
