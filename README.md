# Vector Privé — AI luxury concierge MVP

“One message. Consider it handled.”

This monorepo implements the pilot MVP: a member-facing concierge, operator request inbox, structured client memory, AI triage, authenticated roles, approval controls, a PostgreSQL system of record, and a controlled supplier boundary for Nuitee and future partners.

## Run locally

```bash
pnpm install
pnpm dev
```

The web app runs at `http://localhost:3000`. The visual demo remains available, while real member requests, approvals and the hotel partner desk use the API.

Backend (optional for the demo UI):

```bash
docker compose up -d db
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`. Set `NEXT_PUBLIC_API_URL=http://localhost:8000` to connect the web app when live API wiring is enabled.

Demo identities (development only):

- Member: `amelia@vectorprive.test` / `VectorDemo!2026`
- Operator: `operator@vectorprive.test` / `VectorOps!2026`

Use the member account for requests and approvals. Use the operator account for **Private office → Hotel partners**. Production refuses to start with demo password authentication enabled.

## Safety model

- AI output is always a draft with confidence and rationale.
- Payments, supplier commitments, private aviation, unverified suppliers, and high-value requests require human approval.
- Every transition creates an audit action.
- WhatsApp remains disabled until Meta credentials are configured; signed inbound messages and operator replies are then recorded and audited.
- Hotel rates use a mock adapter by default. Nuitee search, prebook and booking are enabled only through explicit server-side configuration.

See `docs/architecture.md` for the data and workflow design.

## Operator research

The operator console includes a bounded, privacy-filtered OpenAI Responses API research flow. It researches public sources and returns sourced options, risks, next actions and a draft reply. It cannot book, reserve, contact a supplier or spend money. Every run records the model and token usage and creates request audit events.

Set `OPENAI_API_KEY` and `OPENAI_RESEARCH_ENABLED=true` on the API service after the OpenAI project has API credits. The guided/manual research route remains available whenever live research is disabled or unavailable.

## Deploy

The repo includes Docker deployment packaging:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up --build
```

See:

- `docs/deployment.md`
- `docs/partner-integration.md`
- `docs/whatsapp-integration.md`
- `docs/lovable-deploy-brief.md`
