"""Contract tests for leadership-recognition statistical analysis."""

from __future__ import annotations

import math
import unittest
from unittest.mock import patch

from app import app


AGGREGATE_ROW = {
    "total_rows": 110,
    "formackn_missing": 10,
    "king_missing": 0,
    "king_excluded": 10,
    "king_present_recognized": 30,
    "king_present_not_recognized": 10,
    "king_absent_recognized": 20,
    "king_absent_not_recognized": 40,
    "king_present_recognition_missing": 4,
    "chief_missing": 0,
    "chief_excluded": 10,
    "chief_present_recognized": 25,
    "chief_present_not_recognized": 25,
    "chief_absent_recognized": 25,
    "chief_absent_not_recognized": 25,
    "chief_present_recognition_missing": 3,
    "headman_missing": 2,
    "headman_excluded": 12,
    "headman_present_recognized": 18,
    "headman_present_not_recognized": 22,
    "headman_absent_recognized": 30,
    "headman_absent_not_recognized": 28,
    "headman_present_recognition_missing": 2,
}


class StatisticalAnalysisApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_one")
    def test_response_contains_three_complete_analyses(self, fetch_one) -> None:
        fetch_one.return_value = AGGREGATE_ROW

        response = self.client.get(
            "/api/statistical-analysis/leadership-recognition"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["success"])
        data = payload["data"]
        self.assertEqual(
            data["research_question"],
            "Is leadership type associated with formal state recognition?",
        )
        self.assertEqual(data["method"]["name"], "Pearson Chi-Square Test of Independence")
        self.assertEqual([item["variable"] for item in data["analyses"]], [
            "king",
            "chief",
            "headman",
        ])
        for analysis in data["analyses"]:
            self.assertIn("contingency_table", analysis)
            self.assertIn("p_value", analysis)
            self.assertIn("cramers_v", analysis)
            self.assertIn("interpretation", analysis)
        self.assertEqual(fetch_one.call_count, 1)

    @patch("routes.api.fetch_one")
    def test_king_contingency_table_and_statistics_are_correct(self, fetch_one) -> None:
        fetch_one.return_value = AGGREGATE_ROW

        data = self.client.get(
            "/api/statistical-analysis/leadership-recognition"
        ).get_json()["data"]
        king = data["analyses"][0]

        self.assertEqual(
            king["contingency_table"]["observed"],
            [[30, 10], [20, 40]],
        )
        self.assertEqual(
            king["contingency_table"]["expected"],
            [[20.0, 20.0], [30.0, 30.0]],
        )
        self.assertAlmostEqual(king["chi_square"], 16.666666666666668)
        self.assertEqual(king["degrees_of_freedom"], 1)
        self.assertAlmostEqual(king["p_value"], 0.000044558302763992)
        self.assertAlmostEqual(king["cramers_v"], math.sqrt(1 / 6))
        self.assertEqual(king["effect_strength"], "moderate")
        self.assertEqual(king["sample_size"], 100)
        self.assertTrue(king["significant"])

    @patch("routes.api.fetch_one")
    def test_missing_values_and_chart_data_are_reported(self, fetch_one) -> None:
        fetch_one.return_value = AGGREGATE_ROW

        data = self.client.get(
            "/api/statistical-analysis/leadership-recognition"
        ).get_json()["data"]

        self.assertEqual(data["data_quality"], {
            "total_rows": 110,
            "formal_recognition_missing": 10,
            "rows_with_recognition": 100,
            "policy": (
                "Rows with NULL formal recognition or NULL values in the tested "
                "leadership variable are excluded from that test."
            ),
        })
        headman = data["analyses"][2]
        self.assertEqual(headman["missing_values_excluded"], {
            "formal_recognition": 10,
            "leadership_variable": 2,
            "total_excluded": 12,
        })
        self.assertEqual(data["charts"]["stacked_bar"]["items"][0], {
            "variable": "king",
            "label": "King",
            "recognized": 30,
            "not_recognized": 10,
            "missing": 4,
        })
        king_heatmap = data["charts"]["heatmap"]["rows"][0]
        self.assertEqual(king_heatmap["recognized_percentage"], 75.0)
        self.assertEqual(king_heatmap["not_recognized_percentage"], 25.0)

    @patch("routes.api.fetch_one")
    def test_constant_table_returns_safe_noncomputable_result(self, fetch_one) -> None:
        constant_row = dict(AGGREGATE_ROW)
        constant_row.update(
            king_present_recognized=50,
            king_present_not_recognized=50,
            king_absent_recognized=0,
            king_absent_not_recognized=0,
        )
        fetch_one.return_value = constant_row

        king = self.client.get(
            "/api/statistical-analysis/leadership-recognition"
        ).get_json()["data"]["analyses"][0]

        self.assertIsNone(king["chi_square"])
        self.assertIsNone(king["p_value"])
        self.assertEqual(king["contingency_table"]["expected"], [])
        self.assertIn("could not be calculated", king["interpretation"])


if __name__ == "__main__":
    unittest.main()
