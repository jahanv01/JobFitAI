from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

PROTECTED_GET_ROUTES = ["/profile"]
PROTECTED_POST_ROUTES = ["/profile", "/analyze", "/cover-letter"]


def test_protected_get_routes_reject_missing_key():
    for route in PROTECTED_GET_ROUTES:
        response = client.get(route)
        assert response.status_code == 401, route


def test_protected_post_routes_reject_missing_key():
    for route in PROTECTED_POST_ROUTES:
        response = client.post(route, json={})
        assert response.status_code == 401, route


def test_protected_route_rejects_wrong_key():
    response = client.get("/profile", headers={"X-API-Key": "not-the-real-key"})
    assert response.status_code == 401
