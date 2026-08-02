"""Contract tests for region/formal-recognition statistical analysis."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app import app


ROWS = [
    {"region": "East Africa", "formackn": 1},
    {"region": "East Africa", "formackn": 1},
    {"region": "East Africa", "formackn": 0},
    {"region": "East Africa", "formackn": None},
    {"region": "West Africa", "formackn": 1},
    {"region": "West Africa", "formackn": 0},
    {"region": "West Africa", "formackn": 0},
    {"region": "West Africa", "formackn": None},
    {"region": "Europe", "formackn": 1},
    {"region": "Europe", "formackn": 0},
    {"region": None, "formackn": 1},
]


class RegionRecognitionApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_all")
    def test_aggregation_and_missing_values(self, fetch_all) -> None:
        fetch_all.return_value = ROWS
        response = self.client.get(
            "/api/statistical-analysis/region-recognition"
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]
        preparation = data["data_preparation"]
        self.assertEqual(preparation["total_observations"], 11)
        self.assertEqual(preparation["missing_observations_removed"], 3)
        self.assertEqual(preparation["final_sample_size"], 8)
        self.assertEqual(preparation["missing_region"], 1)
        self.assertEqual(preparation["missing_recognition"], 2)

        east, europe, west = data["descriptive_statistics"]
        self.assertEqual(east["region"], "East Africa")
        self.assertEqual(east["total_groups"], 4)
        self.assertEqual(east["recognized"], 2)
        self.assertEqual(east["not_recognized"], 1)
        self.assertEqual(east["missing_recognition"], 1)
        self.assertAlmostEqual(east["recognition_percentage"], 200 / 3)
        self.assertEqual(europe["recognition_percentage"], 50.0)
        self.assertAlmostEqual(west["recognition_percentage"], 100 / 3)
        fetch_all.assert_called_once_with(
            "SELECT region, formackn FROM tradgov_groups"
        )

    @patch("routes.api.fetch_all")
    def test_chi_square_calculation(self, fetch_all) -> None:
        fetch_all.return_value = ROWS
        test = self.client.get(
            "/api/statistical-analysis/region-recognition"
        ).get_json()["data"]["statistical_test"]

        self.assertEqual(
            test["contingency_table"]["observed"],
            [[2, 1], [1, 1], [1, 2]],
        )
        self.assertEqual(
            test["contingency_table"]["expected"],
            [[1.5, 1.5], [1.0, 1.0], [1.5, 1.5]],
        )
        self.assertAlmostEqual(test["chi_square"], 2 / 3)
        self.assertEqual(test["degrees_of_freedom"], 2)
        self.assertAlmostEqual(test["cramers_v"], (1 / 12) ** 0.5)
        self.assertEqual(test["sample_size"], 8)

    @patch("routes.api.fetch_all")
    def test_summary_and_chart_response(self, fetch_all) -> None:
        fetch_all.return_value = ROWS
        payload = self.client.get(
            "/api/statistical-analysis/region-recognition"
        ).get_json()

        self.assertTrue(payload["success"])
        data = payload["data"]
        summary = data["summary"]
        self.assertEqual(summary["total_regions"], 3)
        self.assertEqual(
            summary["highest_recognition_rate"]["region"],
            "East Africa",
        )
        self.assertEqual(
            summary["lowest_recognition_rate"]["region"],
            "West Africa",
        )
        self.assertEqual(summary["average_recognition_rate"], 50.0)

        stacked = data["charts"]["percentage_stacked"]
        self.assertEqual(len(stacked["datasets"]), 3)
        for index in range(len(stacked["labels"])):
            self.assertAlmostEqual(
                sum(dataset["values"][index] for dataset in stacked["datasets"]),
                100.0,
            )
        self.assertEqual(
            len(data["charts"]["recognition_heatmap"]["items"]), 3
        )

    @patch("routes.api.fetch_all")
    def test_insufficient_variation_returns_safe_result(self, fetch_all) -> None:
        fetch_all.return_value = [
            {"region": "East Africa", "formackn": 1},
            {"region": "West Africa", "formackn": 1},
            {"region": "West Africa", "formackn": None},
        ]
        response = self.client.get(
            "/api/statistical-analysis/region-recognition"
        )
        test = response.get_json()["data"]["statistical_test"]

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(test["chi_square"])
        self.assertIsNone(test["p_value"])
        self.assertIsNotNone(test["reason"])


if __name__ == "__main__":
    unittest.main()
