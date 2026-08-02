"""Flask entry point for the Traditional Governance API."""

from __future__ import annotations

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from config import Config
from database.db import init_pool
from routes.api import api


ALLOWED_ORIGINS = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://traditional-governance-frontend.onrender.com",
]


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    app.json.sort_keys = False

    CORS(
        app,
        resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
        methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    init_pool(app.config)
    app.register_blueprint(api)

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        message = "Endpoint not found." if error.code == 404 else error.description
        return jsonify(success=False, message=message), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        # Connector exceptions can include host or credential material in their
        # message. Log only the exception type and return a stable public error.
        app.logger.error(
            "Unhandled API error (%s).", type(error).__name__
        )
        return (
            jsonify(success=False, message="An internal server error occurred."),
            500,
        )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=app.config["PORT"],
        debug=False,
        use_reloader=False,
        threaded=True,
    )
