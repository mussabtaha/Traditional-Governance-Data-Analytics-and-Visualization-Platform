"""Contract tests for population-size/governance-function analysis."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app import app


def function_rows(
    present_values: list[float],
    absent_values: list[float],
) -> list[dict[str, object]]:
    rows = []
    for indicator, values in ((1, present_values), (0, absent_values)):
        for value in values:
            rows.append(
                {
                    "groupsize": value,
                    "func_land": indicator,
                    "func_sec": indicator,
                    "kingheal": indicator,
                }
            )
    return rows


class GroupSizeFunctionsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_all")
    def test_response_contains_three_analyses_and_one_query(self, fetch_all) -> None:
        fetch_all.return_value = function_rows(
            [10, 20, 30, 40, 50, 60],
            [5, 15, 25, 35, 45, 55],
        )

        response = self.client.get(
            "/api/statistical-analysis/groupsize-functions"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["success"])
        data = payload["data"]
        self.assertEqual(
            [item["analysis_id"] for item in data["analyses"]],
            ["land", "security", "healing"],
        )
        self.assertEqual(len(data["summary"]), 3)
        self.assertEqual(
            data["variables"]["dependent"],
            ["func_land", "func_sec", "kingheal"],
        )
        self.assertEqual(fetch_all.call_count, 1)
        query = fetch_all.call_args.args[0]
        for column in ("groupsize", "func_land", "func_sec", "kingheal"):
            self.assertIn(column, query)

    @patch("routes.api.fetch_all")
    def test_descriptive_statistics_are_correct(self, fetch_all) -> None:
        fetch_all.return_value = function_rows(
            [10, 20, 30, 40],
            [5, 15, 25, 35],
        )

        data = self.client.get(
            "/api/statistical-analysis/groupsize-functions"
        ).get_json()["data"]
        land = data["analyses"][0]
        present = land["descriptive_statistics"]["function_present"]

        self.assertEqual(present["count"], 4)
        self.assertEqual(present["mean"], 25.0)
        self.assertEqual(present["median"], 25.0)
        self.assertEqual(present["minimum"], 10.0)
        self.assertEqual(present["maximum"], 40.0)
        self.assertAlmostEqual(present["standard_deviation"], 12.9099444874)
        self.assertEqual(present["interquartile_range"], 15.0)
        self.assertEqual(land["data_preparation"]["final_sample_size"], 8)

    @patch("routes.api.fetch_all")
    def test_normal_and_non_normal_paths_select_correct_tests(self, fetch_all) -> None:
        fetch_all.return_value = function_rows(
            [10, 20, 30, 40, 50, 60],
            [5, 15, 25, 35, 45, 55],
        )
        normal_data = self.client.get(
            "/api/statistical-analysis/groupsize-functions"
        ).get_json()["data"]
        self.assertTrue(
            all(
                item["statistical_test"]["name"]
                == "Welch's independent samples t-test"
                for item in normal_data["analyses"]
            )
        )

        fetch_all.return_value = function_rows([1] * 9 + [1000], [2] * 10)
        non_normal_data = self.client.get(
            "/api/statistical-analysis/groupsize-functions"
        ).get_json()["data"]
        self.assertTrue(
            all(
                item["statistical_test"]["name"] == "Mann-Whitney U Test"
                for item in non_normal_data["analyses"]
            )
        )
        for analysis in non_normal_data["analyses"]:
            self.assertEqual(
                analysis["statistical_test"]["effect_size"]["name"],
                "Rank-biserial correlation",
            )
            self.assertIn("box_plot", analysis["charts"])
            self.assertIn("histogram", analysis["charts"])

    @patch("routes.api.fetch_all")
    def test_null_values_are_excluded_per_function(self, fetch_all) -> None:
        rows = function_rows([10, 20, 30], [5, 15, 25])
        rows.extend(
            [
                {
                    "groupsize": None,
                    "func_land": 1,
                    "func_sec": 1,
                    "kingheal": 1,
                },
                {
                    "groupsize": 100,
                    "func_land": None,
                    "func_sec": 1,
                    "kingheal": 0,
                },
                {
                    "groupsize": 110,
                    "func_land": 1,
                    "func_sec": None,
                    "kingheal": 0,
                },
            ]
        )
        fetch_all.return_value = rows

        data = self.client.get(
            "/api/statistical-analysis/groupsize-functions"
        ).get_json()["data"]
        analyses = {item["analysis_id"]: item for item in data["analyses"]}

        self.assertEqual(
            analyses["land"]["data_preparation"],
            {
                "total_observations": 9,
                "missing_observations_removed": 2,
                "final_sample_size": 7,
            },
        )
        self.assertEqual(
            analyses["security"]["data_preparation"]["final_sample_size"], 7
        )
        self.assertEqual(
            analyses["healing"]["data_preparation"]["final_sample_size"], 8
        )
        self.assertEqual(
            analyses["healing"]["descriptive_statistics"]["function_absent"]["count"],
            5,
        )


if __name__ == "__main__":
    unittest.main()
