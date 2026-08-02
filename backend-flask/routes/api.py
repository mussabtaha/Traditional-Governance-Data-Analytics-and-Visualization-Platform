"""API routes matching the existing Express backend contract."""

from __future__ import annotations

import json
import math
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Blueprint, current_app, jsonify, request
import numpy as np
import pandas as pd
from scipy.stats import (
    chi2_contingency,
    mannwhitneyu,
    pointbiserialr,
    rankdata,
    shapiro,
    ttest_ind,
)
from scipy.stats.contingency import association
from werkzeug.exceptions import BadRequest

from statistical_engine import run_analysis, select_columns
from database.db import fetch_all, fetch_one


api = Blueprint("api", __name__, url_prefix="/api")
MAX_SAFE_INTEGER = 9_007_199_254_740_991
LEADERSHIP_COLUMNS = {
    "king": "king",
    "chief": "chief",
    "headman": "headman",
}
LEADERSHIP_ANALYSIS_LABELS = {
    "king": "King",
    "chief": "Chief",
    "headman": "Headman",
}
GOVERNANCE_FUNCTION_COLUMNS = {
    "land": "func_land",
    "security": "func_sec",
    "healing": "kingheal",
}
GOVERNANCE_FUNCTION_LABELS = {
    "land": "Land Administration",
    "security": "Security",
    "healing": "Healing",
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


def _integer_value(row: dict[str, object], key: str) -> int:
    """Return a MySQL aggregate as an integer regardless of driver type."""

    value = row.get(key, 0)
    return int(value) if value is not None else 0


def _cramers_v_strength(value: float) -> str:
    """Classify the 2x2 Cramer's V using conventional broad thresholds."""

    if value < 0.3:
        return "weak"
    if value < 0.5:
        return "moderate"
    return "strong"


def _detailed_cramers_v_strength(value: float) -> str:
    """Classify Cramer's V for the five-level Analysis #2 scale."""

    if value < 0.1:
        return "very weak"
    if value < 0.3:
        return "weak"
    if value < 0.5:
        return "moderate"
    if value < 0.7:
        return "strong"
    return "very strong"


def _validate_statistical_analysis_query() -> None:
    """Reject unsupported parameters instead of silently ignoring them."""

    if request.args:
        names = ", ".join(sorted(request.args.keys()))
        raise BadRequest(
            description=f"Unsupported statistical-analysis query parameters: {names}."
        )


def _chi_square_assumption_warnings(
    expected: list[list[float]],
) -> list[str]:
    """Report conventional expected-frequency concerns for Chi-Square tests."""

    if not expected:
        return ["Expected frequencies are unavailable because the test was not computable."]
    values = np.asarray(expected, dtype=float)
    warnings = []
    if np.any(values < 1):
        warnings.append("At least one expected frequency is below 1.")
    below_five_ratio = float(np.mean(values < 5))
    if below_five_ratio > 0.2:
        warnings.append("More than 20% of expected frequencies are below 5.")
    return warnings


def _leadership_recognition_aggregates() -> dict[str, object]:
    """Fetch every observed count for the three 2x2 analyses in one query."""

    aggregate_fields = [
        "COUNT(*) AS total_rows",
        "COALESCE(SUM(formackn IS NULL), 0) AS formackn_missing",
    ]
    for variable, column in LEADERSHIP_COLUMNS.items():
        aggregate_fields.extend(
            [
                f"COALESCE(SUM({column} IS NULL), 0) AS {variable}_missing",
                (
                    f"COALESCE(SUM(formackn IS NULL OR {column} IS NULL), 0) "
                    f"AS {variable}_excluded"
                ),
                (
                    f"COALESCE(SUM({column} = 1 AND formackn = 1), 0) "
                    f"AS {variable}_present_recognized"
                ),
                (
                    f"COALESCE(SUM({column} = 1 AND formackn = 0), 0) "
                    f"AS {variable}_present_not_recognized"
                ),
                (
                    f"COALESCE(SUM({column} = 0 AND formackn = 1), 0) "
                    f"AS {variable}_absent_recognized"
                ),
                (
                    f"COALESCE(SUM({column} = 0 AND formackn = 0), 0) "
                    f"AS {variable}_absent_not_recognized"
                ),
                (
                    f"COALESCE(SUM({column} = 1 AND formackn IS NULL), 0) "
                    f"AS {variable}_present_recognition_missing"
                ),
            ]
        )

    query = (
        "SELECT\n  "
        + ",\n  ".join(aggregate_fields)
        + "\nFROM tradgov_groups"
    )
    return fetch_one(query) or {}


def _leadership_recognition_result(
    row: dict[str, object], variable: str
) -> dict[str, object]:
    """Calculate one Pearson Chi-Square test and its Cramer's V effect size."""

    label = LEADERSHIP_ANALYSIS_LABELS[variable]
    observed = [
        [
            _integer_value(row, f"{variable}_present_recognized"),
            _integer_value(row, f"{variable}_present_not_recognized"),
        ],
        [
            _integer_value(row, f"{variable}_absent_recognized"),
            _integer_value(row, f"{variable}_absent_not_recognized"),
        ],
    ]
    sample_size = sum(sum(table_row) for table_row in observed)

    chi_square: float | None = None
    p_value: float | None = None
    degrees_of_freedom: int | None = None
    expected: list[list[float]] = []
    cramers_v: float | None = None
    effect_strength: str | None = None
    significant = False

    if sample_size > 0:
        try:
            statistic, probability, degrees, expected_values = chi2_contingency(
                observed,
                correction=False,
            )
            chi_square = float(statistic)
            p_value = float(probability)
            degrees_of_freedom = int(degrees)
            expected = [
                [float(value) for value in expected_row]
                for expected_row in expected_values.tolist()
            ]
            cramers_v = float(
                association(observed, method="cramer", correction=False)
            )
            effect_strength = _cramers_v_strength(cramers_v)
            significant = p_value < 0.05
        except ValueError:
            # A constant row or column can make an expected cell zero. Return the
            # observed evidence and a clear non-computable result instead of a 500.
            expected = []

    if p_value is None or cramers_v is None or effect_strength is None:
        interpretation = (
            f"The association between {label.lower()} leadership and formal state "
            "recognition could not be calculated because the valid observations "
            "do not contain enough variation."
        )
    else:
        significance_text = (
            "There is a statistically significant association"
            if significant
            else "There is no statistically significant association"
        )
        comparison = "p < 0.05" if significant else "p ≥ 0.05"
        interpretation = (
            f"{significance_text} between {label.lower()} leadership and formal "
            f"state recognition ({comparison}). The effect size is "
            f"{effect_strength} (Cramer's V = {cramers_v:.3f})."
        )

    return {
        "variable": variable,
        "label": label,
        "contingency_table": {
            "row_labels": ["Leadership present", "Leadership absent"],
            "column_labels": ["Recognized", "Not recognized"],
            "observed": observed,
            "expected": expected,
        },
        "chi_square": chi_square,
        "degrees_of_freedom": degrees_of_freedom,
        "p_value": p_value,
        "cramers_v": cramers_v,
        "effect_strength": effect_strength,
        "sample_size": sample_size,
        "significant": significant,
        "assumption_warnings": _chi_square_assumption_warnings(expected),
        "missing_values_excluded": {
            "formal_recognition": _integer_value(row, "formackn_missing"),
            "leadership_variable": _integer_value(row, f"{variable}_missing"),
            "total_excluded": _integer_value(row, f"{variable}_excluded"),
        },
        "interpretation": interpretation,
    }


@api.get("/statistical-analysis/leadership-recognition")
def leadership_recognition_analysis():
    """Test whether each leadership indicator is associated with recognition."""

    _validate_statistical_analysis_query()
    aggregates = _leadership_recognition_aggregates()
    analyses = [
        _leadership_recognition_result(aggregates, variable)
        for variable in LEADERSHIP_COLUMNS
    ]

    stacked_datasets = []
    heatmap_rows = []
    for analysis in analyses:
        variable = str(analysis["variable"])
        present = analysis["contingency_table"]["observed"][0]
        recognized = int(present[0])
        not_recognized = int(present[1])
        missing = _integer_value(
            aggregates,
            f"{variable}_present_recognition_missing",
        )
        valid_present = recognized + not_recognized
        heatmap_rows.append(
            {
                "variable": variable,
                "label": analysis["label"],
                "recognized_percentage": (
                    recognized / valid_present * 100 if valid_present else 0.0
                ),
                "not_recognized_percentage": (
                    not_recognized / valid_present * 100 if valid_present else 0.0
                ),
            }
        )
        stacked_datasets.append(
            {
                "variable": variable,
                "label": analysis["label"],
                "recognized": recognized,
                "not_recognized": not_recognized,
                "missing": missing,
            }
        )

    total_rows = _integer_value(aggregates, "total_rows")
    formackn_missing = _integer_value(aggregates, "formackn_missing")
    return jsonify(
        success=True,
        data={
            "research_question": (
                "Is leadership type associated with formal state recognition?"
            ),
            "method": {
                "name": "Pearson Chi-Square Test of Independence",
                "alpha": 0.05,
                "yates_correction": False,
                "effect_size": "Cramer's V",
                "effect_strength_thresholds": {
                    "weak": "V < 0.30",
                    "moderate": "0.30 ≤ V < 0.50",
                    "strong": "V ≥ 0.50",
                },
            },
            "data_quality": {
                "total_rows": total_rows,
                "formal_recognition_missing": formackn_missing,
                "rows_with_recognition": total_rows - formackn_missing,
                "policy": (
                    "Rows with NULL formal recognition or NULL values in the "
                    "tested leadership variable are excluded from that test."
                ),
            },
            "analyses": analyses,
            "charts": {
                "stacked_bar": {
                    "labels": [analysis["label"] for analysis in analyses],
                    "items": stacked_datasets,
                },
                "heatmap": {
                    "columns": ["Recognized", "Not recognized"],
                    "rows": heatmap_rows,
                },
            },
        },
    )


def _leadership_function_aggregates() -> dict[str, object]:
    """Fetch all nine leadership/function contingency tables in one query."""

    aggregate_fields = ["COUNT(*) AS total_rows"]
    for leadership, leadership_column in LEADERSHIP_COLUMNS.items():
        for function_name, function_column in GOVERNANCE_FUNCTION_COLUMNS.items():
            prefix = f"{leadership}_{function_name}"
            aggregate_fields.extend(
                [
                    (
                        f"COALESCE(SUM({leadership_column} IS NULL), 0) "
                        f"AS {prefix}_leadership_missing"
                    ),
                    (
                        f"COALESCE(SUM({function_column} IS NULL), 0) "
                        f"AS {prefix}_function_missing"
                    ),
                    (
                        f"COALESCE(SUM({leadership_column} IS NULL OR "
                        f"{function_column} IS NULL), 0) AS {prefix}_excluded"
                    ),
                    (
                        f"COALESCE(SUM({leadership_column} = 1 AND "
                        f"{function_column} = 1), 0) AS {prefix}_present_present"
                    ),
                    (
                        f"COALESCE(SUM({leadership_column} = 1 AND "
                        f"{function_column} = 0), 0) AS {prefix}_present_absent"
                    ),
                    (
                        f"COALESCE(SUM({leadership_column} = 0 AND "
                        f"{function_column} = 1), 0) AS {prefix}_absent_present"
                    ),
                    (
                        f"COALESCE(SUM({leadership_column} = 0 AND "
                        f"{function_column} = 0), 0) AS {prefix}_absent_absent"
                    ),
                ]
            )

    query = (
        "SELECT\n  "
        + ",\n  ".join(aggregate_fields)
        + "\nFROM tradgov_groups"
    )
    return fetch_one(query) or {}


def _leadership_function_result(
    row: dict[str, object], leadership: str, function_name: str
) -> dict[str, object]:
    """Calculate one leadership/function Pearson Chi-Square analysis."""

    prefix = f"{leadership}_{function_name}"
    leadership_label = LEADERSHIP_ANALYSIS_LABELS[leadership]
    function_label = GOVERNANCE_FUNCTION_LABELS[function_name]
    observed = [
        [
            _integer_value(row, f"{prefix}_present_present"),
            _integer_value(row, f"{prefix}_present_absent"),
        ],
        [
            _integer_value(row, f"{prefix}_absent_present"),
            _integer_value(row, f"{prefix}_absent_absent"),
        ],
    ]
    sample_size = sum(sum(table_row) for table_row in observed)

    chi_square: float | None = None
    p_value: float | None = None
    degrees_of_freedom: int | None = None
    expected: list[list[float]] = []
    cramers_v: float | None = None
    effect_strength: str | None = None
    significant = False

    if sample_size > 0:
        try:
            statistic, probability, degrees, expected_values = chi2_contingency(
                observed,
                correction=False,
            )
            chi_square = float(statistic)
            p_value = float(probability)
            degrees_of_freedom = int(degrees)
            expected = [
                [float(value) for value in expected_row]
                for expected_row in expected_values.tolist()
            ]
            cramers_v = float(
                association(observed, method="cramer", correction=False)
            )
            effect_strength = _detailed_cramers_v_strength(cramers_v)
            significant = p_value < 0.05
        except ValueError:
            expected = []

    if p_value is None or cramers_v is None or effect_strength is None:
        interpretation = (
            f"The relationship between {leadership_label.lower()} leadership "
            f"and {function_label.lower()} could not be calculated because the "
            "valid observations do not contain enough variation."
        )
    elif significant:
        interpretation = (
            f"There is a statistically significant relationship between "
            f"{leadership_label.lower()} leadership and {function_label.lower()} "
            f"(p < 0.05). The association is {effect_strength} "
            f"(Cramer's V = {cramers_v:.3f})."
        )
    else:
        interpretation = (
            f"No statistically significant association was detected between "
            f"{leadership_label.lower()} leadership and {function_label.lower()} "
            f"(p ≥ 0.05). The association is {effect_strength} "
            f"(Cramer's V = {cramers_v:.3f})."
        )

    leadership_present_total = sum(observed[0])
    leadership_absent_total = sum(observed[1])
    function_present_rates = {
        "leadership_present": (
            observed[0][0] / leadership_present_total * 100
            if leadership_present_total
            else 0.0
        ),
        "leadership_absent": (
            observed[1][0] / leadership_absent_total * 100
            if leadership_absent_total
            else 0.0
        ),
    }

    return {
        "analysis_id": prefix,
        "leadership_variable": leadership,
        "leadership_label": leadership_label,
        "function_variable": function_name,
        "function_column": GOVERNANCE_FUNCTION_COLUMNS[function_name],
        "function_label": function_label,
        "contingency_table": {
            "row_labels": ["Leadership present", "Leadership absent"],
            "column_labels": ["Function present", "Function absent"],
            "observed": observed,
            "expected": expected,
        },
        "chi_square": chi_square,
        "degrees_of_freedom": degrees_of_freedom,
        "p_value": p_value,
        "cramers_v": cramers_v,
        "effect_strength": effect_strength,
        "sample_size": sample_size,
        "significant": significant,
        "assumption_warnings": _chi_square_assumption_warnings(expected),
        "missing_values_excluded": {
            "leadership_variable": _integer_value(
                row, f"{prefix}_leadership_missing"
            ),
            "governance_function": _integer_value(
                row, f"{prefix}_function_missing"
            ),
            "total_excluded": _integer_value(row, f"{prefix}_excluded"),
        },
        "function_present_percentages": function_present_rates,
        "interpretation": interpretation,
    }


@api.get("/statistical-analysis/leadership-functions")
def leadership_functions_analysis():
    """Return all nine leadership/governance-function association tests."""

    _validate_statistical_analysis_query()
    aggregates = _leadership_function_aggregates()
    analyses = [
        _leadership_function_result(aggregates, leadership, function_name)
        for leadership in LEADERSHIP_COLUMNS
        for function_name in GOVERNANCE_FUNCTION_COLUMNS
    ]
    summary = [
        {
            "analysis_id": analysis["analysis_id"],
            "leadership_variable": analysis["leadership_variable"],
            "leadership_label": analysis["leadership_label"],
            "function_variable": analysis["function_variable"],
            "function_label": analysis["function_label"],
            "chi_square": analysis["chi_square"],
            "p_value": analysis["p_value"],
            "cramers_v": analysis["cramers_v"],
            "significant": analysis["significant"],
            "effect_strength": analysis["effect_strength"],
        }
        for analysis in analyses
    ]
    heatmap_values = [
        {
            "analysis_id": analysis["analysis_id"],
            "leadership": analysis["leadership_label"],
            "function": analysis["function_label"],
            "cramers_v": analysis["cramers_v"],
            "significant": analysis["significant"],
        }
        for analysis in analyses
    ]
    significant_items = [
        {
            "analysis_id": analysis["analysis_id"],
            "leadership_label": analysis["leadership_label"],
            "function_label": analysis["function_label"],
            "label": (
                f"{analysis['leadership_label']} — {analysis['function_label']}"
            ),
            "leadership_present_percentage": analysis[
                "function_present_percentages"
            ]["leadership_present"],
            "leadership_absent_percentage": analysis[
                "function_present_percentages"
            ]["leadership_absent"],
        }
        for analysis in analyses
        if analysis["significant"]
    ]

    return jsonify(
        success=True,
        data={
            "research_question": (
                "Is leadership type associated with traditional governance "
                "functions?"
            ),
            "variables": {
                "leadership": list(LEADERSHIP_COLUMNS),
                "governance_functions": list(GOVERNANCE_FUNCTION_COLUMNS.values()),
            },
            "method": {
                "name": "Pearson Chi-Square Test of Independence",
                "alpha": 0.05,
                "yates_correction": False,
                "effect_size": "Cramer's V",
                "effect_strength_thresholds": {
                    "very weak": "V < 0.10",
                    "weak": "0.10 ≤ V < 0.30",
                    "moderate": "0.30 ≤ V < 0.50",
                    "strong": "0.50 ≤ V < 0.70",
                    "very strong": "V ≥ 0.70",
                },
            },
            "data_quality": {
                "total_rows": _integer_value(aggregates, "total_rows"),
                "policy": (
                    "Rows with NULL values in either variable used by a test "
                    "are excluded from that test and reported separately."
                ),
            },
            "analyses": analyses,
            "summary": summary,
            "charts": {
                "cramers_v_heatmap": {
                    "rows": list(LEADERSHIP_ANALYSIS_LABELS.values()),
                    "columns": list(GOVERNANCE_FUNCTION_LABELS.values()),
                    "values": heatmap_values,
                },
                "significant_relationships": {
                    "metric": "Function-present percentage",
                    "items": significant_items,
                },
            },
        },
    )


def _finite_number(value: object) -> float | None:
    """Return a finite JSON-safe float, or None for undefined statistics."""

    if value is None:
        return None
    numeric = float(value)
    return numeric if math.isfinite(numeric) else None


def _population_descriptive_statistics(values: pd.Series) -> dict[str, object]:
    """Calculate the Analysis #3 descriptive statistics with Pandas."""

    description = values.describe(percentiles=[0.25, 0.5, 0.75])
    first_quartile = _finite_number(description.get("25%"))
    third_quartile = _finite_number(description.get("75%"))
    return {
        "count": int(description.get("count", 0)),
        "mean": _finite_number(description.get("mean")),
        "median": _finite_number(description.get("50%")),
        "minimum": _finite_number(description.get("min")),
        "maximum": _finite_number(description.get("max")),
        "standard_deviation": _finite_number(description.get("std")),
        "interquartile_range": (
            float(third_quartile - first_quartile)
            if first_quartile is not None and third_quartile is not None
            else None
        ),
        "first_quartile": first_quartile,
        "third_quartile": third_quartile,
    }


def _population_normality(values: pd.Series) -> dict[str, object]:
    """Assess one recognition group's normality with SciPy Shapiro-Wilk."""

    sample_size = int(values.size)
    if sample_size < 3 or values.nunique() < 2:
        return {
            "sample_size": sample_size,
            "statistic": None,
            "p_value": None,
            "normal": False,
            "assessable": False,
        }

    statistic, probability = shapiro(values.to_numpy(dtype=float))
    p_value = _finite_number(probability)
    return {
        "sample_size": sample_size,
        "statistic": _finite_number(statistic),
        "p_value": p_value,
        "normal": p_value is not None and p_value >= 0.05,
        "assessable": p_value is not None,
    }


def _correlation_strength(value: float | None) -> str | None:
    """Classify an absolute correlation effect size."""

    if value is None:
        return None
    magnitude = abs(value)
    if magnitude < 0.1:
        return "negligible"
    if magnitude < 0.3:
        return "small"
    if magnitude < 0.5:
        return "moderate"
    return "large"


def _population_histogram(
    valid_data: pd.DataFrame,
    binary_column: str = "formackn",
    labels: tuple[str, str] = ("Recognized", "Not Recognized"),
) -> dict[str, object]:
    """Build common logarithmic population bins for both recognition groups."""

    values = valid_data["groupsize"].to_numpy(dtype=float)
    log_values = np.log10(values)
    if np.min(log_values) == np.max(log_values):
        half_width = 0.05
        log_edges = np.array(
            [np.min(log_values) - half_width, np.max(log_values) + half_width]
        )
    else:
        log_edges = np.histogram_bin_edges(log_values, bins="auto")
        if len(log_edges) > 25:
            log_edges = np.linspace(np.min(log_values), np.max(log_values), 25)

    bin_edges = np.power(10.0, log_edges)
    datasets = []
    for recognition_value, label in ((1, labels[0]), (0, labels[1])):
        group_values = valid_data.loc[
            valid_data[binary_column] == recognition_value, "groupsize"
        ].to_numpy(dtype=float)
        counts, _ = np.histogram(group_values, bins=bin_edges)
        datasets.append({"label": label, "counts": counts.astype(int).tolist()})

    return {
        "scale": "logarithmic population intervals",
        "bin_edges": [float(value) for value in bin_edges],
        "datasets": datasets,
    }


def _groupsize_recognition_payload(rows: list[dict[str, object]]) -> dict[str, object]:
    """Prepare data and calculate the complete population/recognition analysis."""

    source = pd.DataFrame(rows, columns=["groupsize", "formackn"])
    total_observations = int(len(source.index))
    source["groupsize"] = pd.to_numeric(source["groupsize"], errors="coerce")
    source["formackn"] = pd.to_numeric(source["formackn"], errors="coerce")

    valid_mask = (
        source["groupsize"].notna()
        & np.isfinite(source["groupsize"])
        & (source["groupsize"] > 0)
        & source["formackn"].isin([0, 1])
    )
    valid_data = source.loc[valid_mask, ["groupsize", "formackn"]].copy()
    valid_data["formackn"] = valid_data["formackn"].astype(int)
    excluded_observations = int(total_observations - len(valid_data.index))

    recognized = valid_data.loc[valid_data["formackn"] == 1, "groupsize"]
    not_recognized = valid_data.loc[valid_data["formackn"] == 0, "groupsize"]
    if recognized.empty or not_recognized.empty:
        raise ValueError(
            "Both recognized and not recognized groups require valid population values."
        )

    descriptive = {
        "recognized": _population_descriptive_statistics(recognized),
        "not_recognized": _population_descriptive_statistics(not_recognized),
    }
    normality_groups = {
        "recognized": _population_normality(recognized),
        "not_recognized": _population_normality(not_recognized),
    }
    distributions_normal = all(
        result["assessable"] and result["normal"]
        for result in normality_groups.values()
    )

    if distributions_normal:
        test_result = ttest_ind(
            recognized.to_numpy(dtype=float),
            not_recognized.to_numpy(dtype=float),
            equal_var=False,
            nan_policy="omit",
        )
        test_name = "Welch's independent samples t-test"
        test_reason = (
            "Both recognition groups satisfied the Shapiro-Wilk normality "
            "assessment at alpha = 0.05, so a two-sided independent samples "
            "t-test with unequal variances was selected."
        )
        effect_result = pointbiserialr(
            valid_data["formackn"].to_numpy(dtype=int),
            valid_data["groupsize"].to_numpy(dtype=float),
        )
        effect_name = "Point-biserial correlation"
    else:
        test_result = mannwhitneyu(
            recognized.to_numpy(dtype=float),
            not_recognized.to_numpy(dtype=float),
            alternative="two-sided",
            method="auto",
        )
        test_name = "Mann-Whitney U Test"
        test_reason = (
            "At least one recognition group did not satisfy, or could not "
            "satisfy, the Shapiro-Wilk normality assessment at alpha = 0.05; "
            "therefore the two-sided non-parametric Mann-Whitney U test was selected."
        )
        ranked_population = rankdata(valid_data["groupsize"].to_numpy(dtype=float))
        effect_result = pointbiserialr(
            valid_data["formackn"].to_numpy(dtype=int),
            ranked_population,
        )
        effect_name = "Rank-biserial correlation"

    statistic = _finite_number(test_result.statistic)
    p_value = _finite_number(test_result.pvalue)
    effect_value = _finite_number(effect_result.statistic)
    effect_strength = _correlation_strength(effect_value)
    significant = p_value is not None and p_value < 0.05
    direction = (
        "recognized groups tend to have larger populations"
        if effect_value is not None and effect_value > 0
        else "not recognized groups tend to have larger populations"
        if effect_value is not None and effect_value < 0
        else "neither recognition group tends to have larger populations"
    )
    significance_text = (
        "There is a statistically significant difference in group population "
        "size between formally recognized and non-recognized traditional institutions."
        if significant
        else "No statistically significant difference in group population size "
        "was detected between formally recognized and non-recognized traditional institutions."
    )
    effect_text = (
        f"The {effect_name.lower()} indicates a {effect_strength} effect; {direction}."
        if effect_strength is not None
        else "The effect size could not be calculated."
    )

    return {
        "research_question": (
            "Is group population size associated with formal state recognition?"
        ),
        "variables": {
            "independent": "groupsize",
            "dependent": "formackn",
        },
        "data_preparation": {
            "total_observations": total_observations,
            "excluded_observations": excluded_observations,
            "final_sample_size": int(len(valid_data.index)),
            "policy": (
                "Only records with a positive numeric groupsize and a binary "
                "formackn value (0 or 1) are included."
            ),
        },
        "descriptive_statistics": descriptive,
        "normality_assessment": {
            "method": "Shapiro-Wilk test",
            "alpha": 0.05,
            "groups": normality_groups,
            "distributions_normal": distributions_normal,
            "conclusion": test_reason,
        },
        "statistical_test": {
            "name": test_name,
            "reason": test_reason,
            "statistic": statistic,
            "p_value": p_value,
            "sample_size": int(len(valid_data.index)),
            "significant": significant,
            "effect_size": {
                "name": effect_name,
                "value": effect_value,
                "strength": effect_strength,
                "direction": direction,
            },
        },
        "charts": {
            "box_plot": {
                "scale": "logarithmic",
                "items": [
                    {"label": "Recognized", **descriptive["recognized"]},
                    {"label": "Not Recognized", **descriptive["not_recognized"]},
                ],
            },
            "histogram": _population_histogram(valid_data),
        },
        "interpretation": f"{significance_text} {effect_text}",
    }


@api.get("/statistical-analysis/groupsize-recognition")
def groupsize_recognition_analysis():
    """Compare group population distributions by formal recognition status."""

    _validate_statistical_analysis_query()
    rows = fetch_all("SELECT groupsize, formackn FROM tradgov_groups")
    try:
        data = _groupsize_recognition_payload(rows)
    except ValueError as error:
        return jsonify(success=False, message=str(error)), 422
    return jsonify(success=True, data=data)


def _groupsize_function_result(
    source: pd.DataFrame,
    function_key: str,
    function_column: str,
    function_label: str,
) -> dict[str, object]:
    """Calculate one population-size/governance-function comparison."""

    working = source[["groupsize", function_column]].copy()
    working["groupsize"] = pd.to_numeric(working["groupsize"], errors="coerce")
    working[function_column] = pd.to_numeric(
        working[function_column], errors="coerce"
    )
    valid_mask = (
        working["groupsize"].notna()
        & np.isfinite(working["groupsize"])
        & (working["groupsize"] > 0)
        & working[function_column].isin([0, 1])
    )
    valid_data = working.loc[valid_mask, ["groupsize", function_column]].copy()
    valid_data[function_column] = valid_data[function_column].astype(int)
    total_observations = int(len(working.index))
    final_sample_size = int(len(valid_data.index))

    function_present = valid_data.loc[
        valid_data[function_column] == 1, "groupsize"
    ]
    function_absent = valid_data.loc[
        valid_data[function_column] == 0, "groupsize"
    ]
    descriptive = {
        "function_present": _population_descriptive_statistics(function_present),
        "function_absent": _population_descriptive_statistics(function_absent),
    }
    normality_groups = {
        "function_present": _population_normality(function_present),
        "function_absent": _population_normality(function_absent),
    }
    enough_groups = not function_present.empty and not function_absent.empty
    distributions_normal = enough_groups and all(
        result["assessable"] and result["normal"]
        for result in normality_groups.values()
    )

    statistic: float | None = None
    p_value: float | None = None
    effect_value: float | None = None
    if not enough_groups:
        test_name = "Not computable"
        test_reason = (
            "Both function-present and function-absent records require valid "
            "population values before a two-group test can be calculated."
        )
        effect_name = None
    elif distributions_normal:
        test_result = ttest_ind(
            function_present.to_numpy(dtype=float),
            function_absent.to_numpy(dtype=float),
            equal_var=False,
            nan_policy="omit",
        )
        test_name = "Welch's independent samples t-test"
        test_reason = (
            "Both function groups satisfied the Shapiro-Wilk normality "
            "assessment at alpha = 0.05, so a two-sided independent samples "
            "t-test with unequal variances was selected."
        )
        effect_result = pointbiserialr(
            valid_data[function_column].to_numpy(dtype=int),
            valid_data["groupsize"].to_numpy(dtype=float),
        )
        statistic = _finite_number(test_result.statistic)
        p_value = _finite_number(test_result.pvalue)
        effect_value = _finite_number(effect_result.statistic)
        effect_name = "Point-biserial correlation"
    else:
        test_result = mannwhitneyu(
            function_present.to_numpy(dtype=float),
            function_absent.to_numpy(dtype=float),
            alternative="two-sided",
            method="auto",
        )
        test_name = "Mann-Whitney U Test"
        test_reason = (
            "At least one function group did not satisfy, or could not satisfy, "
            "the Shapiro-Wilk normality assessment at alpha = 0.05; therefore "
            "the two-sided non-parametric Mann-Whitney U test was selected."
        )
        effect_result = pointbiserialr(
            valid_data[function_column].to_numpy(dtype=int),
            rankdata(valid_data["groupsize"].to_numpy(dtype=float)),
        )
        statistic = _finite_number(test_result.statistic)
        p_value = _finite_number(test_result.pvalue)
        effect_value = _finite_number(effect_result.statistic)
        effect_name = "Rank-biserial correlation"

    effect_strength = _correlation_strength(effect_value)
    significant = p_value is not None and p_value < 0.05
    direction = (
        "function-present groups tend to have larger populations"
        if effect_value is not None and effect_value > 0
        else "function-absent groups tend to have larger populations"
        if effect_value is not None and effect_value < 0
        else "neither function group tends to have larger populations"
    )
    if p_value is None:
        interpretation = (
            f"The population-size difference for {function_label.lower()} "
            "could not be calculated because both comparison groups were not available."
        )
    elif significant and effect_value is not None and effect_value > 0:
        interpretation = (
            "Larger traditional groups are significantly more likely to perform "
            f"{function_label.lower()}. The {effect_name.lower()} indicates a "
            f"{effect_strength} effect."
        )
    elif significant:
        interpretation = (
            f"Groups performing {function_label.lower()} have significantly smaller "
            f"population sizes. The {effect_name.lower()} indicates a "
            f"{effect_strength} effect."
        )
    else:
        interpretation = (
            "No statistically significant difference in population size was found "
            f"for {function_label.lower()}. The {effect_name.lower()} indicates a "
            f"{effect_strength} effect."
        )

    box_items = [
        {"label": "Function Present", **descriptive["function_present"]},
        {"label": "Function Absent", **descriptive["function_absent"]},
    ]
    histogram = (
        _population_histogram(
            valid_data,
            binary_column=function_column,
            labels=("Function Present", "Function Absent"),
        )
        if final_sample_size
        else {
            "scale": "logarithmic population intervals",
            "bin_edges": [],
            "datasets": [],
        }
    )
    return {
        "analysis_id": function_key,
        "function_variable": function_column,
        "function_label": function_label,
        "data_preparation": {
            "total_observations": total_observations,
            "missing_observations_removed": total_observations - final_sample_size,
            "final_sample_size": final_sample_size,
        },
        "descriptive_statistics": descriptive,
        "normality_assessment": {
            "method": "Shapiro-Wilk test",
            "alpha": 0.05,
            "groups": normality_groups,
            "distributions_normal": distributions_normal,
        },
        "statistical_test": {
            "name": test_name,
            "reason": test_reason,
            "statistic": statistic,
            "p_value": p_value,
            "sample_size": final_sample_size,
            "significant": significant,
            "effect_size": {
                "name": effect_name,
                "value": effect_value,
                "strength": effect_strength,
                "direction": direction,
            },
        },
        "charts": {
            "box_plot": {"scale": "logarithmic", "items": box_items},
            "histogram": histogram,
        },
        "interpretation": interpretation,
    }


@api.get("/statistical-analysis/groupsize-functions")
def groupsize_functions_analysis():
    """Compare population distributions across three governance functions."""

    _validate_statistical_analysis_query()
    function_definitions = [
        ("land", "func_land", "Land Administration"),
        ("security", "func_sec", "Security"),
        ("healing", "kingheal", "Healing"),
    ]
    rows = fetch_all(
        "SELECT groupsize, func_land, func_sec, kingheal FROM tradgov_groups"
    )
    source = pd.DataFrame(
        rows,
        columns=["groupsize", "func_land", "func_sec", "kingheal"],
    )
    analyses = [
        _groupsize_function_result(source, key, column, label)
        for key, column, label in function_definitions
    ]
    summary = [
        {
            "analysis_id": analysis["analysis_id"],
            "function_variable": analysis["function_variable"],
            "function_label": analysis["function_label"],
            "test_used": analysis["statistical_test"]["name"],
            "test_statistic": analysis["statistical_test"]["statistic"],
            "p_value": analysis["statistical_test"]["p_value"],
            "effect_size": analysis["statistical_test"]["effect_size"]["value"],
            "effect_strength": analysis["statistical_test"]["effect_size"]["strength"],
            "sample_size": analysis["statistical_test"]["sample_size"],
            "significant": analysis["statistical_test"]["significant"],
        }
        for analysis in analyses
    ]
    return jsonify(
        success=True,
        data={
            "research_question": (
                "Is group population size associated with traditional governance functions?"
            ),
            "variables": {
                "independent": "groupsize",
                "dependent": ["func_land", "func_sec", "kingheal"],
            },
            "method": {
                "normality_assessment": "Shapiro-Wilk test",
                "normal_path": "Welch's independent samples t-test",
                "non_normal_path": "Mann-Whitney U Test",
                "alpha": 0.05,
            },
            "data_quality": {"total_rows": int(len(source.index))},
            "analyses": analyses,
            "summary": summary,
        },
    )


def _continent_leadership_payload(
    rows: list[dict[str, object]],
) -> dict[str, object]:
    """Aggregate leadership indicators by continent and run Chi-Square."""

    leadership_columns = ["king", "chief", "headman"]
    source = pd.DataFrame(rows, columns=["continent", *leadership_columns])
    total_observations = int(len(source.index))
    source["continent"] = source["continent"].astype("string").str.strip()
    valid_mask = source["continent"].notna() & source["continent"].ne("")
    valid_data = source.loc[
        valid_mask, ["continent", *leadership_columns]
    ].copy()
    for column in leadership_columns:
        valid_data[column] = (
            pd.to_numeric(valid_data[column], errors="coerce").eq(1).astype(int)
        )

    grouped = (
        valid_data.groupby("continent", sort=True, observed=True)
        .agg(
            total_groups=("continent", "size"),
            king=("king", "sum"),
            chief=("chief", "sum"),
            headman=("headman", "sum"),
        )
        .reset_index()
    )
    descriptive_statistics = []
    distribution_percentages = {column: [] for column in leadership_columns}
    for row in grouped.to_dict(orient="records"):
        total_groups = int(row["total_groups"])
        counts = {column: int(row[column]) for column in leadership_columns}
        leadership_total = sum(counts.values())
        percentages = {
            column: float(counts[column] / total_groups * 100)
            if total_groups else 0.0
            for column in leadership_columns
        }
        normalized = {
            column: float(counts[column] / leadership_total * 100)
            if leadership_total else 0.0
            for column in leadership_columns
        }
        descriptive_statistics.append(
            {
                "continent": str(row["continent"]),
                "total_groups": total_groups,
                "counts": counts,
                "percentages": percentages,
                "leadership_distribution_percentages": normalized,
            }
        )
        for column in leadership_columns:
            distribution_percentages[column].append(normalized[column])

    observed = grouped[leadership_columns].to_numpy(dtype=int)
    row_totals = observed.sum(axis=1) if observed.size else np.array([])
    test_observed = observed[row_totals > 0]
    test_labels = grouped.loc[row_totals > 0, "continent"].astype(str).tolist()
    statistic = p_value = cramers_v = None
    degrees_of_freedom = None
    expected = []
    test_reason = None
    all_types_present = (
        test_observed.size > 0 and np.all(test_observed.sum(axis=0) > 0)
    )
    if test_observed.shape[0] < 2 or not all_types_present:
        test_reason = (
            "At least two continents and at least one observed King, Chief, and "
            "Headman occurrence are required for the Chi-Square test."
        )
    else:
        test_result = chi2_contingency(test_observed, correction=False)
        statistic = _finite_number(test_result.statistic)
        p_value = _finite_number(test_result.pvalue)
        degrees_of_freedom = int(test_result.dof)
        expected = [
            [float(value) for value in row]
            for row in np.asarray(test_result.expected_freq, dtype=float)
        ]
        cramers_v = _finite_number(
            association(test_observed, method="cramer", correction=False)
        )

    significant = p_value is not None and p_value < 0.05
    effect_strength = (
        _detailed_cramers_v_strength(cramers_v)
        if cramers_v is not None else None
    )
    if p_value is None:
        interpretation = (
            "The association between continent and leadership structure could "
            "not be calculated because the contingency table lacked sufficient variation."
        )
    elif significant:
        interpretation = (
            "There is a statistically significant association between continent "
            "and leadership structure (p < 0.05). Cramer''s V indicates a "
            f"{effect_strength} association."
        )
    else:
        interpretation = (
            "No statistically significant association was detected between "
            "continent and leadership structure (p >= 0.05). Cramer''s V "
            f"indicates a {effect_strength} association."
        )

    leadership_totals = {
        column: int(grouped[column].sum()) if not grouped.empty else 0
        for column in leadership_columns
    }
    dominant_key = (
        max(leadership_totals, key=leadership_totals.get)
        if any(leadership_totals.values()) else None
    )
    label_names = {"king": "Kings", "chief": "Chiefs", "headman": "Headmen"}
    labels = [item["continent"] for item in descriptive_statistics]
    chart_datasets = [
        {
            "key": column,
            "label": label_names[column],
            "values": [int(item["counts"][column]) for item in descriptive_statistics],
        }
        for column in leadership_columns
    ]
    percentage_datasets = [
        {
            "key": column,
            "label": label_names[column],
            "values": distribution_percentages[column],
        }
        for column in leadership_columns
    ]

    return {
        "research_question": (
            "Does the distribution of traditional leadership types differ across continents?"
        ),
        "variables": {
            "geographic": "continent",
            "leadership": leadership_columns,
        },
        "data_preparation": {
            "total_observations": total_observations,
            "missing_observations_removed": int(total_observations - len(valid_data)),
            "final_sample_size": int(len(valid_data)),
            "policy": "Records with a missing or blank continent are excluded.",
        },
        "descriptive_statistics": descriptive_statistics,
        "summary": {
            "total_groups": int(len(valid_data)),
            "dominant_leadership_type": label_names.get(dominant_key),
            "number_of_continents": int(len(grouped)),
            "leadership_totals": leadership_totals,
        },
        "statistical_test": {
            "name": "Chi-Square Test of Independence",
            "contingency_table": {
                "row_labels": test_labels,
                "column_labels": ["King", "Chief", "Headman"],
                "observed": test_observed.astype(int).tolist(),
                "expected": expected,
            },
            "chi_square": statistic,
            "degrees_of_freedom": degrees_of_freedom,
            "p_value": p_value,
            "cramers_v": cramers_v,
            "effect_strength": effect_strength,
            "sample_size": int(test_observed.sum()) if test_observed.size else 0,
            "group_sample_size": int(len(valid_data)),
            "significant": significant,
            "assumption_warnings": _chi_square_assumption_warnings(expected),
            "reason": test_reason,
        },
        "charts": {
            "grouped_bar": {"labels": labels, "datasets": chart_datasets},
            "percentage_stacked": {
                "labels": labels,
                "datasets": percentage_datasets,
            },
        },
        "interpretation": interpretation,
        "method_note": (
            "Leadership fields are independent binary indicators. A group may "
            "contribute more than one leadership occurrence; the Chi-Square sample "
            "size therefore counts leadership occurrences, while group_sample_size "
            "counts traditional groups."
        ),
    }


@api.get("/statistical-analysis/continent-leadership")
def continent_leadership_analysis():
    """Test whether leadership-indicator distributions vary by continent."""

    _validate_statistical_analysis_query()
    rows = fetch_all(
        "SELECT continent, king, chief, headman FROM tradgov_groups"
    )
    return jsonify(success=True, data=_continent_leadership_payload(rows))

def _continent_recognition_payload(
    rows: list[dict[str, object]],
) -> dict[str, object]:
    """Aggregate formal recognition by continent and run Chi-Square."""

    source = pd.DataFrame(rows, columns=["continent", "formackn"])
    total_observations = int(len(source.index))
    source["continent"] = source["continent"].astype("string").str.strip()
    source["formackn"] = pd.to_numeric(source["formackn"], errors="coerce")
    valid_mask = (
        source["continent"].notna()
        & source["continent"].ne("")
        & source["formackn"].isin([0, 1])
    )
    valid_data = source.loc[valid_mask, ["continent", "formackn"]].copy()
    valid_data["formackn"] = valid_data["formackn"].astype(int)

    grouped = (
        valid_data.groupby("continent", sort=True, observed=True)
        .agg(
            total_groups=("continent", "size"),
            recognized=("formackn", "sum"),
        )
        .reset_index()
    )
    grouped["not_recognized"] = grouped["total_groups"] - grouped["recognized"]
    grouped["recognition_percentage"] = np.where(
        grouped["total_groups"] > 0,
        grouped["recognized"] / grouped["total_groups"] * 100,
        0.0,
    )

    descriptive_statistics = [
        {
            "continent": str(row["continent"]),
            "total_groups": int(row["total_groups"]),
            "recognized": int(row["recognized"]),
            "not_recognized": int(row["not_recognized"]),
            "recognition_percentage": float(row["recognition_percentage"]),
        }
        for row in grouped.to_dict(orient="records")
    ]

    observed = grouped[["recognized", "not_recognized"]].to_numpy(dtype=int)
    statistic = p_value = cramers_v = None
    degrees_of_freedom = None
    expected = []
    test_reason = None
    both_statuses_present = (
        observed.size > 0 and np.all(observed.sum(axis=0) > 0)
    )
    if observed.shape[0] < 2 or not both_statuses_present:
        test_reason = (
            "At least two continents and at least one recognized and one not "
            "recognized group are required for the Chi-Square test."
        )
    else:
        test_result = chi2_contingency(observed, correction=False)
        statistic = _finite_number(test_result.statistic)
        p_value = _finite_number(test_result.pvalue)
        degrees_of_freedom = int(test_result.dof)
        expected = [
            [float(value) for value in row]
            for row in np.asarray(test_result.expected_freq, dtype=float)
        ]
        cramers_v = _finite_number(
            association(observed, method="cramer", correction=False)
        )

    significant = p_value is not None and p_value < 0.05
    effect_strength = (
        _detailed_cramers_v_strength(cramers_v)
        if cramers_v is not None else None
    )
    if p_value is None:
        interpretation = (
            "The association between continent and formal recognition could not "
            "be calculated because the contingency table lacked sufficient variation."
        )
    elif significant:
        interpretation = (
            "There is a statistically significant association between continent "
            "and formal recognition (p < 0.05). Cramer's V indicates a "
            f"{effect_strength} association."
        )
    else:
        interpretation = (
            "No statistically significant association was detected between "
            "continent and formal recognition (p >= 0.05). Cramer's V indicates "
            f"a {effect_strength} association."
        )

    highest = (
        max(descriptive_statistics, key=lambda item: item["recognition_percentage"])
        if descriptive_statistics else None
    )
    lowest = (
        min(descriptive_statistics, key=lambda item: item["recognition_percentage"])
        if descriptive_statistics else None
    )
    labels = [item["continent"] for item in descriptive_statistics]
    recognized_percentages = [
        item["recognition_percentage"] for item in descriptive_statistics
    ]
    not_recognized_percentages = [
        100.0 - value for value in recognized_percentages
    ]

    return {
        "research_question": "Does formal state recognition differ across continents?",
        "variables": {
            "independent": "continent",
            "dependent": "formackn",
        },
        "data_preparation": {
            "total_observations": total_observations,
            "missing_observations_removed": int(total_observations - len(valid_data)),
            "final_sample_size": int(len(valid_data)),
            "policy": (
                "Only records with a non-blank continent and binary formackn "
                "value (0 or 1) are included."
            ),
        },
        "descriptive_statistics": descriptive_statistics,
        "summary": {
            "total_continents": int(len(grouped)),
            "highest_recognition_rate": highest,
            "lowest_recognition_rate": lowest,
        },
        "statistical_test": {
            "name": "Chi-Square Test of Independence",
            "contingency_table": {
                "row_labels": labels,
                "column_labels": ["Recognized", "Not Recognized"],
                "observed": observed.astype(int).tolist(),
                "expected": expected,
            },
            "chi_square": statistic,
            "degrees_of_freedom": degrees_of_freedom,
            "p_value": p_value,
            "cramers_v": cramers_v,
            "effect_strength": effect_strength,
            "sample_size": int(len(valid_data)),
            "significant": significant,
            "assumption_warnings": _chi_square_assumption_warnings(expected),
            "reason": test_reason,
        },
        "charts": {
            "percentage_stacked": {
                "labels": labels,
                "datasets": [
                    {
                        "key": "recognized",
                        "label": "Recognized",
                        "values": recognized_percentages,
                    },
                    {
                        "key": "not_recognized",
                        "label": "Not Recognized",
                        "values": not_recognized_percentages,
                    },
                ],
            },
            "recognition_heatmap": {
                "items": [
                    {
                        "continent": item["continent"],
                        "recognition_percentage": item["recognition_percentage"],
                    }
                    for item in descriptive_statistics
                ],
            },
        },
        "interpretation": interpretation,
    }


@api.get("/statistical-analysis/continent-recognition")
def continent_recognition_analysis():
    """Test whether formal recognition varies across continents."""

    _validate_statistical_analysis_query()
    rows = fetch_all("SELECT continent, formackn FROM tradgov_groups")
    return jsonify(success=True, data=_continent_recognition_payload(rows))



def _region_recognition_payload(
    rows: list[dict[str, object]],
) -> dict[str, object]:
    """Aggregate formal recognition by region and run Chi-Square."""

    source = pd.DataFrame(rows, columns=["region", "formackn"])
    total_observations = int(len(source.index))
    source["region"] = source["region"].astype("string").str.strip()
    source["formackn"] = pd.to_numeric(source["formackn"], errors="coerce")

    region_mask = source["region"].notna() & source["region"].ne("")
    regional_data = source.loc[region_mask, ["region", "formackn"]].copy()
    valid_mask = regional_data["formackn"].isin([0, 1])
    valid_data = regional_data.loc[valid_mask].copy()
    valid_data["formackn"] = valid_data["formackn"].astype(int)

    region_labels = sorted(str(value) for value in regional_data["region"].unique())
    descriptive_statistics = []
    for region in region_labels:
        region_rows = regional_data.loc[regional_data["region"] == region]
        recognized = int((region_rows["formackn"] == 1).sum())
        not_recognized = int((region_rows["formackn"] == 0).sum())
        missing_recognition = int(
            (~region_rows["formackn"].isin([0, 1])).sum()
        )
        valid_recognition = recognized + not_recognized
        recognition_percentage = (
            recognized / valid_recognition * 100
            if valid_recognition else 0.0
        )
        descriptive_statistics.append({
            "region": region,
            "total_groups": int(len(region_rows.index)),
            "recognized": recognized,
            "not_recognized": not_recognized,
            "missing_recognition": missing_recognition,
            "recognition_percentage": float(recognition_percentage),
        })

    test_rows = [
        item for item in descriptive_statistics
        if item["recognized"] + item["not_recognized"] > 0
    ]
    labels = [item["region"] for item in test_rows]
    observed = np.asarray([
        [item["recognized"], item["not_recognized"]]
        for item in test_rows
    ], dtype=int)
    statistic = p_value = cramers_v = None
    degrees_of_freedom = None
    expected = []
    test_reason = None
    both_statuses_present = (
        observed.size > 0 and np.all(observed.sum(axis=0) > 0)
    )
    if observed.shape[0] < 2 or not both_statuses_present:
        test_reason = (
            "At least two regions and at least one recognized and one not "
            "recognized group are required for the Chi-Square test."
        )
    else:
        test_result = chi2_contingency(observed, correction=False)
        statistic = _finite_number(test_result.statistic)
        p_value = _finite_number(test_result.pvalue)
        degrees_of_freedom = int(test_result.dof)
        expected = [
            [float(value) for value in row]
            for row in np.asarray(test_result.expected_freq, dtype=float)
        ]
        cramers_v = _finite_number(
            association(observed, method="cramer", correction=False)
        )

    significant = p_value is not None and p_value < 0.05
    effect_strength = (
        _detailed_cramers_v_strength(cramers_v)
        if cramers_v is not None else None
    )
    if p_value is None:
        interpretation = (
            "The association between region and formal recognition could not "
            "be calculated because the contingency table lacked sufficient variation."
        )
    elif significant:
        interpretation = (
            "There is a statistically significant association between region "
            "and formal recognition (p < 0.05). Cramer's V indicates a "
            f"{effect_strength} association."
        )
    else:
        interpretation = (
            "No statistically significant association was detected between "
            "region and formal recognition (p >= 0.05). Cramer's V indicates "
            f"a {effect_strength} association."
        )

    highest = (
        max(descriptive_statistics, key=lambda item: item["recognition_percentage"])
        if descriptive_statistics else None
    )
    lowest = (
        min(descriptive_statistics, key=lambda item: item["recognition_percentage"])
        if descriptive_statistics else None
    )
    valid_total = int(len(valid_data.index))
    average_rate = (
        float((valid_data["formackn"] == 1).sum() / valid_total * 100)
        if valid_total else 0.0
    )

    def _share(item: dict[str, object], key: str) -> float:
        total = int(item["total_groups"])
        return float(int(item[key]) / total * 100) if total else 0.0

    return {
        "research_question": "Does formal state recognition differ across geographic regions?",
        "variables": {"independent": "region", "dependent": "formackn"},
        "data_preparation": {
            "total_observations": total_observations,
            "missing_observations_removed": int(total_observations - valid_total),
            "final_sample_size": valid_total,
            "missing_region": int(total_observations - len(regional_data.index)),
            "missing_recognition": int(len(regional_data.index) - valid_total),
            "policy": (
                "The Chi-Square test includes only non-blank regions with binary "
                "formackn values. Missing recognition is retained only for "
                "regional descriptive counts and chart data."
            ),
        },
        "descriptive_statistics": descriptive_statistics,
        "summary": {
            "total_regions": int(len(descriptive_statistics)),
            "highest_recognition_rate": highest,
            "lowest_recognition_rate": lowest,
            "average_recognition_rate": average_rate,
        },
        "statistical_test": {
            "name": "Chi-Square Test of Independence",
            "contingency_table": {
                "row_labels": labels,
                "column_labels": ["Recognized", "Not Recognized"],
                "observed": observed.astype(int).tolist(),
                "expected": expected,
            },
            "chi_square": statistic,
            "degrees_of_freedom": degrees_of_freedom,
            "p_value": p_value,
            "cramers_v": cramers_v,
            "effect_strength": effect_strength,
            "sample_size": valid_total,
            "significant": significant,
            "assumption_warnings": _chi_square_assumption_warnings(expected),
            "reason": test_reason,
        },
        "charts": {
            "percentage_stacked": {
                "labels": region_labels,
                "datasets": [
                    {
                        "key": "recognized",
                        "label": "Recognized",
                        "values": [
                            _share(item, "recognized")
                            for item in descriptive_statistics
                        ],
                    },
                    {
                        "key": "not_recognized",
                        "label": "Not Recognized",
                        "values": [
                            _share(item, "not_recognized")
                            for item in descriptive_statistics
                        ],
                    },
                    {
                        "key": "missing",
                        "label": "Missing",
                        "values": [
                            _share(item, "missing_recognition")
                            for item in descriptive_statistics
                        ],
                    },
                ],
            },
            "recognition_heatmap": {
                "items": [
                    {
                        "region": item["region"],
                        "recognition_percentage": item["recognition_percentage"],
                    }
                    for item in descriptive_statistics
                ],
            },
        },
        "interpretation": interpretation,
    }


@api.get("/statistical-analysis/region-recognition")
def region_recognition_analysis():
    """Test whether formal recognition varies across geographic regions."""

    _validate_statistical_analysis_query()
    rows = fetch_all("SELECT region, formackn FROM tradgov_groups")
    return jsonify(success=True, data=_region_recognition_payload(rows))

@api.get("/statistical-analysis/run")
def run_dynamic_statistical_analysis():
    """Run one automatically selected analysis for a whitelisted pair."""

    allowed_parameters = {"variable_x", "variable_y"}
    unsupported = sorted(set(request.args) - allowed_parameters)
    if unsupported:
        raise BadRequest(
            description=(
                "Unsupported statistical-analysis query parameters: "
                + ", ".join(unsupported)
                + "."
            )
        )

    variable_x = request.args.get("variable_x", "").strip().lower()
    variable_y = request.args.get("variable_y", "").strip().lower()
    if not variable_x or not variable_y:
        raise BadRequest(
            description="variable_x and variable_y are required."
        )

    try:
        query = select_columns(variable_x, variable_y)
    except ValueError as error:
        raise BadRequest(description=str(error)) from error

    rows = fetch_all(query)
    try:
        data = run_analysis(rows, variable_x, variable_y)
    except ValueError as error:
        return (
            jsonify(success=False, message=str(error)),
            422,
        )

    return jsonify(success=True, data=data)


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
