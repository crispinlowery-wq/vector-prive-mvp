from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.config import settings


class PartnerError(RuntimeError):
    pass


@dataclass
class HotelOffer:
    offer_id: str
    hotel_name: str
    room_name: str
    amount: float
    currency: str
    refundable: bool
    cancellation: dict[str, Any]
    raw: dict[str, Any]


@dataclass
class PrebookResult:
    prebook_id: str
    hotel_name: str
    room_name: str
    amount: float
    currency: str
    cancellation: dict[str, Any]
    raw: dict[str, Any]


@dataclass
class BookingResult:
    booking_id: str
    confirmation_code: str | None
    status: str
    summary: dict[str, Any]


@dataclass
class FlightOffer:
    offer_id: str
    itinerary: str
    amount: float
    currency: str
    refundable: bool | None


class HotelPartner(Protocol):
    name: str

    async def search(self, payload: dict[str, Any]) -> list[HotelOffer]: ...
    async def prebook(self, offer_id: str) -> PrebookResult: ...
    async def book(self, payload: dict[str, Any]) -> BookingResult: ...


def _first(mapping: dict[str, Any], *keys: str, default=None):
    for key in keys:
        if mapping.get(key) is not None:
            return mapping[key]
    return default


def _money(rate: dict[str, Any], fallback_currency: str = "GBP") -> tuple[float, str]:
    price = rate.get("retailRate") or rate.get("price") or rate.get("total") or {}
    if isinstance(price, (int, float)):
        return float(price), fallback_currency
    amount = _first(price, "total", "amount", "suggestedSellingPrice", default=0)
    if isinstance(amount, dict):
        amount = _first(amount, "amount", "value", default=0)
    currency = _first(price, "currency", "currencyCode", default=fallback_currency)
    return float(amount or 0), str(currency)


