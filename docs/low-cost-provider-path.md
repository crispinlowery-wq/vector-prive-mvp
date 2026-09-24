# Vector Privé low-cost provider path

The MVP should prove concierge workflow quality before paying for inventory integrations.

## Current implementation

The operator request inbox includes a “Low-cost connector routes” panel powered by `apps/web/lib/lowCostTravelProviders.ts`.

It also includes an “Automatic live-site research” panel powered by `apps/web/lib/scrapeResearch.ts`.

That panel identifies which public-site checks are necessary for the request, runs an automatic public-signal pass, creates airline/hotel/supplier research targets, then lets the operator edit or confirm observed availability, price, notes and timestamp.

This is intentionally operator-assisted:

- Open the target site manually.
- Review or record visible price/availability.
- Keep the result marked as manual-confirmation-required.
- Do not bypass CAPTCHA, login walls, paywalls, rate limits or payment steps.
- Do not auto-book from scraped observations.

It separates provider routes into:

- `free_api` — suitable for early low-cost experiments, such as Aviationstack or OpenSky-style flight status/tracking.
- `low_cost_api` — paid but lightweight options, such as FlightAware monitoring or Google Places-style discovery.
- `manual` — supplier workflow with no API cost, such as NetJets, verified chauffeurs, hotels and lifestyle suppliers.
- `mock` — adapter-ready placeholders for future commercial integrations such as Hotelbeds, Expedia Rapid or Avinode.

Every option shown to the operator includes:

- cost level
- confidence
- data freshness
- whether it is live, manual-confirmed or demo-only
- next operator action
- risk note

## Recommended proof-stage stack

1. Keep bookings human-approved.
2. Use manual supplier records for luxury hotels, NetJets/private aviation, chauffeurs and lifestyle requests.
3. Use free/low-cost APIs only where they safely improve operator context:
   - flight status
   - flight tracking
   - airport/airline metadata
   - hotel discovery, not hotel booking
4. Do not scrape airline sites for production. If used experimentally, treat results as operator research only and never as confirmed availability.
5. Add paid inventory APIs only after real client demand proves the category.

## Later adapter targets

- Hotels: Hotelbeds or Expedia Rapid.
- Commercial flights: Amadeus first; Sabre/Travelport later if Vector Privé becomes a formal travel seller.
- Private aviation: Avinode.
- NetJets: manual supplier route unless a private partner integration is negotiated.
