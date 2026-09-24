# Vector Privé deployment guide

## Vector Privé domain plan

- `vectorprive.com` and `www.vectorprive.com`: public Squarespace website
- `app.vectorprive.com`: secure member and operator MVP
- `api.vectorprive.com`: private application API used by the MVP

Keep the Squarespace root and `www` records unchanged. Add the `app` and `api`
records only after the hosting provider supplies their exact destinations.

This repo is now packaged for production-style deployment as a two-service app:

- `web`: Next.js client/operator app
- `api`: FastAPI backend
- `db`: PostgreSQL

## Local production run

Copy the production template:

```bash
cp .env.production.example .env.production
```

Edit secrets and domains, then run:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up --build
```

Default URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- API health: `http://localhost:8000/health`

## Important environment variables

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | Must be changed before any hosted deployment |
| `WEB_BASE_URL` | Public web app URL used for reset links |
| `NEXT_PUBLIC_API_URL` | Public API URL consumed by the web app |
| `CORS_ORIGINS` | Comma-separated allowed web origins for FastAPI |
| `AI_PROVIDER` | Placeholder for AI provider routing |
| `EMAIL_PROVIDER` | Placeholder for transactional email provider |
| `WHATSAPP_ENABLED` | WhatsApp Cloud API kill switch; defaults to false |
| `WHATSAPP_TOKEN` | Server-only Meta Cloud API access token |
| `WHATSAPP_APP_SECRET` | Verifies that webhook requests genuinely came from Meta |
| `WHATSAPP_VERIFY_TOKEN` | Private random value used during webhook registration |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta identifier for the Vector Privé sending number |
| `STRIPE_SECRET_KEY` | Placeholder for Stripe billing/payment workflow |
| `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` | Managed identity token verification |
| `PARTNER_PROVIDER` | `mock` or `nuitee` hotel adapter |
| `NUITEE_API_KEY` | Server-only Nuitee sandbox/production key |
| `PARTNER_BOOKING_ENABLED` | Consequential booking kill switch; defaults to false |

## Deployment options

### Fast proof deployment

Deploy only the Next.js web app to Vercel/Netlify/Lovable as a front-end demo. The current operator UI includes seeded data and runs without the backend.

### Full deployment

Deploy all three services:

- Postgres on managed database provider
- FastAPI on Render/Fly/Railway/AWS/GCP
- Next.js on Vercel/Netlify/Lovable

Set:

```bash
NEXT_PUBLIC_API_URL=https://api.vectorprive.com
WEB_BASE_URL=https://app.vectorprive.com
CORS_ORIGINS=https://app.vectorprive.com
```

## Production hardening before real clients

- Configure an OIDC provider such as Auth0, Clerk or Entra External ID and provision each user by immutable subject ID.
- Run the included Alembic migration before starting production (the API container does this automatically).
- Encrypt sensitive client memory fields.
- Add rate limits and audit logs for every external integration.
- Keep WhatsApp disabled until the signed webhook test and unknown-number holding queue have passed.
- Add backups, monitoring and error tracking.
- Keep all supplier bookings and payment commitments behind human approval.

Production startup deliberately fails if local passwords remain enabled or the three OIDC settings are missing.
