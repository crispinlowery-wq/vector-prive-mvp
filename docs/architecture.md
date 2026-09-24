# Architecture

## Product loop

Inbound message → request → AI triage → operator review → client approval → supplier/payment action → confirmation → preference memory.

The FastAPI service owns workflow truth. Next.js provides separate member and private-office surfaces. PostgreSQL stores profiles, preferences, messages, requests, approvals and audit actions. Channel and payment adapters expose a stable contract but remain in safe sandbox mode.

## Approval policy

An approval is mandatory when the value is above £5,000; the request involves private aviation, yachts, security, medical/legal/immigration logistics; a supplier is unverified; confidence is below 0.75; or the action would spend money or create a supplier commitment. Decline returns the request to `in_progress`; approval advances it to `approved` but does not silently execute the external action.

## Production follow-ons

Add Clerk/Auth0 RBAC, Alembic migrations, Redis/Celery workers, secret management, encrypted sensitive profile fields, webhook signature verification, OpenAI tool-calling with evaluation, observability, backups and region-specific privacy controls before handling real client data.
