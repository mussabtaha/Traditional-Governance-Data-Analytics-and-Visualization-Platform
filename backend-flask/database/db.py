"""MySQL connection-pool and query helpers."""

from __future__ import annotations

from decimal import Decimal
from threading import Lock
from typing import Any, Iterable

from mysql.connector.pooling import MySQLConnectionPool


_pool: MySQLConnectionPool | None = None
_pool_config: dict[str, Any] = {}
_pool_lock = Lock()


def init_pool(config: dict[str, Any]) -> None:
    """Store pool settings and create connections lazily on first use."""
    global _pool, _pool_config
    _pool = None
    _pool_config = {
        "pool_name": config["DB_POOL_NAME"],
        "pool_size": config["DB_POOL_SIZE"],
        "pool_reset_session": True,
        "host": config["DB_HOST"],
        "port": config["DB_PORT"],
        "user": config["DB_USER"],
        "password": config["DB_PASSWORD"],
        "database": config["DB_NAME"],
        "autocommit": True,
        "charset": "utf8mb4",
        "collation": "utf8mb4_unicode_ci",
        "use_unicode": True,
    }


def _get_pool() -> MySQLConnectionPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = MySQLConnectionPool(**_pool_config)
    return _pool


def get_connection():
    """Return one connection from the shared MySQL pool."""
    return _get_pool().get_connection()


def _json_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        # mysql2 returns MySQL DECIMAL/SUM values as JSON strings. Preserve
        # that behavior so Flask remains a drop-in API replacement.
        return str(value)
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return value


def _json_row(row: dict[str, Any]) -> dict[str, Any]:
    return {key: _json_value(value) for key, value in row.items()}


def fetch_all(query: str, parameters: Iterable[Any] = ()) -> list[dict[str, Any]]:
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(query, tuple(parameters))
        return [_json_row(row) for row in cursor.fetchall()]
    finally:
        cursor.close()
        connection.close()


def fetch_one(query: str, parameters: Iterable[Any] = ()) -> dict[str, Any] | None:
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(query, tuple(parameters))
        row = cursor.fetchone()
        return _json_row(row) if row is not None else None
    finally:
        cursor.close()
        connection.close()
