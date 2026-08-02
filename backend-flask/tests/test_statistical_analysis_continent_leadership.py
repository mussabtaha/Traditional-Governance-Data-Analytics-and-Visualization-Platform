"""Contract tests for continent/leadership statistical analysis."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app import app


ROWS = [
    {"continent": "Africa", "king": 1, "chief": 0, "headman": 0},
    {"continent": "Africa", "king": 0, "chief": 1, "headman": 1},
    {"continent": "Asia", "king": 1, "chief": 0, "headman": 0},
    {"continent": "Asia", "king": 0, "chief": 1, "headman": 0},
    {"continent": "Asia", "king": 0, "chief": 1, "headman": 1},
    {"continent": None, "king": 1, "chief": 1, "headman": 1},
    {"continent": "  ", "king": 1, "chief": 1, "headman": 1},
]


class ContinentLeadershipApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_all")
    def test_continent_aggregation_and_missing_values(self, fetch_all) -> None:
        fetch_all.return_value = ROWS
        response = self.client.get(
            "/api/statistical-analysis/continent-leadership"
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]
        self.assertEqual(
            data["data_preparation"],
            {
                "total_observations": 7,
                "missing_observations_removed": 2,
                "final_sample_size": 5,
                "policy": "Records with a missing or blank continent are excluded.",
            },
        )
        africa, asia = data["descriptive_statistics"]
        self.assertEqual(africa["continent"], "Africa")
        self.assertEqual(africa["total_groups"], 2)
        self.assertEqual(
            africa["counts"], {"king": 1, "chief": 1, "headman": 1}
        )
        self.assertEqual(africa["percentages"]["king"], 50.0)
        self.assertEqual(
            asia["counts"], {"king": 1, "chief": 2, "headman": 1}
        )
        self.assertEqual(fetch_all.call_count, 1)

    @patch("routes.api.fetch_all")
    def test_chi_square_values_are_correct(self, fetch_all) -> None:
        fetch_all.return_value = ROWS
        test = self.client.get(
            "/api/statistical-analysis/continent-leadership"
        ).get_json()["data"]["statistical_test"]

        self.assertEqual(
            test["contingency_table"]["observed"],
            [[1, 1, 1], [1, 2, 1]],
        )
        expected = test["contingency_table"]["expected"]
        self.assertAlmostEqual(expected[0][0], 6 / 7)
        self.assertAlmostEqual(expected[0][1], 9 / 7)
        self.assertAlmostEqual(test["chi_square"], 7 / 36)
        self.assertEqual(test["degrees_of_freedom"], 2)
        self.assertAlmostEqual(test["cramers_v"], 1 / 6)
        self.assertEqual(test["sample_size"], 7)
        self.assertEqual(test["group_sample_size"], 5)

    @patch("routes.api.fetch_all")
    def test_response_contains_summary_and_chart_datasets(self, fetch_all) -> None:
        fetch_all.return_value = ROWS
        payload = self.client.get(
            "/api/statistical-analysis/continent-leadership"
        ).get_json()

        self.assertTrue(payload["success"])
        data = payload["data"]
        self.assertEqual(data["summary"]["total_groups"], 5)
        self.assertEqual(
            data["summary"]["dominant_leadership_type"], "Chiefs"
        )
        self.assertEqual(data["summary"]["number_of_continents"], 2)
        self.assertEqual(
            data["variables"]["leadership"], ["king", "chief", "headman"]
        )
        self.assertEqual(len(data["charts"]["grouped_bar"]["datasets"]), 3)
        self.assertEqual(
            len(data["charts"]["percentage_stacked"]["datasets"]), 3
        )
        africa_percentages = [
            dataset["values"][0]
            for dataset in data["charts"]["percentage_stacked"]["datasets"]
        ]
        self.assertAlmostEqual(sum(africa_percentages), 100.0)

    @patch("routes.api.fetch_all")
    def test_insufficient_variation_returns_safe_result(self, fetch_all) -> None:
        fetch_all.return_value = [
            {"continent": "Africa", "king": 1, "chief": 0, "headman": 0},
            {"continent": None, "king": 0, "chief": 1, "headman": 1},
        ]
        response = self.client.get(
            "/api/statistical-analysis/continent-leadership"
        )
        test = response.get_json()["data"]["statistical_test"]

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(test["chi_square"])
        self.assertIsNone(test["p_value"])
        self.assertIsNotNone(test["reason"])


if __name__ == "__main__":
    unittest.main()

