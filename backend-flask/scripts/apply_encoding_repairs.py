"""Apply the reviewed group-name repairs with exact byte guards."""

from __future__ import annotations

import argparse
import sys

from app import app
from database.db import get_connection


REPAIRS = [
    (83, "4D6179612049747AC383C2A1", "Maya Itzá"),
    (132, "506961726F612F55776F7474C383C2BC6A61", "Piaroa/Uwottüja"),
    (141, "50616E6172652D4579652F4527C383C2B16570C383C2A1", "Panare-Eye/E'ñepá"),
    (146, "4A6F74C383C2AF", "Jotï"),
    (231, "5069706970C383C2A3", "Pipipã"),
    (234, "41696B616EC383C2A3", "Aikanã"),
    (289, "57696368C383C2AD", "Wichí"),
    (559, "42616779C383C2A96C69", "Bagyéli"),
    (574, "5079676DC383C2A965732042616B61", "Pygmées Baka"),
    (599, "59616BC383C2B62F59616B757272", "Yakö/Yakurr"),
    (1053, "417261622F4A61C3A2C280C299616C6979696E", "Arab/Ja'aliyin"),
    (1098, "4BC383C2A26BC383C2A22769", "Kâkâ'i"),
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Required acknowledgement before database writes are enabled.",
    )
    arguments = parser.parse_args()
    if not arguments.apply:
        raise SystemExit("No changes made. Re-run with --apply after reviewing the SQL migration.")

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    with app.app_context():
        connection = get_connection()
        connection.autocommit = False
        cursor = connection.cursor(dictionary=True)
        try:
            cursor.execute(
                """
                SELECT COUNT(*) AS table_exists
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name = %s
                """,
                ("tradgov_groups_backup_before_encoding_fix",),
            )
            if cursor.fetchone()["table_exists"] == 0:
                cursor.execute(
                    """
                    CREATE TABLE tradgov_groups_backup_before_encoding_fix AS
                    SELECT * FROM tradgov_groups
                    """
                )
                print("Created tradgov_groups_backup_before_encoding_fix.")
            else:
                print("Existing backup table preserved unchanged.")

            changed_ids: list[int] = []
            skipped_ids: list[int] = []
            for group_id, expected_hex, corrected_name in REPAIRS:
                cursor.execute(
                    """
                    UPDATE tradgov_groups
                    SET group_name = %s
                    WHERE id = %s AND HEX(group_name) = %s
                    """,
                    (corrected_name, group_id, expected_hex),
                )
                if cursor.rowcount == 1:
                    changed_ids.append(group_id)
                else:
                    skipped_ids.append(group_id)

            connection.commit()
            print(f"Changed ids: {changed_ids}")
            print(f"Skipped ids (byte guard did not match): {skipped_ids}")
        except Exception:
            connection.rollback()
            raise
        finally:
            cursor.close()
            connection.close()


if __name__ == "__main__":
    main()
