"""Cross-cutting API contract tests for every statistical endpoint."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app import app


ENDPOINTS = [
    "/api/statistical-analysis/leadership-recognition",
    "/api/statistical-analysis/leadership-functions",
    "/api/statistical-analysis/groupsize-recognition",
    "/api/statistical-analysis/groupsize-functions",
    "/api/statistical-analysis/continent-leadership",
    "/api/statistical-analysis/region-recognition",
    "/api/statistical-analysis/run",
    "/api/statistical-analysis/continent-recognition",
]


class StatisticalApiIntegrationContractTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def test_all_endpoints_reject_unsupported_parameters(self) -> None:
        for endpoint in ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint + "?unexpected=value")
                self.assertEqual(response.status_code, 400)
                payload = response.get_json()
                self.assertFalse(payload["success"])
                self.assertIn("Unsupported", payload["message"])

    @patch("routes.api.fetch_all")
    def test_database_failure_returns_safe_500_json(self, fetch_all) -> None:
        fetch_all.side_effect = RuntimeError(
            "database failed with password=must-never-be-returned"
        )

        with self.assertLogs("app", level="ERROR") as captured:
            response = self.client.get(
                "/api/statistical-analysis/continent-recognition"
            )

        self.assertEqual(response.status_code, 500)
        self.assertNotIn("password", " ".join(captured.output))
        payload = response.get_json()
        self.assertEqual(
            payload,
            {
                "success": False,
                "message": "An internal server error occurred.",
            },
        )
        self.assertNotIn("password", response.get_data(as_text=True))

    @patch("routes.api.fetch_all")
    def test_expected_frequency_warning_is_returned(self, fetch_all) -> None:
        fetch_all.return_value = [
            {"continent": "Africa", "formackn": 1},
            {"continent": "Africa", "formackn": 0},
            {"continent": "Asia", "formackn": 1},
            {"continent": "Asia", "formackn": 0},
        ]

        test = self.client.get(
            "/api/statistical-analysis/continent-recognition"
        ).get_json()["data"]["statistical_test"]

        self.assertIn(
            "More than 20% of expected frequencies are below 5.",
            test["assumption_warnings"],
        )


if __name__ == "__main__":
    unittest.main()

