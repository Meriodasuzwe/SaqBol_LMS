from unittest.mock import patch

import pytest
from django.db import DatabaseError
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_health_is_public_and_checks_database():
    response = APIClient().get('/health/')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


def test_health_returns_503_without_database_details():
    with patch('core.views.connection.cursor', side_effect=DatabaseError('private connection details')):
        response = APIClient().get('/health/')
    assert response.status_code == 503
    assert response.json() == {'status': 'unavailable'}


def test_promo_slots_matches_public_frontend_route():
    response = APIClient().get('/courses/promo-slots/')
    assert response.status_code == 200
    assert response.data == {'remaining': 100}
