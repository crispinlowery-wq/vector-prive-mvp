# Partner integration runbook

Vector Privé uses a server-side partner boundary. Browser code never receives a supplier API key and never calls a booking supplier directly.

## Hotel workflow

```text
Member request
→ operator rate search
→ operator selects an offer
→ server prebooks and stores final price/terms
→ member or authorised PA approves that exact quote
→ operator submits the approved booking
→ provider and internal idempotency checks prevent duplicates
→ confirmation and audit event are stored
```

The API rejects booking when the quote is pending, rejected, changed, missing a usable price, or already used. Operators cannot approve on a member's behalf.

## Nuitee sandbox

1. Create a sandbox account and API key in the Nuitee dashboard.
2. Start with:

   ```dotenv
   PARTNER_PROVIDER=nuitee
   PARTNER_BOOKING_ENABLED=false
   NUITEE_API_KEY=your-sandbox-key
   ```

3. Verify search and prebook from **Private office → Hotel partners**.
4. Verify the member sees the exact quote under **Approvals** and can approve or decline it.
5. Set `PARTNER_BOOKING_ENABLED=true` only in a sandbox environment and complete a sandbox booking.
6. Reconcile the confirmation in both Vector Privé and the Nuitee dashboard.
7. Test timeout, expired-offer, duplicate-reference, decline and supplier-error cases before requesting production access.

Official flow:

- Search: https://docs.liteapi.travel/reference/post_hotels-rates
- Prebook: https://docs.liteapi.travel/reference/post_rates-prebook
- Book: https://docs.liteapi.travel/reference/post_rates-book
- Webhooks: https://docs.liteapi.travel/docs/using-liteapi-webhooks

Nuitee documents the search → prebook → book sequence, `X-API-Key` authentication and a `clientReference` duplicate-booking control. Vector Privé maps its internal idempotency key to that client reference.

## Adding another partner

Implement the `HotelPartner` contract in `apps/api/app/services/partners.py`:

- `search(payload)` returns normalized offers.
- `prebook(offer_id)` reconfirms price, currency and cancellation terms.
- `book(payload)` returns only the identifiers and status needed internally.

Then add the provider to `get_hotel_partner()`. Keep credentials server-side, translate provider failures into `PartnerError`, redact supplier responses before persistence, and preserve the same approval and idempotency gates. A partner adapter must not bypass the central booking route.

## Before production bookings

- Configure managed OIDC identity and provision named users.
- Keep local password authentication and demo seeding disabled.
- Use a managed PostgreSQL database with point-in-time recovery.
- Configure the partner's signed booking/cancellation webhooks.
- Add payment handling approved for the chosen Nuitee commercial model.
- Run a sandbox reconciliation test and a targeted penetration test.
- Add production alerts for failed, duplicate and unusually high-value booking attempts.
