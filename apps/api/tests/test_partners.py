import asyncio

from app.services.partners import MockHotelPartner, _flight_amount, _flight_itinerary


def test_mock_partner_search_prebook_and_book_are_deterministic():
    partner = MockHotelPartner()
    payload = {
        "cityName": "Paris", "countryCode": "FR", "checkin": "2026-10-10",
        "checkout": "2026-10-13", "currency": "GBP", "guestNationality": "GB",
        "occupancies": [{"adults": 2, "children": []}],
    }
    first = asyncio.run(partner.search(payload))
    second = asyncio.run(partner.search(payload))
    assert len(first) == 3
    assert first[0].offer_id == second[0].offer_id
    assert first[0].currency == "GBP"

    quote = asyncio.run(partner.prebook(first[0].offer_id))
    assert quote.prebook_id.startswith("mock-prebook-")
    booking = asyncio.run(partner.book({"clientReference": "vp_safe_reference_123"}))
    assert booking.status == "confirmed"
    assert booking.booking_id.startswith("mock-booking-")


def test_flight_offer_helpers_support_nuitee_display_pricing_and_segments():
    amount, currency = _flight_amount({"pricing": {"display": {"total": 1284.5, "currency": "GBP"}}}, "USD")
    assert (amount, currency) == (1284.5, "GBP")
    assert _flight_itinerary({"segments": [{"origin": {"iata": "LHR"}, "destination": {"iata": "JFK"}}]}) == "LHR–JFK"
