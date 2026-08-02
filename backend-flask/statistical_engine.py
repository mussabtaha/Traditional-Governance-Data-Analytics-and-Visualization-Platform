"""Generic, metadata-driven statistical analysis engine."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import (
    chi2_contingency,
    kruskal,
    mannwhitneyu,
    pearsonr,
    pointbiserialr,
    rankdata,
    shapiro,
    spearmanr,
    ttest_ind,
)
from scipy.stats.contingency import association


VARIABLE_REGISTRY: dict[str, dict[str, str]] = {
    "king": {"column": "king", "type": "binary", "label": "King"},
    "chief": {"column": "chief", "type": "binary", "label": "Chief"},
    "headman": {"column": "headman", "type": "binary", "label": "Headman"},
    "formackn": {
        "column": "formackn",
        "type": "binary",
        "label": "Formal Recognition",
    },
    "func_land": {
        "column": "func_land",
        "type": "binary",
        "label": "Land Administration",
    },
    "func_sec": {
        "column": "func_sec",
        "type": "binary",
        "label": "Security Function",
    },
    "kingheal": {
        "column": "kingheal",
        "type": "binary",
        "label": "Healing Function",
    },
    "kinginher": {
        "column": "kinginher",
        "type": "binary",
        "label": "King by Inheritance",
    },
    "kingelect": {
        "column": "kingelect",
        "type": "binary",
        "label": "King by Election",
    },
    "kingapp": {
        "column": "kingapp",
        "type": "binary",
        "label": "King by Appointment",
    },
    "continent": {
        "column": "continent",
        "type": "categorical",
        "label": "Continent",
    },
    "region": {
        "column": "region",
        "type": "categorical",
        "label": "Region",
    },
    "country": {
        "column": "country",
        "type": "categorical",
        "label": "Country",
    },
    "groupsize": {
        "column": "groupsize",
        "type": "numeric",
        "label": "Group Population Size",
    },
}


def finite_number(value: object) -> float | None:
    """Return a JSON-safe finite float."""

    if value is None:
        return None
    numeric = float(value)
    return numeric if math.isfinite(numeric) else None


def variable_catalog() -> list[dict[str, str]]:
    """Return public metadata for supported variables."""

    return [
        {"key": key, "type": value["type"], "label": value["label"]}
        for key, value in VARIABLE_REGISTRY.items()
    ]


def validate_variable_pair(variable_x: str, variable_y: str) -> None:
    """Validate a distinct pair against the strict registry."""

    unknown = [
        key for key in (variable_x, variable_y)
        if key not in VARIABLE_REGISTRY
    ]
    if unknown:
        raise ValueError(
            "Unsupported statistical variable: " + ", ".join(unknown) + "."
        )
    if variable_x == variable_y:
        raise ValueError("Select two different variables.")


def select_columns(variable_x: str, variable_y: str) -> str:
    """Build a bounded SELECT after registry validation."""

    validate_variable_pair(variable_x, variable_y)
    column_x = VARIABLE_REGISTRY[variable_x]["column"]
    column_y = VARIABLE_REGISTRY[variable_y]["column"]
    return (
        f"SELECT {column_x} AS variable_x, {column_y} AS variable_y "
        "FROM tradgov_groups"
    )


def _clean_series(series: pd.Series, variable: dict[str, str]) -> pd.Series:
    if variable["type"] == "numeric":
        cleaned = pd.to_numeric(series, errors="coerce")
        return cleaned.where(np.isfinite(cleaned) & (cleaned > 0))
    if variable["type"] == "binary":
        cleaned = pd.to_numeric(series, errors="coerce")
        return cleaned.where(cleaned.isin([0, 1]))
    cleaned = series.astype("string").str.strip()
    return cleaned.where(cleaned.ne(""))


def _category_label(value: object, variable: dict[str, str]) -> str:
    if variable["type"] == "binary":
        return "Yes" if int(value) == 1 else "No"
    return str(value)


def _normality(values: pd.Series) -> dict[str, object]:
    sample_size = int(values.size)
    if sample_size < 3 or values.nunique() < 2:
        return {
            "method": "Shapiro-Wilk test",
            "sample_size": sample_size,
            "statistic": None,
            "p_value": None,
            "normal": False,
            "assessable": False,
        }
    result = shapiro(values.to_numpy(dtype=float))
    p_value = finite_number(result.pvalue)
    return {
        "method": "Shapiro-Wilk test",
        "sample_size": sample_size,
        "statistic": finite_number(result.statistic),
        "p_value": p_value,
        "normal": p_value is not None and p_value >= 0.05,
        "assessable": p_value is not None,
    }


def _describe(values: pd.Series) -> dict[str, object]:
    if values.empty:
        return {
            key: None
            for key in (
                "mean",
                "median",
                "minimum",
                "maximum",
                "standard_deviation",
                "first_quartile",
                "third_quartile",
                "interquartile_range",
            )
        } | {"count": 0}
    description = values.describe(percentiles=[0.25, 0.5, 0.75])
    first_quartile = finite_number(description.get("25%"))
    third_quartile = finite_number(description.get("75%"))
    return {
        "count": int(description.get("count", 0)),
        "mean": finite_number(description.get("mean")),
        "median": finite_number(description.get("50%")),
        "minimum": finite_number(description.get("min")),
        "maximum": finite_number(description.get("max")),
        "standard_deviation": finite_number(description.get("std")),
        "first_quartile": first_quartile,
        "third_quartile": third_quartile,
        "interquartile_range": (
            float(third_quartile - first_quartile)
            if first_quartile is not None and third_quartile is not None
            else None
        ),
    }


def _correlation_strength(value: float | None) -> str | None:
    if value is None:
        return None
    magnitude = abs(value)
    if magnitude < 0.1:
        return "negligible"
    if magnitude < 0.3:
        return "weak"
    if magnitude < 0.5:
        return "moderate"
    if magnitude < 0.7:
        return "strong"
    return "very strong"


def _cramers_strength(value: float | None) -> str | None:
    if value is None:
        return None
    if value < 0.1:
        return "very weak"
    if value < 0.3:
        return "weak"
    if value < 0.5:
        return "moderate"
    if value < 0.7:
        return "strong"
    return "very strong"


def _epsilon_strength(value: float | None) -> str | None:
    if value is None:
        return None
    if value < 0.01:
        return "negligible"
    if value < 0.06:
        return "weak"
    if value < 0.14:
        return "moderate"
    return "strong"


def _assumption_warnings(expected: list[list[float]]) -> list[str]:
    if not expected:
        return []
    values = np.asarray(expected, dtype=float)
    warnings = []
    if np.any(values < 1):
        warnings.append("At least one expected frequency is below 1.")
    if np.mean(values < 5) > 0.2:
        warnings.append("More than 20% of expected frequencies are below 5.")
    return warnings


def _histogram(
    data: pd.DataFrame,
    numeric_column: str,
    category_column: str,
    category_variable: dict[str, str],
) -> dict[str, object]:
    values = data[numeric_column].to_numpy(dtype=float)
    if values.size == 0:
        return {"bin_edges": [], "datasets": []}
    edges = np.histogram_bin_edges(values, bins="auto")
    if len(edges) > 25:
        edges = np.linspace(np.min(values), np.max(values), 25)
    if len(edges) < 2 or edges[0] == edges[-1]:
        value = float(values[0])
        edges = np.asarray([value - 0.5, value + 0.5])
    datasets = []
    for category in sorted(data[category_column].unique(), key=str):
        group = data.loc[
            data[category_column] == category, numeric_column
        ].to_numpy(dtype=float)
        counts, _ = np.histogram(group, bins=edges)
        datasets.append({
            "label": _category_label(category, category_variable),
            "counts": counts.astype(int).tolist(),
        })
    return {
        "bin_edges": [float(value) for value in edges],
        "datasets": datasets,
    }


def _categorical_result(
    data: pd.DataFrame,
    variable_x: dict[str, str],
    variable_y: dict[str, str],
) -> dict[str, object]:
    table = pd.crosstab(data["variable_x"], data["variable_y"])
    observed = table.to_numpy(dtype=int)
    row_labels = [
        _category_label(value, variable_x) for value in table.index
    ]
    column_labels = [
        _category_label(value, variable_y) for value in table.columns
    ]
    statistic = p_value = cramers_v = None
    degrees_of_freedom = None
    expected: list[list[float]] = []
    reason = None
    if observed.shape[0] < 2 or observed.shape[1] < 2:
        reason = (
            "Both categorical variables require at least two observed "
            "categories before Chi-Square can be calculated."
        )
    else:
        result = chi2_contingency(observed, correction=False)
        statistic = finite_number(result.statistic)
        p_value = finite_number(result.pvalue)
        degrees_of_freedom = int(result.dof)
        expected = np.asarray(result.expected_freq, dtype=float).tolist()
        cramers_v = finite_number(
            association(observed, method="cramer", correction=False)
        )
    significant = p_value is not None and p_value < 0.05
    interpretation = (
        "There is a statistically significant association between the "
        "selected variables."
        if significant
        else "No statistically significant association was detected between "
        "the selected variables."
        if p_value is not None
        else "The association could not be calculated because the selected "
        "variables lacked sufficient category variation."
    )
    return {
        "analysis_type": "categorical_categorical",
        "normality_assessment": None,
        "descriptive_statistics": {
            "contingency_table": {
                "row_labels": row_labels,
                "column_labels": column_labels,
                "observed": observed.tolist(),
                "expected": expected,
            }
        },
        "statistical_test": {
            "name": "Chi-Square Test of Independence",
            "reason": (
                reason
                or "Both selected variables are categorical, so Chi-Square "
                "was selected automatically."
            ),
            "statistic": statistic,
            "degrees_of_freedom": degrees_of_freedom,
            "p_value": p_value,
            "effect_size": {
                "name": "Cramer's V",
                "value": cramers_v,
                "strength": _cramers_strength(cramers_v),
            },
            "significant": significant,
            "assumption_warnings": _assumption_warnings(expected),
        },
        "charts": {
            "recommended": "categorical",
            "stacked_bar": {
                "labels": row_labels,
                "datasets": [
                    {
                        "label": label,
                        "values": observed[:, index].astype(int).tolist(),
                    }
                    for index, label in enumerate(column_labels)
                ],
            },
            "heatmap": {
                "rows": row_labels,
                "columns": column_labels,
                "values": observed.tolist(),
            },
        },
        "interpretation": interpretation + " The result describes association, not causation.",
    }


def _numeric_categorical_result(
    data: pd.DataFrame,
    numeric_column: str,
    category_column: str,
    category_variable: dict[str, str],
) -> dict[str, object]:
    categories = sorted(data[category_column].unique(), key=str)
    groups = [
        data.loc[data[category_column] == category, numeric_column]
        for category in categories
    ]
    labels = [
        _category_label(category, category_variable)
        for category in categories
    ]
    descriptive = {
        label: _describe(group)
        for label, group in zip(labels, groups)
    }
    box_items = [
        {"label": label, **descriptive[label]} for label in labels
    ]
    normality = {
        label: _normality(group)
        for label, group in zip(labels, groups)
    }
    statistic = p_value = effect_value = degrees_of_freedom = None
    effect_name = effect_strength = None
    significant = False

    if len(categories) < 2:
        test_name = "Not computable"
        reason = "At least two observed categories are required."
    elif len(categories) == 2:
        distributions_normal = all(
            result["assessable"] and result["normal"]
            for result in normality.values()
        )
        encoded = data[category_column].map({
            categories[0]: 0,
            categories[1]: 1,
        }).to_numpy(dtype=int)
        if distributions_normal:
            result = ttest_ind(
                groups[0].to_numpy(dtype=float),
                groups[1].to_numpy(dtype=float),
                equal_var=False,
                nan_policy="omit",
            )
            effect = pointbiserialr(
                encoded,
                data[numeric_column].to_numpy(dtype=float),
            )
            test_name = "Welch's independent samples t-test"
            reason = (
                "Both groups satisfied the Shapiro-Wilk normality assessment, "
                "so an independent samples t-test was selected automatically."
            )
            degrees_of_freedom = finite_number(getattr(result, "df", None))
            effect_name = "Point-biserial correlation"
        else:
            result = mannwhitneyu(
                groups[0].to_numpy(dtype=float),
                groups[1].to_numpy(dtype=float),
                alternative="two-sided",
                method="auto",
            )
            effect = pointbiserialr(
                encoded,
                rankdata(data[numeric_column].to_numpy(dtype=float)),
            )
            test_name = "Mann-Whitney U Test"
            reason = (
                "At least one group did not satisfy normality, so the "
                "Mann-Whitney U test was selected automatically."
            )
            effect_name = "Rank-biserial correlation"
        statistic = finite_number(result.statistic)
        p_value = finite_number(result.pvalue)
        effect_value = finite_number(effect.statistic)
        effect_strength = _correlation_strength(effect_value)
    else:
        result = kruskal(
            *(group.to_numpy(dtype=float) for group in groups),
            nan_policy="omit",
        )
        test_name = "Kruskal-Wallis Test"
        reason = (
            "The categorical variable has more than two observed categories, "
            "so the Kruskal-Wallis test was selected automatically."
        )
        statistic = finite_number(result.statistic)
        p_value = finite_number(result.pvalue)
        degrees_of_freedom = len(categories) - 1
        denominator = len(data.index) - len(categories)
        effect_value = (
            max(0.0, float(result.statistic - len(categories) + 1) / denominator)
            if denominator > 0 else None
        )
        effect_name = "Epsilon-squared"
        effect_strength = _epsilon_strength(effect_value)

    significant = p_value is not None and p_value < 0.05
    interpretation = (
        "There is a statistically significant difference in the numeric "
        "variable across the selected categories."
        if significant
        else "No statistically significant difference was detected in the "
        "numeric variable across the selected categories."
        if p_value is not None
        else "The difference could not be calculated because the selected "
        "variables lacked sufficient variation."
    )
    return {
        "analysis_type": (
            "numeric_binary" if len(categories) == 2 else "numeric_categorical"
        ),
        "normality_assessment": {
            "method": "Shapiro-Wilk test",
            "groups": normality,
            "all_groups_normal": (
                len(categories) == 2
                and all(
                    item["assessable"] and item["normal"]
                    for item in normality.values()
                )
            ),
        },
        "descriptive_statistics": descriptive,
        "statistical_test": {
            "name": test_name,
            "reason": reason,
            "statistic": statistic,
            "degrees_of_freedom": degrees_of_freedom,
            "p_value": p_value,
            "effect_size": {
                "name": effect_name,
                "value": effect_value,
                "strength": effect_strength,
            },
            "significant": significant,
            "assumption_warnings": [],
        },
        "charts": {
            "recommended": (
                "numeric_binary" if len(categories) == 2 else "numeric_categorical"
            ),
            "box_plot": {"items": box_items},
            "histogram": (
                _histogram(
                    data,
                    numeric_column,
                    category_column,
                    category_variable,
                )
                if len(categories) == 2 else None
            ),
        },
        "interpretation": interpretation + " The result does not establish causation.",
    }


def _numeric_numeric_result(data: pd.DataFrame) -> dict[str, object]:
    normality = {
        "variable_x": _normality(data["variable_x"]),
        "variable_y": _normality(data["variable_y"]),
    }
    distributions_normal = all(
        result["assessable"] and result["normal"]
        for result in normality.values()
    )
    if distributions_normal:
        result = pearsonr(data["variable_x"], data["variable_y"])
        test_name = "Pearson Correlation"
        reason = (
            "Both numeric variables satisfied normality, so Pearson "
            "correlation was selected automatically."
        )
    else:
        result = spearmanr(data["variable_x"], data["variable_y"])
        test_name = "Spearman Correlation"
        reason = (
            "At least one numeric variable did not satisfy normality, so "
            "Spearman correlation was selected automatically."
        )
    coefficient = finite_number(result.statistic)
    p_value = finite_number(result.pvalue)
    significant = p_value is not None and p_value < 0.05
    points = [
        {"x": float(x), "y": float(y)}
        for x, y in data[["variable_x", "variable_y"]].itertuples(index=False)
    ]
    regression_line = None
    if data["variable_x"].nunique() > 1:
        slope, intercept = np.polyfit(
            data["variable_x"].to_numpy(dtype=float),
            data["variable_y"].to_numpy(dtype=float),
            1,
        )
        minimum = float(data["variable_x"].min())
        maximum = float(data["variable_x"].max())
        regression_line = [
            {"x": minimum, "y": float(slope * minimum + intercept)},
            {"x": maximum, "y": float(slope * maximum + intercept)},
        ]
    interpretation = (
        "There is a statistically significant relationship between the "
        "selected numeric variables."
        if significant
        else "No statistically significant relationship was detected between "
        "the selected numeric variables."
    )
    return {
        "analysis_type": "numeric_numeric",
        "normality_assessment": {
            "method": "Shapiro-Wilk test",
            "variables": normality,
            "both_variables_normal": distributions_normal,
        },
        "descriptive_statistics": {
            "variable_x": _describe(data["variable_x"]),
            "variable_y": _describe(data["variable_y"]),
        },
        "statistical_test": {
            "name": test_name,
            "reason": reason,
            "statistic": coefficient,
            "degrees_of_freedom": int(len(data.index) - 2),
            "p_value": p_value,
            "effect_size": {
                "name": "Correlation coefficient",
                "value": coefficient,
                "strength": _correlation_strength(coefficient),
            },
            "significant": significant,
            "assumption_warnings": [],
        },
        "charts": {
            "recommended": "correlation",
            "scatter": {
                "points": points,
                "regression_line": regression_line,
            },
        },
        "interpretation": interpretation + " The result describes association, not causation.",
    }


def run_analysis(
    rows: list[dict[str, Any]],
    variable_x_key: str,
    variable_y_key: str,
) -> dict[str, object]:
    """Clean a selected pair, choose a test, and return one stable contract."""

    validate_variable_pair(variable_x_key, variable_y_key)
    variable_x = VARIABLE_REGISTRY[variable_x_key]
    variable_y = VARIABLE_REGISTRY[variable_y_key]
    source = pd.DataFrame(rows, columns=["variable_x", "variable_y"])
    total_observations = int(len(source.index))
    source["variable_x"] = _clean_series(source["variable_x"], variable_x)
    source["variable_y"] = _clean_series(source["variable_y"], variable_y)
    valid_data = source.dropna(subset=["variable_x", "variable_y"]).copy()

    if valid_data.empty:
        raise ValueError(
            "No complete observations are available for the selected variables."
        )
    if variable_x["type"] == "binary":
        valid_data["variable_x"] = valid_data["variable_x"].astype(int)
    if variable_y["type"] == "binary":
        valid_data["variable_y"] = valid_data["variable_y"].astype(int)

    categorical_types = {"binary", "categorical"}
    if (
        variable_x["type"] in categorical_types
        and variable_y["type"] in categorical_types
    ):
        result = _categorical_result(valid_data, variable_x, variable_y)
    elif variable_x["type"] == "numeric" and variable_y["type"] == "numeric":
        result = _numeric_numeric_result(valid_data)
    else:
        numeric_column = (
            "variable_x" if variable_x["type"] == "numeric" else "variable_y"
        )
        category_column = (
            "variable_y" if numeric_column == "variable_x" else "variable_x"
        )
        category_variable = (
            variable_y if category_column == "variable_y" else variable_x
        )
        result = _numeric_categorical_result(
            valid_data,
            numeric_column,
            category_column,
            category_variable,
        )

    result["variables"] = {
        "variable_x": {"key": variable_x_key, **variable_x},
        "variable_y": {"key": variable_y_key, **variable_y},
    }
    result["data_preparation"] = {
        "total_observations": total_observations,
        "missing_values_excluded": int(
            total_observations - len(valid_data.index)
        ),
        "final_sample_size": int(len(valid_data.index)),
    }
    result["statistical_test"]["sample_size"] = int(len(valid_data.index))
    result["supported_variables"] = variable_catalog()
    return result
