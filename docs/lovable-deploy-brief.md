# Lovable deployment brief — Vector Privé

Use this brief when creating or updating the Lovable project.

## Objective

Build and deploy Vector Privé as a high-end AI luxury concierge platform:

- client portal
- operator/admin OS
- request inbox
- AI triage
- Access OS inspired by premium concierge competitors
- client intelligence repository
- automatic/live-site research support
- human approval workflow
- WhatsApp/email/Stripe placeholders

## Recommended Lovable integrations

Your Lovable workspace has the following useful connectors enabled:

| Need | Lovable connector |
|---|---|
| Backend/database | Lovable Cloud or Supabase |
| Auth | Supabase Auth or Lovable Cloud auth pattern |
| Payments | Stripe |
| WhatsApp/SMS | Twilio |
| Transactional email | Resend or Mailgun |
| Web scraping/search | Firecrawl |
| AI workflows | AI Gateway |
| Maps/places | Google Maps Platform |

## Suggested Lovable prompt

```text
Create a deployable Vector Privé app based on this repo.

The product is an AI luxury concierge for high-net-worth travellers. It needs:

1. A fully branded black/gold Vector Privé client login and portal.
2. Operator admin OS with:
   - request inbox
   - AI triage
   - suggested client response
   - human approval workflow
   - supplier/booking evidence fields
   - automatic live-site research panel
3. Access OS:
   - proactive luxury moments
   - passion graph
   - supplier proof board
   - recommended next gestures
4. Client intelligence repository:
   - family/household
   - travel companions
   - preferences
   - dietary/wellbeing
   - life context
   - service style
5. Integrations:
   - Supabase/Lovable Cloud database
   - Stripe placeholder
   - Twilio WhatsApp placeholder
   - Resend/Mailgun email reset flow
   - Firecrawl-backed research for public target pages where permitted
   - AI Gateway for request triage and draft generation

Keep all bookings, payments, WhatsApp sends and supplier commitments behind explicit human approval.

Preserve the luxury visual language: black, gold, cinematic travel imagery, high whitespace discipline, and operator-grade data density.
```

## Data model to implement in Lovable Cloud/Supabase

- `clients`
- `client_preferences`
- `client_life_events`
- `client_relationships`
- `requests`
- `messages`
- `triage_results`
- `approvals`
- `supplier_research`
- `access_opportunities`
- `audit_log`
- `user_accounts`
- `password_reset_tokens`

## Deployment acceptance checklist

- Public URL works without localhost.
- `/login` works with real auth or demo auth.
- `/ops` loads dashboard.
- `/ops/requests` supports:
  - top-four options
  - automatic live-site research
  - suggested response draft
  - approval gate
- `/ops/access` shows Access OS.
- `/ops/clients` shows client intelligence and passion graph.
- All external actions are placeholders or gated by human approval.
