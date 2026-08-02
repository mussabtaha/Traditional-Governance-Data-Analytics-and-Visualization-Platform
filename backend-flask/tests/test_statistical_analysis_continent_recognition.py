"""Contract tests for continent/formal-recognition statistical analysis."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app import app


ROWS = [
    {"continent": "Africa", "formackn": 1},
    {"continent": "Africa", "formackn": 1},
    {"continent": "Africa", "formackn": 0},
    {"continent": "Asia", "formackn": 1},
    {"continent": "Asia", "formackn": 0},
    {"continent": "Asia", "formackn": 0},
    {"continent": "Europe", "formackn": 1},
    {"continent": "Europe", "formackn": 0},
    {"continent": None, "formackn": 1},
    {"continent": "Oceania", "formackn": None},
]


class ContinentRecognitionApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_all")
    def test_aggregation_and_missing_values(self, fetch_all) -> None:
        fetch_all.return_value = ROWS
        response = self.client.get(
            "/api/statistical-analysis/continent-recognition"
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]
        self.assertEqual(
            data["data_preparation"],
            {
                "total_observations": 10,
                "missing_observations_removed": 2,
                "final_sample_size": 8,
                "policy": (
                    "Only records with a non-blank continent and binary formackn "
                    "value (0 or 1) are included."
                ),
            },
        )
        africa, asia, europe = data["descriptive_statistics"]
        self.assertEqual(africa["continent"], "Africa")
        self.assertEqual(africa["total_groups"], 3)
        self.assertEqual(africa["recognized"], 2)
        self.assertEqual(africa["not_recognized"], 1)
        self.assertAlmostEqual(africa["recognition_percentage"], 200 / 3)
        self.assertAlmostEqual(asia["recognition_percentage"], 100 / 3)
        self.assertEqual(europe["recognition_percentage"], 50.0)
        self.assertEqual(fetch_all.call_count, 1)

    @patch("routes.api.fetch_all")
    def test_chi_square_calculation(self, fetch_all) -> None:
        fetch_all.return_value = ROWS
        test = self.client.get(
            "/api/statistical-analysis/continent-recognition"
        ).get_json()["data"]["statistical_test"]

        self.assertEqual(
            test["contingency_table"]["observed"],
            [[2, 1], [1, 2], [1, 1]],
        )
        self.assertEqual(
            test["contingency_table"]["expected"],
            [[1.5, 1.5], [1.5, 1.5], [1.0, 1.0]],
        )
        self.assertAlmostEqual(test["chi_square"], 2 / 3)
        self.assertEqual(test["degrees_of_freedom"], 2)
        self.assertAlmostEqual(test["cramers_v"], (1 / 12) ** 0.5)
        self.assertEqual(test["sample_size"], 8)

    @patch("routes.api.fetch_all")
    def test_summary_and_chart_response(self, fetch_all) -> None:
        fetch_all.return_value = ROWS
        payload = self.client.get(
            "/api/statistical-analysis/continent-recognition"
        ).get_json()

        self.assertTrue(payload["success"])
        data = payload["data"]
        self.assertEqual(data["summary"]["total_continents"], 3)
        self.assertEqual(
            data["summary"]["highest_recognition_rate"]["continent"],
            "Africa",
        )
        self.assertEqual(
            data["summary"]["lowest_recognition_rate"]["continent"],
            "Asia",
        )
        stacked = data["charts"]["percentage_stacked"]
        self.assertEqual(len(stacked["datasets"]), 2)
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
            {"continent": "Africa", "formackn": 1},
            {"continent": "Asia", "formackn": 1},
        ]
        response = self.client.get(
            "/api/statistical-analysis/continent-recognition"
        )
        test = response.get_json()["data"]["statistical_test"]

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(test["chi_square"])
        self.assertIsNone(test["p_value"])
        self.assertIsNotNone(test["reason"])


if __name__ == "__main__":
    unittest.main()

