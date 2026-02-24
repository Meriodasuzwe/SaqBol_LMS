import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()

@pytest.mark.django_db
def test_login_returns_tokens():
    User.objects.create_user(username="u1", password="StrongPass123!")

    client = APIClient()
    res = client.post("/users/login/", {"username": "u1", "password": "StrongPass123!"}, format="json")

    assert res.status_code == 200
    assert "access" in res.data
    assert "refresh" in res.data

@pytest.mark.django_db
def test_me_requires_auth():
    client = APIClient()
    res = client.get("/users/me/")

    # без токена должно отказать
    assert res.status_code in (401, 403)

@pytest.mark.django_db
def test_me_returns_profile_when_authenticated():
    User.objects.create_user(username="u2", password="StrongPass123!")

    client = APIClient()
    login = client.post("/users/login/", {"username": "u2", "password": "StrongPass123!"}, format="json")
    token = login.data["access"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    me = client.get("/users/me/")

    assert me.status_code == 200
    assert me.data["username"] == "u2"