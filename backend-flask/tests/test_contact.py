"""Contact endpoint tests with Gmail SMTP fully mocked."""

from __future__ import annotations

import smtplib
import unittest
from unittest.mock import patch

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
            SMTP_USER="sender@gmail.com",
            SMTP_PASSWORD="test-app-password",
            CONTACT_EMAIL="project@example.com",
        )
        self.client = app.test_client()

    @patch("routes.api.fetch_one")
    @patch("routes.api.fetch_all")
    @patch("routes.api.smtplib.SMTP_SSL")
    def test_valid_request_sends_one_email_without_database_access(
        self,
        smtp_ssl,
        fetch_all,
        fetch_one,
    ) -> None:
        smtp_client = smtp_ssl.return_value.__enter__.return_value

        response = self.client.post("/api/contact", json=VALID_CONTACT)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {
                "success": True,
                "message": "Your message has been sent successfully.",
            },
        )
        smtp_ssl.assert_called_once_with("smtp.gmail.com", 465, timeout=20)
        smtp_client.login.assert_called_once_with(
            "sender@gmail.com",
            "test-app-password",
        )
        smtp_client.send_message.assert_called_once()

        outgoing_email = smtp_client.send_message.call_args.args[0]
        self.assertEqual(outgoing_email["From"], "sender@gmail.com")
        self.assertEqual(outgoing_email["To"], "project@example.com")
        self.assertEqual(outgoing_email["Reply-To"], "amina@example.com")
        self.assertIn("Amina Hassan", outgoing_email.get_content())
        self.assertIn("Source: Traditional Governance website", outgoing_email.get_content())
        fetch_all.assert_not_called()
        fetch_one.assert_not_called()

    @patch("routes.api.smtplib.SMTP_SSL")
    def test_invalid_input_returns_structured_400(self, smtp_ssl) -> None:
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
        smtp_ssl.assert_not_called()

    @patch("routes.api.smtplib.SMTP_SSL")
    def test_missing_smtp_configuration_returns_safe_500(self, smtp_ssl) -> None:
        app.config.update(
            SMTP_USER="",
            SMTP_PASSWORD="",
            CONTACT_EMAIL="",
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
        smtp_ssl.assert_not_called()

    @patch("routes.api.smtplib.SMTP_SSL")
    def test_smtp_failure_returns_safe_500_json(self, smtp_ssl) -> None:
        smtp_client = smtp_ssl.return_value.__enter__.return_value
        smtp_client.login.side_effect = smtplib.SMTPException(
            "private diagnostic detail"
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
        self.assertNotIn("private diagnostic detail", response.get_data(as_text=True))
        smtp_client.send_message.assert_not_called()


if __name__ == "__main__":
    unittest.main()
