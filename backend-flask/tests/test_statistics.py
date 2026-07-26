"""Contract tests for the filtered statistics endpoint."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app import app


SUMMARY_ROW = {
    "total_groups": 12,
    "total_countries": 3,
    "total_continents": 1,
    "total_regions": 2,
    "groups_with_tpi": 9,
    "recognized": 7,
    "not_recognized": 4,
    "recognition_missing": 1,
    "king": 3,
    "chief": 6,
    "headman": 2,
    "land": 5,
    "security": 4,
    "healing": 2,
}


class StatisticsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_all")
    @patch("routes.api.fetch_one")
    def test_all_data_returns_one_combined_response(self, fetch_one, fetch_all) -> None:
        fetch_one.return_value = SUMMARY_ROW
        fetch_all.side_effect = [
            [{"label": "Africa", "total_groups": 12}],
            [{"id": 1, "group_name": "Example", "groupsize": 1000}],
            [{"country": "Kenya", "total_groups": 7}],
        ]

        response = self.client.get("/api/statistics")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["data"]["scope"], {
            "type": "all",
            "value": None,
            "label": "All Data",
        })
        self.assertEqual(payload["data"]["summary"]["total_groups"], 12)
        self.assertEqual(
            payload["data"]["geographic_distribution"]["type"],
            "continent",
        )
        self.assertEqual(len(payload["data"]["largest_groups"]), 1)
        self.assertEqual(len(payload["data"]["top_countries"]), 1)
        self.assertEqual(fetch_one.call_count, 1)
        self.assertEqual(fetch_all.call_count, 3)

    @patch("routes.api.fetch_all")
    @patch("routes.api.fetch_one")
    def test_each_supported_scope_is_filtered_in_sql(self, fetch_one, fetch_all) -> None:
        for scope, value, expected_distribution in (
            ("country", "Kenya", None),
            ("continent", "Africa", "region"),
            ("region", "East Africa", "country"),
        ):
            with self.subTest(scope=scope):
                fetch_one.reset_mock()
                fetch_all.reset_mock()
                fetch_one.side_effect = [{"value": value}, SUMMARY_ROW]
                fetch_all.side_effect = (
                    [[{"id": 1, "group_name": "Example", "groupsize": 1000}]]
                    if scope == "country"
                    else [
                        [{"label": "Example area", "total_groups": 12}],
                        [{"id": 1, "group_name": "Example", "groupsize": 1000}],
                        [{"country": "Kenya", "total_groups": 7}],
                    ]
                )

                response = self.client.get(
                    "/api/statistics",
                    query_string={scope: value},
                )

                self.assertEqual(response.status_code, 200)
                data = response.get_json()["data"]
                self.assertEqual(data["scope"]["type"], scope)
                self.assertEqual(data["scope"]["value"], value)
                self.assertEqual(
                    data["geographic_distribution"]["type"],
                    expected_distribution,
                )
                if scope == "country":
                    self.assertEqual(data["top_countries"], [])

                validation_query, validation_parameters = fetch_one.call_args_list[0].args
                self.assertIn(f"WHERE {scope} = %s", validation_query)
                self.assertNotIn(value, validation_query)
                self.assertEqual(validation_parameters, [value])

                summary_query, summary_parameters = fetch_one.call_args_list[1].args
                self.assertIn(f"WHERE {scope} = %s", summary_query)
                self.assertNotIn(value, summary_query)
                self.assertEqual(summary_parameters, [value])

    def test_conflicting_scope_filters_are_rejected(self) -> None:
        response = self.client.get(
            "/api/statistics?country=Kenya&continent=Africa"
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.get_json()["success"])

    def test_empty_scope_value_is_rejected(self) -> None:
        response = self.client.get("/api/statistics?region=")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.get_json()["success"])

    @patch("routes.api.fetch_one")
    def test_unknown_database_value_is_rejected(self, fetch_one) -> None:
        fetch_one.return_value = None
        response = self.client.get("/api/statistics?continent=Atlantis")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.get_json()["success"])
        fetch_one.assert_called_once()

    @patch("routes.api.fetch_all")
    @patch("routes.api.fetch_one")
    def test_empty_result_set_is_returned_safely(self, fetch_one, fetch_all) -> None:
        fetch_one.side_effect = [
            {"value": "Kenya"},
            {
                key: 0
                for key in SUMMARY_ROW
            },
        ]
        fetch_all.return_value = []

        response = self.client.get("/api/statistics?country=Kenya")

        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]
        self.assertEqual(data["summary"]["total_groups"], 0)
        self.assertEqual(data["largest_groups"], [])
        self.assertEqual(data["top_countries"], [])

    @patch("routes.api.fetch_all")
    @patch("routes.api.fetch_one")
    def test_queries_are_bounded_and_do_not_use_n_plus_one(
        self,
        fetch_one,
        fetch_all,
    ) -> None:
        fetch_one.side_effect = [{"value": "Africa"}, SUMMARY_ROW]
        fetch_all.side_effect = [[], [], []]

        response = self.client.get("/api/statistics?continent=Africa")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(fetch_one.call_count, 2)
        self.assertEqual(fetch_all.call_count, 3)
        for call in [*fetch_one.call_args_list, *fetch_all.call_args_list]:
            query = call.args[0]
            self.assertNotIn("Africa", query)


if __name__ == "__main__":
    unittest.main()
