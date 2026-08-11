"""Contract tests for SQL-backed group pagination and filtering."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app import app


class GroupsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(TESTING=True)
        self.client = app.test_client()

    @patch("routes.api.fetch_all")
    @patch("routes.api.fetch_one")
    def test_filters_sorting_and_pagination_are_applied_in_sql(
        self,
        fetch_one,
        fetch_all,
    ) -> None:
        fetch_all.return_value = [
            {"id": 7, "group_name": "Example", "__total_items": 13}
        ]

        response = self.client.get(
            "/api/groups",
            query_string={
                "page": 2,
                "limit": 6,
                "search": "Example",
                "country": "Kenya",
                "continent": "Africa",
                "region": "Sub-Saharan Africa",
                "leadership": "Chief",
                "recognition": "1",
                "sort": "Population",
                "direction": "desc",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["data"]["pagination"], {
            "page": 2,
            "limit": 6,
            "total_items": 13,
            "total_pages": 3,
        })

        rows_query, rows_parameters = fetch_all.call_args.args
        self.assertIn("COUNT(*) OVER() AS __total_items", rows_query)
        self.assertIn("group_name LIKE %s", rows_query)
        self.assertIn("country = %s", rows_query)
        self.assertIn("continent = %s", rows_query)
        self.assertIn("region = %s", rows_query)
        self.assertIn("chief = 1", rows_query)
        self.assertIn("formackn = %s", rows_query)

        self.assertIn(
            "ORDER BY groupsize IS NULL ASC, groupsize DESC, id ASC",
            rows_query,
        )
        self.assertEqual(
            rows_parameters[:-2],
            [
                "%Example%",
                "%Example%",
                "%Example%",
                "Kenya",
                "Africa",
                "Sub-Saharan Africa",
                1,
            ],
        )
        self.assertEqual(rows_parameters[-2:], [6, 6])
        fetch_one.assert_not_called()

    @patch("routes.api.fetch_all")
    @patch("routes.api.fetch_one")
    def test_missing_recognition_uses_is_null(self, fetch_one, fetch_all) -> None:
        fetch_all.return_value = []

        response = self.client.get("/api/groups?recognition=missing")

        self.assertEqual(response.status_code, 200)
        self.assertIn("formackn IS NULL", fetch_all.call_args.args[0])
        self.assertEqual(response.get_json()["data"]["groups"], [])
        fetch_one.assert_not_called()

    @patch("routes.api.fetch_all")
    @patch("routes.api.fetch_one")
    def test_out_of_range_page_still_returns_the_real_total(
        self,
        fetch_one,
        fetch_all,
    ) -> None:
        fetch_all.return_value = []
        fetch_one.return_value = {"total": 11}

        response = self.client.get("/api/groups?page=3&limit=6")

        self.assertEqual(response.status_code, 200)
        pagination = response.get_json()["data"]["pagination"]
        self.assertEqual(pagination["total_items"], 11)
        self.assertEqual(pagination["total_pages"], 2)
        fetch_one.assert_called_once()

    def test_invalid_leadership_is_rejected(self) -> None:
        response = self.client.get("/api/groups?leadership=Mayor")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.get_json()["success"])

    def test_invalid_sort_direction_is_rejected(self) -> None:
        response = self.client.get("/api/groups?direction=sideways")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.get_json()["success"])

if __name__ == "__main__":
    unittest.main()
