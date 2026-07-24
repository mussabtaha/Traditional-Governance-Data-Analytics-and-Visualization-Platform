"""Contact endpoint tests with the Resend HTTPS request fully mocked."""

from __future__ import annotations

import json
import unittest
from urllib.error import URLError
from unittest.mock import ANY, patch

from app import app


VALID_CONTACT = {
    "name": "Amina Hassan",
    "email": "amina@example.com",
    "subject": "Dataset question",
    "message": "Could you provide more information about the project dataset?",
}


class ContactApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.config.update(
            TESTING=True,
            RESEND_API_KEY="test-resend-api-key",
            CONTACT_EMAIL="project@example.com",
            FROM_EMAIL="Traditional Governance <contact@example.org>",
        )
        self.client = app.test_client()

    @patch("routes.api.fetch_one")
    @patch("routes.api.fetch_all")
    @patch("routes.api.urlopen")
    def test_valid_request_sends_one_email_without_database_access(
        self,
        urlopen,
        fetch_all,
        fetch_one,
    ) -> None:
        https_response = urlopen.return_value.__enter__.return_value
        https_response.status = 200
        https_response.read.return_value = b'{"id":"email_test_123"}'

        response = self.client.post("/api/contact", json=VALID_CONTACT)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {
                "success": True,
                "message": "Your message has been sent successfully.",
            },
        )
        urlopen.assert_called_once_with(ANY, timeout=20)

        resend_request = urlopen.call_args.args[0]
        self.assertEqual(resend_request.full_url, "https://api.resend.com/emails")
        self.assertEqual(resend_request.get_method(), "POST")
        self.assertEqual(
            resend_request.get_header("Authorization"),
            "Bearer test-resend-api-key",
        )
        self.assertEqual(
            resend_request.get_header("Content-type"),
            "application/json",
        )
        self.assertEqual(
            resend_request.get_header("User-agent"),
            "traditional-governance-website/1.0",
        )

        outgoing_email = json.loads(resend_request.data.decode("utf-8"))
        self.assertEqual(
            outgoing_email["from"],
            "Traditional Governance <contact@example.org>",
        )
        self.assertEqual(outgoing_email["to"], ["project@example.com"])
        self.assertEqual(outgoing_email["reply_to"], "amina@example.com")
        self.assertIn("Amina Hassan", outgoing_email["text"])
        self.assertIn("Source: Traditional Governance website", outgoing_email["text"])
        fetch_all.assert_not_called()
        fetch_one.assert_not_called()

    @patch("routes.api.urlopen")
    def test_invalid_input_returns_structured_400(self, urlopen) -> None:
        invalid_response = self.client.post(
            "/api/contact",
            json={
                "name": "",
                "email": "not-an-email",
                "subject": "",
                "message": "Too short",
            },
        )

        self.assertEqual(invalid_response.status_code, 400)
        payload = invalid_response.get_json()
        self.assertFalse(payload["success"])
        self.assertEqual(
            payload["message"],
            "Please correct the highlighted fields.",
        )
        self.assertEqual(
            set(payload["errors"]),
            {"name", "email", "subject", "message"},
        )

        long_response = self.client.post(
            "/api/contact",
            json={
                **VALID_CONTACT,
                "name": "x" * 121,
                "message": "x" * 5_001,
            },
        )
        self.assertEqual(long_response.status_code, 400)
        self.assertIn("name", long_response.get_json()["errors"])
        self.assertIn("message", long_response.get_json()["errors"])
        urlopen.assert_not_called()

    @patch("routes.api.urlopen")
    def test_missing_resend_configuration_returns_safe_500(self, urlopen) -> None:
        app.config.update(
            RESEND_API_KEY="",
            CONTACT_EMAIL="",
            FROM_EMAIL="",
        )

        response = self.client.post("/api/contact", json=VALID_CONTACT)

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.get_json(),
            {
                "success": False,
                "message": "We could not send your message. Please try again later.",
            },
        )
        urlopen.assert_not_called()

    @patch("routes.api.urlopen")
    def test_resend_failure_returns_safe_500_json(self, urlopen) -> None:
        urlopen.side_effect = URLError("private diagnostic detail")

        response = self.client.post("/api/contact", json=VALID_CONTACT)

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.get_json(),
            {
                "success": False,
                "message": "We could not send your message. Please try again later.",
            },
        )
        self.assertNotIn("private diagnostic detail", response.get_data(as_text=True))
        urlopen.assert_called_once_with(ANY, timeout=20)


if __name__ == "__main__":
    unittest.main()
