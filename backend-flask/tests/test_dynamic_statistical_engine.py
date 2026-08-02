"""Tests for the metadata-driven Analysis #8 statistical engine."""

from __future__ import annotations

import unittest
from unittest.mock import patch

import pandas as pd

from app import app
from statistical_engine import _numeric_numeric_result


class DynamicStatisticalEngineApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_all")
    def test_categorical_pair_selects_chi_square(self, fetch_all) -> None:
        fetch_all.return_value = [
            {"variable_x": 1, "variable_y": 1},
            {"variable_x": 1, "variable_y": 1},
            {"variable_x": 1, "variable_y": 0},
            {"variable_x": 0, "variable_y": 1},
            {"variable_x": 0, "variable_y": 0},
            {"variable_x": 0, "variable_y": 0},
            {"variable_x": None, "variable_y": 1},
        ]

        response = self.client.get(
            "/api/statistical-analysis/run"
            "?variable_x=king&variable_y=formackn"
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]
        self.assertEqual(data["analysis_type"], "categorical_categorical")
        self.assertEqual(
            data["statistical_test"]["name"],
            "Chi-Square Test of Independence",
        )
        table = data["descriptive_statistics"]["contingency_table"]
        self.assertEqual(table["row_labels"], ["No", "Yes"])
        self.assertEqual(table["column_labels"], ["No", "Yes"])
        self.assertEqual(table["observed"], [[2, 1], [1, 2]])
        self.assertAlmostEqual(data["statistical_test"]["statistic"], 2 / 3)
        self.assertEqual(data["statistical_test"]["degrees_of_freedom"], 1)
        self.assertAlmostEqual(
            data["statistical_test"]["effect_size"]["value"],
            1 / 3,
        )
        self.assertEqual(data["data_preparation"]["total_observations"], 7)
        self.assertEqual(data["data_preparation"]["missing_values_excluded"], 1)
        self.assertEqual(data["data_preparation"]["final_sample_size"], 6)
        fetch_all.assert_called_once_with(
            "SELECT king AS variable_x, formackn AS variable_y "
            "FROM tradgov_groups"
        )

    @patch("routes.api.fetch_all")
    def test_normal_numeric_binary_pair_selects_t_test(self, fetch_all) -> None:
        fetch_all.return_value = [
            {"variable_x": value, "variable_y": category}
            for category, values in (
                (1, [10, 20, 30, 40, 50, 60]),
                (0, [5, 15, 25, 35, 45, 55]),
            )
            for value in values
        ]

        data = self.client.get(
            "/api/statistical-analysis/run"
            "?variable_x=groupsize&variable_y=chief"
        ).get_json()["data"]

        self.assertEqual(data["analysis_type"], "numeric_binary")
        self.assertEqual(
            data["statistical_test"]["name"],
            "Welch's independent samples t-test",
        )
        self.assertTrue(
            data["normality_assessment"]["all_groups_normal"]
        )
        self.assertEqual(
            data["statistical_test"]["effect_size"]["name"],
            "Point-biserial correlation",
        )
        self.assertIn("box_plot", data["charts"])
        self.assertIn("histogram", data["charts"])

    @patch("routes.api.fetch_all")
    def test_non_normal_numeric_binary_selects_mann_whitney(
        self, fetch_all
    ) -> None:
        fetch_all.return_value = [
            {"variable_x": value, "variable_y": 1}
            for value in ([1] * 9 + [1000])
        ] + [
            {"variable_x": value, "variable_y": 0}
            for value in ([2] * 10)
        ]

        data = self.client.get(
            "/api/statistical-analysis/run"
            "?variable_x=groupsize&variable_y=func_land"
        ).get_json()["data"]

        self.assertEqual(
            data["statistical_test"]["name"], "Mann-Whitney U Test"
        )
        self.assertEqual(
            data["statistical_test"]["effect_size"]["name"],
            "Rank-biserial correlation",
        )
        self.assertFalse(
            data["normality_assessment"]["all_groups_normal"]
        )

    @patch("routes.api.fetch_all")
    def test_numeric_multicategory_selects_kruskal_wallis(
        self, fetch_all
    ) -> None:
        fetch_all.return_value = [
            {"variable_x": country, "variable_y": value}
            for country, values in (
                ("Kenya", [10, 20, 30]),
                ("Nigeria", [40, 50, 60]),
                ("Ghana", [70, 80, 90]),
            )
            for value in values
        ]

        data = self.client.get(
            "/api/statistical-analysis/run"
            "?variable_x=country&variable_y=groupsize"
        ).get_json()["data"]

        self.assertEqual(data["analysis_type"], "numeric_categorical")
        self.assertEqual(
            data["statistical_test"]["name"], "Kruskal-Wallis Test"
        )
        self.assertEqual(data["statistical_test"]["degrees_of_freedom"], 2)
        self.assertEqual(
            data["statistical_test"]["effect_size"]["name"],
            "Epsilon-squared",
        )
        self.assertEqual(len(data["charts"]["box_plot"]["items"]), 3)
        self.assertIsNone(data["charts"]["histogram"])

    @patch("routes.api.fetch_all")
    def test_invalid_variables_are_rejected_before_query(self, fetch_all) -> None:
        cases = [
            "/api/statistical-analysis/run",
            (
                "/api/statistical-analysis/run"
                "?variable_x=groupsize&variable_y=unknown"
            ),
            (
                "/api/statistical-analysis/run"
                "?variable_x=groupsize&variable_y=groupsize"
            ),
        ]
        for url in cases:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 400)
                self.assertFalse(response.get_json()["success"])
        fetch_all.assert_not_called()

    @patch("routes.api.fetch_all")
    def test_no_complete_rows_returns_safe_422(self, fetch_all) -> None:
        fetch_all.return_value = [
            {"variable_x": None, "variable_y": 1},
            {"variable_x": 10, "variable_y": None},
            {"variable_x": "invalid", "variable_y": 0},
        ]

        response = self.client.get(
            "/api/statistical-analysis/run"
            "?variable_x=groupsize&variable_y=king"
        )

        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.get_json()["success"])
        self.assertNotIn("data", response.get_json())

    def test_numeric_pair_selects_pearson_when_normal(self) -> None:
        data = pd.DataFrame({
            "variable_x": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0],
            "variable_y": [2.0, 4.0, 5.0, 8.0, 9.0, 12.0],
        })
        normal = {
            "method": "Shapiro-Wilk test",
            "sample_size": 6,
            "statistic": 0.95,
            "p_value": 0.2,
            "normal": True,
            "assessable": True,
        }
        with patch("statistical_engine._normality", return_value=normal):
            result = _numeric_numeric_result(data)

        self.assertEqual(
            result["statistical_test"]["name"], "Pearson Correlation"
        )
        self.assertEqual(result["charts"]["recommended"], "correlation")
        self.assertEqual(len(result["charts"]["scatter"]["points"]), 6)
        self.assertIsNotNone(
            result["charts"]["scatter"]["regression_line"]
        )

    def test_numeric_pair_selects_spearman_when_not_normal(self) -> None:
        data = pd.DataFrame({
            "variable_x": [1.0, 1.0, 1.0, 2.0, 10.0, 100.0],
            "variable_y": [4.0, 3.0, 2.0, 1.0, 0.0, -1.0],
        })
        non_normal = {
            "method": "Shapiro-Wilk test",
            "sample_size": 6,
            "statistic": 0.7,
            "p_value": 0.001,
            "normal": False,
            "assessable": True,
        }
        with patch("statistical_engine._normality", return_value=non_normal):
            result = _numeric_numeric_result(data)

        self.assertEqual(
            result["statistical_test"]["name"], "Spearman Correlation"
        )
        self.assertIn("not causation", result["interpretation"])


if __name__ == "__main__":
    unittest.main()
