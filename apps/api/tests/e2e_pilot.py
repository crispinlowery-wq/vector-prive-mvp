"""Run against a local development API: python apps/api/tests/e2e_pilot.py."""
from datetime import date, timedelta
from uuid import uuid4

import httpx


BASE = "http://127.0.0.1:8000"


def login(email: str, password: str) -> str:
    response = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=10)
    response.raise_for_status()
    return response.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


operator = login("operator@vectorprive.test", "VectorOps!2026")
member = login("amelia@vectorprive.test", "VectorDemo!2026")

clients = httpx.get(f"{BASE}/clients", headers=auth(operator)).raise_for_status().json()
client = next(item for item in clients if item["email"] == "amelia@vectorprive.test")

start = date.today() + timedelta(days=45)
end = start + timedelta(days=3)
request = httpx.post(
    f"{BASE}/requests", headers=auth(operator),
    json={"client_id": client["id"], "title": "Paris pilot hotel", "message": "Find a quiet refundable Paris hotel for two.", "category": "travel", "channel": "operator"},
).raise_for_status().json()

offers = httpx.post(
    f"{BASE}/partners/hotels/search", headers=auth(operator),
    json={"city_name": "Paris", "country_code": "FR", "checkin": start.isoformat(), "checkout": end.isoformat(), "currency": "GBP", "guest_nationality": "GB", "occupancies": [{"adults": 2, "children": []}], "refundable_only": True, "max_rates_per_hotel": 2},
).raise_for_status().json()
offer = offers[0]

quote = httpx.post(
    f"{BASE}/requests/{request['id']}/hotel-quotes", headers=auth(operator),
    json={"offer_id": offer["offer_id"], "hotel_name": offer["hotel_name"], "room_name": offer["room_name"]},
).raise_for_status().json()

booking_payload = {
    "idempotency_key": f"vp_e2e_{uuid4().hex}",
    "holder": {"first_name": "Amelia", "last_name": "Hart", "email": "amelia@vectorprive.test"},
    "guests": [{"occupancy_number": 1, "first_name": "Amelia", "last_name": "Hart", "email": "amelia@vectorprive.test", "remarks": "Quiet room"}],
}
blocked = httpx.post(f"{BASE}/hotel-quotes/{quote['id']}/book", headers=auth(operator), json=booking_payload)
assert blocked.status_code == 409, blocked.text

httpx.patch(
    f"{BASE}/approvals/{quote['approval_id']}", headers=auth(member),
    json={"decision": "approved", "note": "E2E pilot approval"},
).raise_for_status()

booking = httpx.post(f"{BASE}/hotel-quotes/{quote['id']}/book", headers=auth(operator), json=booking_payload).raise_for_status().json()
duplicate = httpx.post(f"{BASE}/hotel-quotes/{quote['id']}/book", headers=auth(operator), json=booking_payload).raise_for_status().json()
assert booking["id"] == duplicate["id"]

print(f"PASS request={request['reference']} quote={quote['id']} booking={booking['external_booking_id']} approval_gate=verified idempotency=verified")
