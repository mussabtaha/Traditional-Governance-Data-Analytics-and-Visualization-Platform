"""Environment-backed configuration for the Flask API."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _required_environment_value(name: str) -> str:
    value = os.getenv(name)
    if value is None:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _port_value(name: str, default: int | None = None) -> int:
    raw_value = os.getenv(name)
    if raw_value is None and default is not None:
        return default

    try:
        value = int(raw_value or "")
    except ValueError as error:
        raise RuntimeError(f"{name} must be a valid port number between 1 and 65535.") from error

    if value < 1 or value > 65535:
        raise RuntimeError(f"{name} must be a valid port number between 1 and 65535.")
    return value


class Config:
    """Application configuration loaded without hardcoded credentials."""

    DB_HOST = _required_environment_value("DB_HOST")
    DB_PORT = _port_value("DB_PORT")
    DB_USER = _required_environment_value("DB_USER")
    DB_PASSWORD = _required_environment_value("DB_PASSWORD")
    DB_NAME = _required_environment_value("DB_NAME")
    DB_POOL_NAME = "tradgov_pool"
    DB_POOL_SIZE = 10
    PORT = _port_value("PORT", 3000)
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "")
    FROM_EMAIL = os.getenv("FROM_EMAIL", "")
