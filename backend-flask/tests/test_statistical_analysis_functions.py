"""Contract tests for leadership/governance-function statistical analysis."""

from __future__ import annotations

import math
import unittest
from unittest.mock import patch

from app import app


LEADERSHIPS = ("king", "chief", "headman")
FUNCTIONS = ("land", "security", "healing")


def aggregate_row() -> dict[str, int]:
    """Build nine valid 2x2 tables and explicit missing-value counts."""

    row = {"total_rows": 108}
    for leadership in LEADERSHIPS:
        for function_name in FUNCTIONS:
            prefix = f"{leadership}_{function_name}"
            row.update(
                {
                    f"{prefix}_leadership_missing": 4,
                    f"{prefix}_function_missing": 6,
                    f"{prefix}_excluded": 8,
                    f"{prefix}_present_present": 25,
                    f"{prefix}_present_absent": 25,
                    f"{prefix}_absent_present": 25,
                    f"{prefix}_absent_absent": 25,
                }
            )

    row.update(
        king_land_present_present=30,
        king_land_present_absent=10,
        king_land_absent_present=20,
        king_land_absent_absent=40,
    )
    return row


class LeadershipFunctionsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_one")
    def test_response_contains_all_nine_analyses_and_chart_data(self, fetch_one) -> None:
        fetch_one.return_value = aggregate_row()

        response = self.client.get(
            "/api/statistical-analysis/leadership-functions"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["success"])
        data = payload["data"]
        self.assertEqual(len(data["analyses"]), 9)
        self.assertEqual(len(data["summary"]), 9)
        self.assertEqual(
            [item["analysis_id"] for item in data["analyses"]],
            [
                f"{leadership}_{function_name}"
                for leadership in LEADERSHIPS
                for function_name in FUNCTIONS
            ],
        )
        self.assertEqual(
            len(data["charts"]["cramers_v_heatmap"]["values"]),
            9,
        )
        self.assertEqual(fetch_one.call_count, 1)
        query = fetch_one.call_args.args[0]
        self.assertIn("func_land", query)
        self.assertIn("func_sec", query)
        self.assertIn("kingheal", query)

    @patch("routes.api.fetch_one")
    def test_king_land_chi_square_values_are_correct(self, fetch_one) -> None:
        fetch_one.return_value = aggregate_row()

        data = self.client.get(
            "/api/statistical-analysis/leadership-functions"
        ).get_json()["data"]
        king_land = data["analyses"][0]

        self.assertEqual(king_land["analysis_id"], "king_land")
        self.assertEqual(
            king_land["contingency_table"]["observed"],
            [[30, 10], [20, 40]],
        )
        self.assertEqual(
            king_land["contingency_table"]["expected"],
            [[20.0, 20.0], [30.0, 30.0]],
        )
        self.assertAlmostEqual(king_land["chi_square"], 16.666666666666668)
        self.assertEqual(king_land["degrees_of_freedom"], 1)
        self.assertAlmostEqual(king_land["p_value"], 0.000044558302763992)
        self.assertAlmostEqual(king_land["cramers_v"], math.sqrt(1 / 6))
        self.assertEqual(king_land["effect_strength"], "moderate")
        self.assertEqual(king_land["sample_size"], 100)
        self.assertTrue(king_land["significant"])
        rates = king_land["function_present_percentages"]
        self.assertEqual(rates["leadership_present"], 75.0)
        self.assertAlmostEqual(rates["leadership_absent"], 100 / 3)

    @patch("routes.api.fetch_one")
    def test_null_exclusions_and_summary_are_reported_per_pair(self, fetch_one) -> None:
        fetch_one.return_value = aggregate_row()

        data = self.client.get(
            "/api/statistical-analysis/leadership-functions"
        ).get_json()["data"]
        headman_healing = data["analyses"][-1]

        self.assertEqual(data["data_quality"]["total_rows"], 108)
        self.assertEqual(
            headman_healing["missing_values_excluded"],
            {
                "leadership_variable": 4,
                "governance_function": 6,
                "total_excluded": 8,
            },
        )
        self.assertEqual(headman_healing["sample_size"], 100)
        self.assertFalse(headman_healing["significant"])
        self.assertEqual(headman_healing["effect_strength"], "very weak")
        self.assertEqual(
            [item["analysis_id"] for item in data["charts"]["significant_relationships"]["items"]],
            ["king_land"],
        )


if __name__ == "__main__":
    unittest.main()
