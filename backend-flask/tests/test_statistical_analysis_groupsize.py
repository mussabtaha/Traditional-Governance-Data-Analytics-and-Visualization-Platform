"""Contract tests for group-size/formal-recognition statistical analysis."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app import app


class GroupSizeRecognitionApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_all")
    def test_descriptive_statistics_and_missing_values_are_correct(
        self, fetch_all
    ) -> None:
        fetch_all.return_value = [
            {"groupsize": value, "formackn": recognition}
            for recognition, values in (
                (1, [10, 20, 30, 40]),
                (0, [5, 15, 25, 35]),
            )
            for value in values
        ] + [
            {"groupsize": None, "formackn": 1},
            {"groupsize": 100, "formackn": None},
            {"groupsize": "invalid", "formackn": 0},
            {"groupsize": 0, "formackn": 1},
        ]

        response = self.client.get(
            "/api/statistical-analysis/groupsize-recognition"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["success"])
        data = payload["data"]
        self.assertEqual(
            data["data_preparation"],
            {
                "total_observations": 12,
                "excluded_observations": 4,
                "final_sample_size": 8,
                "policy": (
                    "Only records with a positive numeric groupsize and a binary "
                    "formackn value (0 or 1) are included."
                ),
            },
        )
        recognized = data["descriptive_statistics"]["recognized"]
        self.assertEqual(recognized["count"], 4)
        self.assertEqual(recognized["mean"], 25.0)
        self.assertEqual(recognized["median"], 25.0)
        self.assertEqual(recognized["minimum"], 10.0)
        self.assertEqual(recognized["maximum"], 40.0)
        self.assertAlmostEqual(recognized["standard_deviation"], 12.9099444874)
        self.assertEqual(recognized["interquartile_range"], 15.0)
        self.assertEqual(fetch_all.call_count, 1)
        self.assertIn("groupsize", fetch_all.call_args.args[0])
        self.assertIn("formackn", fetch_all.call_args.args[0])

    @patch("routes.api.fetch_all")
    def test_normal_distributions_select_welch_t_test(self, fetch_all) -> None:
        fetch_all.return_value = [
            {"groupsize": value, "formackn": recognition}
            for recognition, values in (
                (1, [10, 20, 30, 40, 50, 60]),
                (0, [5, 15, 25, 35, 45, 55]),
            )
            for value in values
        ]

        data = self.client.get(
            "/api/statistical-analysis/groupsize-recognition"
        ).get_json()["data"]

        self.assertTrue(data["normality_assessment"]["distributions_normal"])
        self.assertEqual(
            data["statistical_test"]["name"],
            "Welch's independent samples t-test",
        )
        self.assertEqual(
            data["statistical_test"]["effect_size"]["name"],
            "Point-biserial correlation",
        )
        self.assertEqual(data["statistical_test"]["sample_size"], 12)

    @patch("routes.api.fetch_all")
    def test_non_normal_distributions_select_mann_whitney(self, fetch_all) -> None:
        fetch_all.return_value = [
            {"groupsize": value, "formackn": 1}
            for value in ([1] * 9 + [1000])
        ] + [
            {"groupsize": value, "formackn": 0}
            for value in ([2] * 10)
        ]

        response = self.client.get(
            "/api/statistical-analysis/groupsize-recognition"
        )
        data = response.get_json()["data"]

        self.assertEqual(response.status_code, 200)
        self.assertFalse(data["normality_assessment"]["distributions_normal"])
        self.assertEqual(
            data["statistical_test"]["name"], "Mann-Whitney U Test"
        )
        self.assertEqual(
            data["statistical_test"]["effect_size"]["name"],
            "Rank-biserial correlation",
        )
        self.assertIsInstance(data["statistical_test"]["statistic"], float)
        self.assertIsInstance(data["statistical_test"]["p_value"], float)
        self.assertIn("box_plot", data["charts"])
        self.assertIn("histogram", data["charts"])
        self.assertEqual(len(data["charts"]["box_plot"]["items"]), 2)
        histogram = data["charts"]["histogram"]
        self.assertEqual(len(histogram["datasets"]), 2)
        self.assertEqual(
            len(histogram["bin_edges"]),
            len(histogram["datasets"][0]["counts"]) + 1,
        )

    @patch("routes.api.fetch_all")
    def test_insufficient_comparison_groups_returns_safe_error(self, fetch_all) -> None:
        fetch_all.return_value = [
            {"groupsize": 10, "formackn": 1},
            {"groupsize": None, "formackn": 0},
        ]

        response = self.client.get(
            "/api/statistical-analysis/groupsize-recognition"
        )

        self.assertEqual(response.status_code, 422)
        payload = response.get_json()
        self.assertFalse(payload["success"])
        self.assertNotIn("data", payload)


if __name__ == "__main__":
    unittest.main()
