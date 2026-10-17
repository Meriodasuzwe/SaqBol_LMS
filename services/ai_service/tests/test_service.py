"""Offline regression checks: python -m unittest discover -s tests -v."""

import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

# Use dummy credentials throughout; these tests never call the provider.
with patch.dict(os.environ, {
    "DJANGO_SECRET_KEY": "ai-service-test-signing-key",
    "GROQ_API_KEY": "test-not-a-real-provider-key",
}):
    from config import Settings, settings
    from fastapi import HTTPException
    from fastapi.testclient import TestClient
    from jose import jwt
    from main import app


class SettingsTests(unittest.TestCase):
    def test_shared_dotenv_loads_django_key_and_ignores_other_services(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env"
            env_file.write_text(
                "DJANGO_SECRET_KEY=dotenv-test-key\n"
                "GROQ_API_KEY=dotenv-test-provider-key\n"
                "POSTGRES_DB=unrelated-setting\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {}, clear=True):
                loaded = Settings(_env_file=env_file)
            self.assertEqual(loaded.SECRET_KEY, "dotenv-test-key")
            self.assertEqual(loaded.GROQ_API_KEY, "dotenv-test-provider-key")

    def test_empty_credentials_are_rejected(self):
        from pydantic import ValidationError

        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValidationError):
                Settings(SECRET_KEY="", GROQ_API_KEY="", _env_file=None)


class ChatReplyTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.body = {"message": "Я позвоню в службу безопасности", "history": []}

    def tearDown(self):
        self.client.close()

    def auth_headers(self, token_type="access"):
        token = jwt.encode(
            {"user_id": 1, "token_type": token_type, "exp": int(time.time()) + 60},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        return {"Authorization": f"Bearer {token}"}

    def test_health_works_without_authentication(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_chat_rejects_missing_credentials_before_provider_call(self):
        with patch("routers.scenario.groq_chat_json", new_callable=AsyncMock) as provider:
            response = self.client.post("/generate-scenario/chat-reply", json=self.body)
        self.assertEqual(response.status_code, 403)
        provider.assert_not_awaited()

    def test_chat_rejects_refresh_token(self):
        with patch("routers.scenario.groq_chat_json", new_callable=AsyncMock) as provider:
            response = self.client.post(
                "/generate-scenario/chat-reply", json=self.body,
                headers=self.auth_headers("refresh"),
            )
        self.assertEqual(response.status_code, 401)
        provider.assert_not_awaited()

    def test_authenticated_chat_returns_provider_result(self):
        result = {"reply": "Хорошо", "isSuccess": True, "explanation": "Правильное действие"}
        with patch("routers.scenario.groq_chat_json", new_callable=AsyncMock, return_value=result):
            response = self.client.post(
                "/generate-scenario/chat-reply", json=self.body, headers=self.auth_headers(),
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reply"], result["reply"])
        self.assertTrue(response.json()["isSuccess"])

    def test_chat_preserves_provider_failure_status(self):
        for status_code in (503, 504):
            with self.subTest(status_code=status_code):
                error = HTTPException(status_code=status_code, detail="AI unavailable")
                with patch("routers.scenario.groq_chat_json", new_callable=AsyncMock, side_effect=error):
                    response = self.client.post(
                        "/generate-scenario/chat-reply", json=self.body,
                        headers=self.auth_headers(),
                    )
                self.assertEqual(response.status_code, status_code)
                self.assertEqual(response.json(), {"detail": "AI unavailable"})


if __name__ == "__main__":
    unittest.main()
