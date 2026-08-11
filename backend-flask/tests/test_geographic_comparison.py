"""Contract tests for live geographic entity comparisons."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app import app


AGGREGATE_ROWS = [
    {
        "entity": "Kenya",
        "total_groups": 20,
        "total_countries": 1,
        "groups_with_tpi": 16,
        "king": 4,
        "chief": 12,
        "headman": 3,
        "hereditary": 3,
        "elected": 1,
        "appointed": 0,
        "leadership_selection_missing": 1,
        "recognized": 14,
        "not_recognized": 4,
        "recognition_missing": 2,
        "land": 11,
        "security": 8,
        "healing": 6,
        "average_group_size": 125000.5,
        "largest_population": 900000,
    },
    {
        "entity": "Nigeria",
        "total_groups": 30,
        "total_countries": 1,
        "groups_with_tpi": 21,
        "king": 7,
        "chief": 15,
        "headman": 5,
        "hereditary": 5,
        "elected": 1,
        "appointed": 1,
        "leadership_selection_missing": 2,
        "recognized": 18,
        "not_recognized": 10,
        "recognition_missing": 2,
        "land": 17,
        "security": 13,
        "healing": 9,
        "average_group_size": 180000,
        "largest_population": 1200000,
    },
]
MEDIAN_ROWS = [
    {"entity": "Kenya", "median_group_size": 80000},
    {"entity": "Nigeria", "median_group_size": 110000},
]
LARGEST_ROWS = [
    {
        "id": 11,
        "entity": "Kenya",
        "group_name": "Largest Kenya Group",
        "group_name_ar": None,
        "groupsize": 900000,
    },
    {
        "id": 22,
        "entity": "Nigeria",
        "group_name": "Largest Nigeria Group",
        "group_name_ar": None,
        "groupsize": 1200000,
    },
]


class GeographicComparisonApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_all")
    def test_options_use_an_allowlisted_geographic_column(self, fetch_all) -> None:
        for comparison_type in ("country", "continent", "region"):
            with self.subTest(comparison_type=comparison_type):
                fetch_all.reset_mock()
                fetch_all.return_value = [{"value": "Example"}]

                response = self.client.get(
                    "/api/comparison/options",
                    query_string={"type": comparison_type},
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.get_json()["data"],
                    {"type": comparison_type, "options": ["Example"]},
                )
                query = fetch_all.call_args.args[0]
                self.assertIn(
                    f"SELECT DISTINCT {comparison_type} AS value",
                    query,
                )
                self.assertIn(f"TRIM({comparison_type}) <> ''", query)

    def test_obsolete_group_options_route_is_removed(self) -> None:
        response = self.client.get("/api/group-options")
        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.get_json()["success"])
    def test_invalid_type_and_extra_parameters_are_rejected(self) -> None:
        invalid_type = self.client.get("/api/comparison/options?type=group")
        self.assertEqual(invalid_type.status_code, 400)

        extra = self.client.get(
            "/api/comparison/options?type=country&unexpected=true"
        )
        self.assertEqual(extra.status_code, 400)

    @patch("routes.api.fetch_all")
    def test_country_comparison_returns_complete_live_aggregation(
        self,
        fetch_all,
    ) -> None:
        fetch_all.side_effect = [AGGREGATE_ROWS, MEDIAN_ROWS, LARGEST_ROWS]

        response = self.client.get(
            "/api/comparison",
            query_string={
                "type": "country",
                "entity_a": "Kenya",
                "entity_b": "Nigeria",
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]
        self.assertEqual(data["comparison_type"], "country")
        self.assertEqual(data["entities"], ["Kenya", "Nigeria"])
        self.assertEqual(len(data["profiles"]), 2)
        kenya = data["profiles"][0]
        self.assertEqual(kenya["general"]["total_groups"], 20)
        self.assertIsNone(kenya["general"]["total_countries"])
        self.assertEqual(kenya["recognition"]["rate"], 77.78)
        self.assertEqual(kenya["population"]["median_group_size"], 80000.0)
        self.assertEqual(
            kenya["population"]["largest_group"]["group_name"],
            "Largest Kenya Group",
        )
        self.assertEqual(data["charts"]["leadership"]["chief"], [12, 15])
        self.assertEqual(len(data["charts"]["radar"]["datasets"]), 2)

        self.assertEqual(fetch_all.call_count, 3)
        median_query = fetch_all.call_args_list[1].args[0]
        largest_query = fetch_all.call_args_list[2].args[0]
        self.assertIn("AS position_index", median_query)
        self.assertIn("AS partition_size", median_query)
        self.assertIn("AS rank_position", largest_query)
        self.assertNotIn("AS row_number", median_query + largest_query)
        for call in fetch_all.call_args_list:
            query, parameters = call.args
            self.assertIn("country", query)
            self.assertNotIn("Kenya", query)
            self.assertNotIn("Nigeria", query)
            self.assertEqual(parameters, ["Kenya", "Nigeria"])

    @patch("routes.api.fetch_all")
    def test_continent_and_region_include_country_coverage(self, fetch_all) -> None:
        for comparison_type in ("continent", "region"):
            with self.subTest(comparison_type=comparison_type):
                rows = [dict(row) for row in AGGREGATE_ROWS]
                rows[0]["total_countries"] = 12
                rows[1]["total_countries"] = 8
                fetch_all.reset_mock()
                fetch_all.side_effect = [rows, MEDIAN_ROWS, LARGEST_ROWS]

                response = self.client.get(
                    "/api/comparison",
                    query_string={
                        "type": comparison_type,
                        "entity_a": "Kenya",
                        "entity_b": "Nigeria",
                    },
                )

                self.assertEqual(response.status_code, 200)
                profiles = response.get_json()["data"]["profiles"]
                self.assertEqual(profiles[0]["general"]["total_countries"], 12)
                self.assertEqual(profiles[1]["general"]["total_countries"], 8)

    @patch("routes.api.fetch_all")
    def test_unknown_and_duplicate_entities_are_rejected(self, fetch_all) -> None:
        duplicate = self.client.get(
            "/api/comparison?type=country&entity_a=Kenya&entity_b=Kenya"
        )
        self.assertEqual(duplicate.status_code, 400)
        fetch_all.assert_not_called()

        fetch_all.return_value = AGGREGATE_ROWS[:1]
        unknown = self.client.get(
            "/api/comparison?type=country&entity_a=Kenya&entity_b=Atlantis"
        )
        self.assertEqual(unknown.status_code, 400)
        self.assertIn("Unknown country", unknown.get_json()["message"])
        self.assertEqual(fetch_all.call_count, 1)

    def test_missing_entity_is_rejected(self) -> None:
        response = self.client.get(
            "/api/comparison?type=country&entity_a=Kenya"
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.get_json()["success"])


if __name__ == "__main__":
    unittest.main()