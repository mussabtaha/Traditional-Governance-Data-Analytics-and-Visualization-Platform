"""Unit tests for the shared MySQL connection-pool helpers."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

import database.db as db


CONFIG = {
    "DB_POOL_NAME": "test_pool",
    "DB_POOL_SIZE": 2,
    "DB_HOST": "db.example",
    "DB_PORT": 3306,
    "DB_USER": "test_user",
    "DB_PASSWORD": "test_password",
    "DB_NAME": "tradgov_test",
}


class DatabaseLayerTests(unittest.TestCase):
    @patch("database.db.MySQLConnectionPool")
    def test_pool_uses_config_and_utf8mb4(self, pool_class) -> None:
        connection = MagicMock()
        pool_class.return_value.get_connection.return_value = connection

        db.init_pool(CONFIG)
        self.assertIs(db.get_connection(), connection)

        kwargs = pool_class.call_args.kwargs
        self.assertEqual(kwargs["database"], "tradgov_test")
        self.assertEqual(kwargs["charset"], "utf8mb4")
        self.assertEqual(kwargs["collation"], "utf8mb4_unicode_ci")
        self.assertTrue(kwargs["use_unicode"])
        self.assertNotIn("test_password", repr(kwargs).replace("'password': 'test_password'", ""))

    @patch("database.db.get_connection")
    def test_fetch_all_is_parameterized_and_closes_resources(
        self, get_connection
    ) -> None:
        connection = MagicMock()
        cursor = connection.cursor.return_value
        cursor.fetchall.return_value = [{"value": 1}]
        get_connection.return_value = connection

        rows = db.fetch_all("SELECT %s AS value", [1])

        self.assertEqual(rows, [{"value": 1}])
        cursor.execute.assert_called_once_with("SELECT %s AS value", (1,))
        cursor.close.assert_called_once()
        connection.close.assert_called_once()

    @patch("database.db.get_connection")
    def test_fetch_one_closes_resources_after_query_failure(
        self, get_connection
    ) -> None:
        connection = MagicMock()
        cursor = connection.cursor.return_value
        cursor.execute.side_effect = RuntimeError("database unavailable")
        get_connection.return_value = connection

        with self.assertRaises(RuntimeError):
            db.fetch_one("SELECT 1")

        cursor.close.assert_called_once()
        connection.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()

