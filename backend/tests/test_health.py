from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_does_not_require_api_key():
    # No X-API-Key header sent — /health is the one route intentionally
    # left open (see main.py) so uptime checks/load balancers can hit it.
    response = client.get("/health")
    assert response.status_code == 200