class NuiteePartner:
    name = "nuitee"

    def __init__(self):
        self.headers = {"X-API-Key": settings.nuitee_api_key, "Accept": "application/json"}

    async def _post(self, base: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=settings.partner_timeout_seconds) as client:
                response = await client.post(f"{base.rstrip('/')}/{path.lstrip('/')}", headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            request_id = exc.response.headers.get("x-request-id", "not supplied")
            raise PartnerError(f"Nuitee rejected the request ({exc.response.status_code}, request {request_id})") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise PartnerError("Nuitee is temporarily unavailable or returned an invalid response") from exc

    async def search(self, payload: dict[str, Any]) -> list[HotelOffer]:
        body = await self._post(settings.nuitee_search_base_url, "/hotels/rates", payload)
        hotels = body.get("data") or []
        offers: list[HotelOffer] = []
        for hotel in hotels:
            hotel_name = str(_first(hotel, "name", "hotelName", default="Hotel"))
            for room in hotel.get("roomTypes") or hotel.get("rooms") or []:
                room_name = str(_first(room, "name", "roomTypeName", default="Room"))
                for rate in room.get("rates") or []:
                    offer_id = str(_first(rate, "offerId", "offerID", default=""))
                    if not offer_id:
                        continue
                    amount, currency = _money(rate, payload.get("currency", "GBP"))
                    cancellation = rate.get("cancellationPolicies") or rate.get("cancellationPolicy") or {}
                    offers.append(HotelOffer(
                        offer_id=offer_id,
                        hotel_name=hotel_name,
                        room_name=room_name,
                        amount=amount,
                        currency=currency,
                        refundable=bool(rate.get("refundable", rate.get("refundableTag") == "RFN")),
                        cancellation=cancellation if isinstance(cancellation, dict) else {"terms": cancellation},
                        raw={"hotelId": hotel.get("id") or hotel.get("hotelId"), "rate": rate},
                    ))
        return offers

    async def prebook(self, offer_id: str) -> PrebookResult:
        body = await self._post(settings.nuitee_booking_base_url, "/rates/prebook", {"offerId": offer_id, "usePaymentSdk": False})
        data = body.get("data") or body
        rooms = data.get("roomTypes") or data.get("rooms") or []
        room = rooms[0] if rooms else {}
        rates = room.get("rates") or []
        rate = rates[0] if rates else data
        amount, currency = _money(rate)
        if amount <= 0 or len(currency) != 3:
            raise PartnerError("Nuitee prebook did not include a usable final price and currency")
        cancellation = rate.get("cancellationPolicies") or rate.get("cancellationPolicy") or {}
        return PrebookResult(
            prebook_id=str(_first(data, "prebookId", "id", default="")),
            hotel_name=str(_first(data.get("hotel") or {}, "name", default=data.get("hotelName", "Hotel"))),
            room_name=str(_first(room, "name", "roomTypeName", default="Room")),
            amount=amount,
            currency=currency,
            cancellation=cancellation if isinstance(cancellation, dict) else {"terms": cancellation},
            raw={"prebookId": data.get("prebookId"), "roomTypes": rooms, "expiresAt": data.get("expiresAt")},
        )

    async def book(self, payload: dict[str, Any]) -> BookingResult:
        body = await self._post(settings.nuitee_booking_base_url, "/rates/book", payload)
        data = body.get("data") or body
        booking_id = str(_first(data, "bookingId", "id", default=""))
        return BookingResult(
            booking_id=booking_id,
            confirmation_code=_first(data, "hotelConfirmationCode", "confirmationCode"),
            status=str(_first(data, "status", "bookingStatus", default="confirmed")),
            summary={"bookingId": booking_id, "status": _first(data, "status", default="confirmed")},
        )


def _flight_amount(value: dict[str, Any], fallback_currency: str) -> tuple[float, str]:
    pricing = value.get("pricing") or value.get("price") or {}
    if isinstance(pricing, dict):
        pricing = pricing.get("display") or pricing.get("total") or pricing
    if isinstance(pricing, (int, float)):
        return float(pricing), fallback_currency
    if not isinstance(pricing, dict):
        return 0.0, fallback_currency
    amount = _first(pricing, "amount", "total", "value", "grandTotal", default=0)
    if isinstance(amount, dict):
        amount = _first(amount, "amount", "value", "total", default=0)
    currency = _first(pricing, "currency", "currencyCode", default=fallback_currency)
    return float(amount or 0), str(currency)


def _flight_itinerary(value: dict[str, Any]) -> str:
    segments = value.get("segments") or value.get("itinerary") or value.get("legs") or []
    if isinstance(segments, dict):
        segments = segments.get("segments") or []
    codes: list[str] = []
    for segment in segments if isinstance(segments, list) else []:
        if not isinstance(segment, dict):
            continue
        origin = _first(segment.get("origin") or {}, "iata", "code", default=segment.get("origin"))
        destination = _first(segment.get("destination") or {}, "iata", "code", default=segment.get("destination"))
        if origin and destination:
            codes.append(f"{origin}–{destination}")
    return " · ".join(codes) or "Flight itinerary"


class NuiteeFlightsPartner:
    """Read-only flight search. Ticketing remains a separate approval workflow."""

    name = "nuitee"

    def __init__(self):
        self.headers = {"X-API-Key": settings.nuitee_api_key, "Accept": "application/json"}

    async def search(self, payload: dict[str, Any]) -> list[FlightOffer]:
        if not settings.nuitee_api_key:
            raise PartnerError("Nuitee flight search is not configured")
        try:
            async with httpx.AsyncClient(timeout=settings.partner_timeout_seconds) as client:
                response = await client.post(
                    f"{settings.nuitee_search_base_url.rstrip('/')}/flights/rates",
                    headers=self.headers, json=payload,
                )
            response.raise_for_status()
            body = response.json()
        except httpx.HTTPStatusError as exc:
            request_id = exc.response.headers.get("x-request-id", "not supplied")
            raise PartnerError(f"Nuitee flight search was rejected ({exc.response.status_code}, request {request_id})") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise PartnerError("Nuitee flight search is temporarily unavailable") from exc

        data = body.get("data") or body
        journeys = data.get("journeys") if isinstance(data, dict) else data
        if not isinstance(journeys, list):
            journeys = []
        offers: list[FlightOffer] = []
        for journey in journeys:
            if not isinstance(journey, dict):
                continue
            for candidate in journey.get("offers") or [journey]:
                if not isinstance(candidate, dict):
                    continue
                offer_id = str(_first(candidate, "offerId", "id", default=journey.get("offerId", "")))
                if not offer_id:
                    continue
                amount, currency = _flight_amount(candidate if candidate.get("pricing") else journey, payload.get("currency", "GBP"))
                if amount <= 0:
                    continue
                offers.append(FlightOffer(
                    offer_id=offer_id,
                    itinerary=_flight_itinerary(candidate if candidate.get("segments") else journey),
                    amount=amount,
                    currency=currency,
                    refundable=candidate.get("refundable", journey.get("refundable")),
                ))
        return offers


class MockHotelPartner:
    name = "mock"

    async def search(self, payload: dict[str, Any]) -> list[HotelOffer]:
        destination = payload.get("cityName") or payload.get("aiSearch") or "London"
        currency = payload.get("currency", "GBP")
        return [
            HotelOffer(
                offer_id=f"mock-{index}-{hashlib.sha256(str(payload).encode()).hexdigest()[:10]}",
                hotel_name=name,
                room_name=room,
                amount=amount,
                currency=currency,
                refundable=index != 2,
                cancellation={"summary": "Free cancellation until 48 hours before arrival" if index != 2 else "Non-refundable"},
                raw={"destination": destination, "sandbox": True},
            )
            for index, (name, room, amount) in enumerate([
                (f"The {destination} House", "Quiet king suite", 1280.0),
                (f"{destination} Private Hotel", "Connecting junior suites", 1640.0),
                (f"Grand {destination}", "Signature room", 980.0),
            ], start=1)
        ]

    async def prebook(self, offer_id: str) -> PrebookResult:
        suffix = hashlib.sha256(offer_id.encode()).hexdigest()[:10]
        return PrebookResult(
            prebook_id=f"mock-prebook-{suffix}", hotel_name="Sandbox hotel", room_name="Selected room",
            amount=1280.0, currency="GBP", cancellation={"summary": "Sandbox: free cancellation until 48 hours before arrival"},
            raw={"sandbox": True, "offerId": offer_id},
        )

    async def book(self, payload: dict[str, Any]) -> BookingResult:
        reference = payload["clientReference"]
        return BookingResult(
            booking_id=f"mock-booking-{hashlib.sha256(reference.encode()).hexdigest()[:10]}",
            confirmation_code=f"VP-{hashlib.sha256(reference.encode()).hexdigest()[:8].upper()}",
            status="confirmed",
            summary={"sandbox": True, "status": "confirmed"},
        )


def get_hotel_partner() -> HotelPartner:
    if settings.partner_provider.lower() == "nuitee":
        return NuiteePartner()
    return MockHotelPartner()
