"""Read-only audit for suspicious group-name encoding.

This script intentionally never writes to MySQL. It prints stored values and
their UTF-8 byte representation so proposed repairs can be reviewed first.
"""

from __future__ import annotations

import sys
import json
from urllib.request import urlopen

from database.db import fetch_all, fetch_one
from app import app


ALL_NAMES_SQL = r"""
SELECT id, country, group_name, HEX(group_name) AS group_name_hex
FROM tradgov_groups
ORDER BY id
"""


def is_suspicious(value: str | None) -> bool:
    if not value:
        return False
    markers = {"Ã", "Â", "�", "£"}
    return any(character in markers or 0x80 <= ord(character) <= 0x9F for character in value)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    with app.app_context():
        rows = [row for row in fetch_all(ALL_NAMES_SQL) if is_suspicious(row["group_name"])]
        reference_rows = fetch_all(
            """
            SELECT id, country, group_name, HEX(group_name) AS group_name_hex
            FROM tradgov_groups
            WHERE id IN (1053, 1367)
               OR country LIKE %s
            ORDER BY id
            """,
            ["C\u00f4te d%"],
        )
        backup = fetch_one(
            """
            SELECT COUNT(*) AS table_exists
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = %s
            """,
            ["tradgov_groups_backup_before_encoding_fix"],
        )

        changed_since_backup = []
        row_counts = None
        if backup and backup["table_exists"]:
            changed_since_backup = fetch_all(
                """
                SELECT current_row.id,
                       backup_row.group_name AS backup_group_name,
                       current_row.group_name AS current_group_name
                FROM tradgov_groups AS current_row
                INNER JOIN tradgov_groups_backup_before_encoding_fix AS backup_row
                  ON backup_row.id = current_row.id
                WHERE NOT (current_row.group_name <=> backup_row.group_name)
                ORDER BY current_row.id
                """
            )
            row_counts = fetch_one(
                """
                SELECT
                  (SELECT COUNT(*) FROM tradgov_groups) AS current_rows,
                  (SELECT COUNT(*) FROM tradgov_groups_backup_before_encoding_fix) AS backup_rows
                """
            )

        charset = fetch_one(
            """
            SELECT
              @@character_set_client AS client,
              @@character_set_connection AS connection_charset,
              @@character_set_results AS results_charset,
              @@collation_connection AS connection_collation
            """
        )

    print(f"Suspicious rows: {len(rows)}")
    for row in rows:
        print(row)
    print("Reference rows:")
    for row in reference_rows:
        print(row)
    print(f"Backup table exists: {bool(backup and backup['table_exists'])}")
    if row_counts is not None:
        print(f"Current/backup row counts: {row_counts}")
        print(f"Names changed since backup: {changed_since_backup}")
    print(f"Connection character set: {charset}")

    api_ids = [83, 132, 141, 146, 231, 234, 289, 559, 574, 599, 1053, 1098, 1367]
    print("API UTF-8 comparison:")
    for group_id in api_ids:
        with urlopen(f"http://127.0.0.1:3000/api/groups/{group_id}", timeout=5) as response:
            raw_body = response.read()
            decoded_body = raw_body.decode("utf-8", errors="strict")
            api_group = json.loads(decoded_body)["data"]
            database_group = fetch_one(
                "SELECT group_name FROM tradgov_groups WHERE id = %s",
                [group_id],
            )
            matches = database_group is not None and api_group["group_name"] == database_group["group_name"]
            print(
                {
                    "id": group_id,
                    "content_type": response.headers.get("Content-Type"),
                    "group_name": api_group["group_name"],
                    "api_matches_database": matches,
                }
            )


if __name__ == "__main__":
    main()
