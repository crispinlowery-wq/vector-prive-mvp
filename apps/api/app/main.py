from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import base64
import binascii
import hashlib
import hmac
import json
import secrets
from uuid import UUID, uuid4

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import engine, get_db
from app.models import (
    Approval, ApprovalDecision, AuditAction, Base, Client, ConciergeRequest, HotelQuote, Household,
    InboundWebhookEvent, InviteKey, MembershipApplication, Message, NetworkContact, OperationalRecord, OperatorResearchRun, PartnerBooking, PasswordResetToken, Preference, PrivacyRequest, RequestStatus, UserAccount, UserRole, UserSession,
)
from app.schemas import (
    ApprovalOut, ApprovalUpdate, BookHotelIn, ForgotPasswordIn, ForgotPasswordOut,
    ClientFeedbackIn, ClientOut, EmployeePreferenceIn, FlightOfferOut, FlightSearchIn, HotelOfferOut, HotelQuoteOut, HotelSearchIn, InviteKeyIn, LoginIn, LoginOut, MembershipApplicationIn, NetworkContactListOut, OnboardingIn, OnboardingOut, PartnerBookingOut,
    OperationalRecordIn, OperationalRecordOut, OperationalRecordUpdate, OperatorResearchOut, PrebookIn, PrivacyRequestIn, PrivacyRequestOut, PrivacyRequestUpdate, ProfilePhotoIn, RequestCreate, RequestOut, ResetPasswordIn, ResetPasswordOut, TriageOut, UserOut,
    WhatsAppMessageOut, WhatsAppSendIn,
)
from app.services.auth import build_reset_link, hash_password, hash_token, new_token, token_expiry, verify_password
from app.services.partners import NuiteeFlightsPartner, PartnerError, get_hotel_partner
from app.services.preference_learning import extract_preference_signals, relevant_context
from app.services.openai_research import OpenAIResearchError, build_research_context, run_openai_research
from app.services.security import assert_client_access, current_user, require_roles
from app.services.triage import triage
from app.services.whatsapp import (
    WhatsAppCloudAdapter, WhatsAppError, normalize_whatsapp_phone, parse_webhook, verify_webhook_signature,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime()
    if not settings.is_production:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    if settings.seed_demo_data and not settings.is_production:
        async for db in get_db():
            await seed_demo_users(db)
            break
    yield


app = FastAPI(title="Vector Privé API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
)


def user_payload(user: UserAccount) -> dict:
    return {"id": user.id, "client_id": user.client_id, "email": user.email, "full_name": user.full_name, "role": user.role.value}


MEMBERSHIP_TIERS = {
    "vector": {"name": "Vector", "price": 200, "link": "stripe_vector_payment_link", "price_key": "stripe_vector_price_id"},
    "vector_plus": {"name": "Vector Plus", "price": 500, "link": "stripe_vector_plus_payment_link", "price_key": "stripe_vector_plus_price_id"},
    "vector_prive": {"name": "Vector Privé", "price": 850, "link": "stripe_vector_prive_payment_link", "price_key": "stripe_vector_prive_price_id"},
}


def membership_payment_link(tier: str) -> str | None:
    return getattr(settings, MEMBERSHIP_TIERS[tier]["link"]) or None


async def create_membership_checkout(item: MembershipApplication) -> str | None:
    """Create a one-use Checkout session tied to the exact Vector application."""
    price_id = getattr(settings, MEMBERSHIP_TIERS[item.tier]["price_key"])
    if not settings.stripe_secret_key or not price_id:
        return membership_payment_link(item.tier)
    application_id = str(item.id)
    form = {
        "mode": "subscription",
        "customer_email": item.email,
        "client_reference_id": application_id,
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": "1",
        "metadata[vector_application_id]": application_id,
        "subscription_data[metadata][vector_application_id]": application_id,
        "success_url": f"{settings.web_base_url.rstrip('/')}/onboarding?checkout=success",
        "cancel_url": f"{settings.web_base_url.rstrip('/')}/apply?checkout=cancelled",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post("https://api.stripe.com/v1/checkout/sessions", auth=(settings.stripe_secret_key, ""), data=form)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Secure payment checkout is temporarily unavailable") from exc
    checkout_url, session_id = payload.get("url"), payload.get("id")
    if not checkout_url or not session_id:
        raise HTTPException(502, "Stripe did not return a secure checkout link")
    item.stripe_checkout_session_id = str(session_id)
    return str(checkout_url)


def membership_access_url(email: str) -> str:
    return f"{settings.web_base_url.rstrip('/')}/auth/login?returnTo=/onboarding&screen_hint=signup&login_hint={email}"


def application_payload(item: MembershipApplication) -> dict:
    tier = MEMBERSHIP_TIERS[item.tier]
    return {
        "id": item.id, "full_name": item.full_name, "email": item.email, "phone": item.phone,
        "tier": item.tier, "tier_name": tier["name"], "monthly_price": tier["price"],
        "note": item.note, "status": item.status, "payment_status": item.payment_status,
        "created_at": item.created_at, "reviewed_at": item.reviewed_at,
    }


async def activate_membership(item: MembershipApplication, db: AsyncSession, actor_id: UUID | None = None, source: str = "payment") -> None:
    client = await db.get(Client, item.client_id) if item.client_id else None
    if not client:
        client = Client(full_name=item.full_name, email=item.email, phone=item.phone, tier=MEMBERSHIP_TIERS[item.tier]["name"])
        db.add(client)
        await db.flush()
        item.client_id = client.id
    profile = dict(client.profile_data or {})
    profile.update({"membership_tier": item.tier, "membership_status": "active", "membership_application_id": str(item.id), "membership_source": source})
    client.profile_data = profile
    client.tier = MEMBERSHIP_TIERS[item.tier]["name"]
    item.status = "active"
    item.payment_status = "complimentary" if item.payment_status == "complimentary" else ("paid" if source == "stripe" else "confirmed_by_operator")
    item.reviewed_at = datetime.now(timezone.utc)
    item.reviewed_by_user_id = actor_id


async def find_membership_application(stripe_object: dict, db: AsyncSession) -> MembershipApplication | None:
    metadata = stripe_object.get("metadata") or {}
    application_id = metadata.get("vector_application_id") or stripe_object.get("client_reference_id")
    if application_id:
        try:
            item = await db.get(MembershipApplication, UUID(str(application_id)))
            if item:
                return item
        except ValueError:
            pass
    subscription_id = stripe_object.get("subscription") or (stripe_object.get("id") if stripe_object.get("object") == "subscription" else None)
    if subscription_id:
        item = await db.scalar(select(MembershipApplication).where(MembershipApplication.stripe_subscription_id == str(subscription_id)))
        if item:
            return item
    customer_id = stripe_object.get("customer")
    if customer_id:
        item = await db.scalar(select(MembershipApplication).where(MembershipApplication.stripe_customer_id == str(customer_id)))
        if item:
            return item
    email = str((stripe_object.get("customer_details") or {}).get("email") or stripe_object.get("customer_email") or "").lower().strip()
    return await db.scalar(select(MembershipApplication).where(MembershipApplication.email == email)) if email else None


def update_stripe_references(item: MembershipApplication, stripe_object: dict) -> None:
    customer_id = stripe_object.get("customer")
    subscription_id = stripe_object.get("subscription") or (stripe_object.get("id") if stripe_object.get("object") == "subscription" else None)
    if customer_id:
        item.stripe_customer_id = str(customer_id)
    if subscription_id:
        item.stripe_subscription_id = str(subscription_id)


def valid_stripe_signature(payload: bytes, signature: str | None) -> bool:
    if not settings.stripe_webhook_secret or not signature:
        return False
    parts = [part.split("=", 1) for part in signature.split(",") if "=" in part]
    timestamp = next((value for key, value in parts if key == "t"), None)
    received_signatures = [value for key, value in parts if key == "v1"]
    if not timestamp or not received_signatures:
        return False
    try:
        if abs(datetime.now(timezone.utc).timestamp() - int(timestamp)) > 300:
            return False
    except ValueError:
        return False
    expected = hmac.new(settings.stripe_webhook_secret.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, received) for received in received_signatures)


def profile_photo_data_url(client: Client) -> str | None:
    if not client.profile_photo or not client.profile_photo_mime:
        return None
    encoded = base64.b64encode(client.profile_photo).decode("ascii")
    return f"data:{client.profile_photo_mime};base64,{encoded}"


def decode_profile_photo(data_url: str) -> tuple[str, bytes]:
    try:
        header, encoded = data_url.split(",", 1)
        mime = header.removeprefix("data:").removesuffix(";base64")
        if not header.endswith(";base64"):
            raise ValueError
        content = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(422, "The selected photo could not be read") from None

    signatures = {
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP",
    }
    if mime not in signatures or not signatures[mime]:
        raise HTTPException(422, "Please choose a JPEG, PNG or WebP photo")
    if len(content) > 512_000:
        raise HTTPException(413, "The profile photo is too large")
    return mime, content


async def request_for_user(request_id: UUID, user: UserAccount, db: AsyncSession, scope: str = "requests:read") -> ConciergeRequest:
    item = await db.get(ConciergeRequest, request_id)
    if not item:
        raise HTTPException(404, "Request not found")
    await assert_client_access(user, item.client_id, db, scope)
    return item


async def preference_context_for_client(client_id: UUID, category: str, db: AsyncSession) -> list[str]:
    items = (await db.scalars(select(Preference).where(
        Preference.client_id == client_id,
        Preference.status != "hidden",
        Preference.confidence >= .75,
    ).order_by(Preference.confidence.desc(), Preference.updated_at.desc()))).all()
    return relevant_context(category, [(item.category, item.statement) for item in items])


async def register_learned_preferences(
    client_id: UUID,
    text: str,
    db: AsyncSession,
    *,
    source_type: str,
    source_reference: str | None = None,
    source_message_id: UUID | None = None,
    recorded_by_user_id: UUID | None = None,
    explicit: bool = False,
) -> list[Preference]:
    now = datetime.now(timezone.utc)
    saved: list[Preference] = []
    for signal in extract_preference_signals(text, explicit=explicit):
        existing = await db.scalar(select(Preference).where(
            Preference.client_id == client_id,
            Preference.category == signal.category,
            func.lower(Preference.statement) == signal.statement.lower(),
        ))
        if existing:
            existing.observation_count = (existing.observation_count or 1) + 1
            existing.last_observed_at = now
            existing.confidence = max(existing.confidence, signal.confidence)
            if explicit:
                existing.status = "confirmed"
                existing.source_type = source_type
            saved.append(existing)
            continue
        item = Preference(
            client_id=client_id, category=signal.category, statement=signal.statement,
            confidence=signal.confidence, source_message_id=source_message_id,
            source_type=source_type, source_reference=source_reference,
            status="confirmed" if explicit else "inferred", observation_count=1,
            last_observed_at=now, recorded_by_user_id=recorded_by_user_id,
        )
        db.add(item)
        saved.append(item)
    return saved


async def request_payload(item: ConciergeRequest, db: AsyncSession) -> dict:
    client = await db.get(Client, item.client_id)
    message = await db.scalar(select(Message).where(
        Message.request_id == item.id, Message.direction == "inbound",
    ).order_by(Message.received_at.asc()))
    triage_audit = await db.scalar(select(AuditAction).where(
        AuditAction.request_id == item.id, AuditAction.action == "ai_triage",
    ).order_by(AuditAction.created_at.desc()))
    name = client.full_name if client else None
    return {
        "id": item.id, "reference": item.reference, "client_id": item.client_id,
        "title": item.title, "category": item.category, "urgency": item.urgency,
        "status": item.status, "budget_amount": item.budget_amount, "currency": item.currency,
        "ai_confidence": item.ai_confidence, "ai_draft": item.ai_draft,
        "requires_approval": item.requires_approval, "owner": item.owner,
        "client_name": name,
        "client_initials": "".join(part[0] for part in name.split())[:2].upper() if name else None,
        "client_tier": client.tier if client else None,
        "message": message.body if message else None, "channel": message.channel if message else None,
        "created_at": item.created_at,
        "ai_reasons": (triage_audit.payload or {}).get("reasons", []) if triage_audit else [],
    }


@app.get("/health")
async def health():
    return {
        "status": "ok", "service": "vector-api", "environment": settings.environment,
        "partner": settings.partner_provider, "whatsapp": "enabled" if settings.whatsapp_enabled else "disabled",
        "operator_research": "enabled" if settings.openai_research_enabled and settings.openai_api_key else "disabled",
        "flight_search": "enabled" if settings.nuitee_api_key else "disabled",
    }


@app.get("/capabilities")
async def capabilities(user: UserAccount = Depends(current_user)):
    return {
        "operator_research": settings.openai_research_enabled and bool(settings.openai_api_key),
        "research_model": settings.openai_model if user.role in (UserRole.operator, UserRole.admin) else None,
        "hotel_partner": settings.partner_provider,
        "hotel_booking": settings.partner_booking_enabled,
        "flight_search": bool(settings.nuitee_api_key) and user.role in (UserRole.operator, UserRole.admin),
        "whatsapp": settings.whatsapp_enabled,
        "safety": {"research_only": True, "human_approval_required": True},
    }


@app.get("/privacy/requests", response_model=list[PrivacyRequestOut])
async def list_privacy_requests(user: UserAccount = Depends(current_user), db: AsyncSession = Depends(get_db)):
    query = select(PrivacyRequest).order_by(PrivacyRequest.created_at.desc())
    if user.role not in {UserRole.operator, UserRole.admin}:
        if not user.client_id:
            return []
        query = query.where(PrivacyRequest.client_id == user.client_id)
    items = (await db.scalars(query)).all()
    result = []
    for item in items:
        client = await db.get(Client, item.client_id)
        result.append({**{"id": item.id, "request_type": item.request_type, "status": item.status, "note": item.note, "created_at": item.created_at, "resolved_at": item.resolved_at}, "client_name": client.full_name if client and user.role in {UserRole.operator, UserRole.admin} else None, "client_email": client.email if client and user.role in {UserRole.operator, UserRole.admin} else None})
    return result


@app.post("/privacy/requests", response_model=PrivacyRequestOut, status_code=201)
async def create_privacy_request(data: PrivacyRequestIn, user: UserAccount = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if not user.client_id:
        raise HTTPException(400, "A client account is required for a privacy request")
    item = PrivacyRequest(client_id=user.client_id, request_type=data.request_type, note=data.note)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@app.patch("/privacy/requests/{privacy_request_id}", response_model=PrivacyRequestOut)
async def update_privacy_request(privacy_request_id: UUID, data: PrivacyRequestUpdate, user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)), db: AsyncSession = Depends(get_db)):
    item = await db.get(PrivacyRequest, privacy_request_id)
    if not item:
        raise HTTPException(404, "Privacy request not found")
    item.status = data.status
    item.handled_by_user_id = user.id
    item.resolved_at = datetime.now(timezone.utc) if data.status == "resolved" else None
    await db.commit()
    await db.refresh(item)
    client = await db.get(Client, item.client_id)
    return {"id": item.id, "request_type": item.request_type, "status": item.status, "note": item.note, "created_at": item.created_at, "resolved_at": item.resolved_at, "client_name": client.full_name if client else None, "client_email": client.email if client else None}


@app.get("/webhooks/whatsapp")
async def verify_whatsapp_webhook(
    mode: str | None = Query(default=None, alias="hub.mode"),
    verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
):
    if not settings.whatsapp_verify_token:
        raise HTTPException(503, "WhatsApp webhook verification is not configured")
    if mode != "subscribe" or not verify_token or not secrets.compare_digest(verify_token, settings.whatsapp_verify_token):
        raise HTTPException(403, "WhatsApp webhook verification failed")
    return Response(content=challenge or "", media_type="text/plain")


async def client_for_whatsapp_phone(phone: str | None, db: AsyncSession) -> Client | None:
    normalized = normalize_whatsapp_phone(phone)
    if not normalized:
        return None
    clients = (await db.scalars(select(Client).where(Client.phone.is_not(None)))).all()
    return next((client for client in clients if normalize_whatsapp_phone(client.phone) == normalized), None)


@app.post("/webhooks/whatsapp")
async def receive_whatsapp_webhook(
    request: Request,
    signature: str | None = Header(default=None, alias="X-Hub-Signature-256"),
    db: AsyncSession = Depends(get_db),
):
    if not settings.whatsapp_enabled:
        raise HTTPException(503, "WhatsApp is not enabled")
    raw_body = await request.body()
    if not verify_webhook_signature(raw_body, signature, settings.whatsapp_app_secret):
        raise HTTPException(401, "Invalid WhatsApp webhook signature")
    try:
        payload = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(400, "Invalid WhatsApp webhook payload") from exc

    incoming, statuses = parse_webhook(payload)
    for status in statuses:
        message = await db.scalar(select(Message).where(Message.external_id == status.message_id))
        if message:
            message.delivery_status = status.status

    processed = 0
    for incoming_message in incoming:
        existing = await db.scalar(select(InboundWebhookEvent).where(InboundWebhookEvent.external_id == incoming_message.message_id))
        if existing:
            continue
        sender = normalize_whatsapp_phone(incoming_message.sender)
        event = InboundWebhookEvent(
            provider="whatsapp", external_id=incoming_message.message_id, sender=sender,
            message_type=incoming_message.message_type, body=incoming_message.body,
            status="received", payload_summary={"timestamp": incoming_message.timestamp},
        )
        db.add(event)
        await db.flush()

        if incoming_message.message_type != "text" or not incoming_message.body:
            event.status = "unsupported"
            continue
        client = await client_for_whatsapp_phone(sender, db)
        if not client:
            event.status = "unmatched"
            continue

        preliminary = triage(incoming_message.body, "other", None)
        preference_context = await preference_context_for_client(client.id, preliminary.category, db)
        result = triage(incoming_message.body, preliminary.category, None, preference_context)
        conversation_start = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_message = await db.scalar(select(Message).join(
            ConciergeRequest, Message.request_id == ConciergeRequest.id,
        ).where(
            ConciergeRequest.client_id == client.id,
            ConciergeRequest.status.notin_([RequestStatus.closed, RequestStatus.confirmed]),
            Message.channel == "whatsapp",
            Message.received_at >= conversation_start,
        ).order_by(Message.received_at.desc()))
        item = await db.get(ConciergeRequest, recent_message.request_id) if recent_message else None
        if item:
            item.intent = result.category
            item.category = result.category
            item.urgency = result.urgency
            item.ai_confidence = result.confidence
            item.ai_draft = result.draft
            if result.requires_approval:
                item.status = RequestStatus.awaiting_approval
                item.requires_approval = True
        else:
            item = ConciergeRequest(
                reference=f"VEC-WA-{uuid4().hex[:8].upper()}", client_id=client.id,
                title=f"WhatsApp: {incoming_message.body.strip()[:100]}",
                intent=result.category, category=result.category, urgency=result.urgency,
                status=RequestStatus.awaiting_approval if result.requires_approval else RequestStatus.triaged,
                ai_confidence=result.confidence, ai_draft=result.draft, requires_approval=result.requires_approval,
            )
            db.add(item)
            await db.flush()
        stored_message = Message(
            request_id=item.id, channel="whatsapp", direction="inbound",
            body=incoming_message.body, external_id=incoming_message.message_id, delivery_status="received",
        )
        db.add(stored_message)
        await db.flush()
        learned = await register_learned_preferences(
            client.id, incoming_message.body, db, source_type="service_request",
            source_reference=item.reference, source_message_id=stored_message.id,
        )
        await db.flush()
        db.add(AuditAction(
            request_id=item.id, actor=f"whatsapp:{sender}",
            action="whatsapp_message_received" if recent_message else "request_created",
            payload={"channel": "whatsapp", "provider_message_id": incoming_message.message_id},
        ))
        db.add(AuditAction(request_id=item.id, actor="system", action="ai_triage", payload={"reasons": result.reasons, "preferences_applied": preference_context}))
        if learned:
            db.add(AuditAction(request_id=item.id, actor="system", action="preferences_learned", payload={"preference_ids": [str(pref.id) for pref in learned], "source": "whatsapp"}))
        if result.requires_approval:
            pending_approval = await db.scalar(select(Approval).where(
                Approval.request_id == item.id, Approval.decision == ApprovalDecision.pending,
            ))
            if not pending_approval:
                db.add(Approval(
                    request_id=item.id, action_type="recommendation",
                    summary="Review recommendation before any external commitment",
                ))
        event.request_id = item.id
        event.status = "processed"
        processed += 1

    await db.commit()
    return {"received": len(incoming), "processed": processed}


@app.get("/integrations/whatsapp/unmatched")
async def list_unmatched_whatsapp_messages(
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    events = (await db.scalars(
        select(InboundWebhookEvent)
        .where(InboundWebhookEvent.provider == "whatsapp", InboundWebhookEvent.status == "unmatched")
        .order_by(InboundWebhookEvent.received_at.desc())
        .limit(100)
    )).all()
    return [{
        "id": event.id, "sender": event.sender, "message_type": event.message_type,
        "body": event.body, "status": event.status, "received_at": event.received_at,
    } for event in events]


@app.get("/integrations/whatsapp/inbox")
async def whatsapp_operator_inbox(
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    request_ids = (await db.scalars(
        select(Message.request_id)
        .where(Message.channel == "whatsapp")
        .distinct()
        .limit(100)
    )).all()
    threads = []
    for request_id in request_ids:
        item = await db.get(ConciergeRequest, request_id)
        if not item:
            continue
        client = await db.get(Client, item.client_id)
        messages = (await db.scalars(
            select(Message).where(Message.request_id == request_id, Message.channel == "whatsapp")
            .order_by(Message.received_at)
        )).all()
        threads.append({
            "request_id": item.id,
            "reference": item.reference,
            "client_name": client.full_name if client else "Unknown client",
            "client_phone": client.phone if client else None,
            "title": item.title,
            "category": item.category,
            "urgency": item.urgency,
            "status": item.status.value,
            "requires_approval": item.requires_approval,
            "ai_draft": item.ai_draft,
            "updated_at": item.updated_at,
            "messages": [{
                "id": message.id,
                "direction": message.direction,
                "body": message.body,
                "delivery_status": message.delivery_status,
                "received_at": message.received_at,
            } for message in messages],
        })
    threads.sort(key=lambda thread: thread["updated_at"], reverse=True)
    unmatched = (await db.scalars(
        select(InboundWebhookEvent)
        .where(InboundWebhookEvent.provider == "whatsapp", InboundWebhookEvent.status == "unmatched")
        .order_by(InboundWebhookEvent.received_at.desc())
        .limit(100)
    )).all()
    return {
        "threads": threads,
        "unmatched": [{
            "id": event.id, "sender": event.sender, "body": event.body,
            "message_type": event.message_type, "received_at": event.received_at,
        } for event in unmatched],
    }


@app.post("/requests/{request_id}/messages/whatsapp", response_model=WhatsAppMessageOut)
async def send_whatsapp_message(
    request_id: UUID,
    data: WhatsAppSendIn,
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    item = await request_for_user(request_id, user, db)
    client = await db.get(Client, item.client_id)
    if not client or not normalize_whatsapp_phone(client.phone):
        raise HTTPException(409, "The client does not have a verified WhatsApp number")
    window_start = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_inbound = await db.scalar(select(Message).where(
        Message.request_id == item.id,
        Message.channel == "whatsapp",
        Message.direction == "inbound",
        Message.received_at >= window_start,
    ).order_by(Message.received_at.desc()))
    if not recent_inbound:
        raise HTTPException(409, "The 24-hour service window is closed; use an approved WhatsApp template")
    try:
        provider_message_id, status = await WhatsAppCloudAdapter().send_text(client.phone or "", data.body)
    except WhatsAppError as exc:
        raise HTTPException(502, str(exc)) from exc
    message = Message(
        request_id=item.id, channel="whatsapp", direction="outbound", body=data.body,
        external_id=provider_message_id, delivery_status=status,
    )
    db.add(message)
    await db.flush()
    db.add(AuditAction(
        request_id=item.id, actor=str(user.id), action="whatsapp_message_sent",
        payload={"provider_message_id": provider_message_id},
    ))
    await db.commit()
    return {"message_id": message.id, "provider_message_id": provider_message_id, "status": status}


@app.post("/auth/login", response_model=LoginOut)
async def login(data: LoginIn, db: AsyncSession = Depends(get_db)):
    if not settings.allow_local_password_auth:
        raise HTTPException(503, "Local password authentication is disabled; configure the managed identity gateway")
    email = data.email.lower().strip()
    user = await db.scalar(select(UserAccount).where(UserAccount.email == email, UserAccount.is_active.is_(True)))
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    token = new_token()
    db.add(UserSession(user_id=user.id, token_hash=hash_token(token), expires_at=token_expiry(hours=settings.session_hours)))
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    return {"access_token": token, "token_type": "bearer", "user": user_payload(user)}


@app.get("/auth/me", response_model=UserOut)
async def me(user: UserAccount = Depends(current_user)):
    return user_payload(user)


@app.post("/auth/logout", status_code=204)
async def logout(response: Response, user: UserAccount = Depends(current_user), db: AsyncSession = Depends(get_db)):
    sessions = (await db.scalars(select(UserSession).where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None)))).all()
    now = datetime.now(timezone.utc)
    for session in sessions:
        session.revoked_at = now
    await db.commit()
    response.status_code = 204


@app.post("/auth/forgot-password", response_model=ForgotPasswordOut)
async def forgot_password(data: ForgotPasswordIn, db: AsyncSession = Depends(get_db)):
    email = data.email.lower().strip()
    user = await db.scalar(select(UserAccount).where(UserAccount.email == email, UserAccount.is_active.is_(True)))
    preview = None
    if user:
        token = new_token()
        if not settings.is_production:
            preview = build_reset_link(token)
        db.add(PasswordResetToken(user_id=user.id, token_hash=hash_token(token), expires_at=token_expiry(hours=2)))
        await db.commit()
    return {"message": "If an account exists, a secure reset link has been sent to that email.", "reset_link_preview": preview}


@app.post("/auth/reset-password", response_model=ResetPasswordOut)
async def reset_password(data: ResetPasswordIn, db: AsyncSession = Depends(get_db)):
    reset = await db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(data.token), PasswordResetToken.used_at.is_(None)))
    now = datetime.now(timezone.utc)
    if not reset or reset.expires_at < now:
        raise HTTPException(400, "Reset link is invalid or expired")
    user = await db.get(UserAccount, reset.user_id)
    if not user or not user.is_active:
        raise HTTPException(400, "Reset link is invalid or expired")
    user.password_hash = hash_password(data.password)
    reset.used_at = now
    sessions = (await db.scalars(select(UserSession).where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None)))).all()
    for session in sessions:
        session.revoked_at = now
    await db.commit()
    return {"message": "Password reset. You can now sign in."}


@app.post("/membership/applications")
async def apply_for_membership(data: MembershipApplicationIn, db: AsyncSession = Depends(get_db)):
    """Public application endpoint. It never grants paid access before review or payment confirmation."""
    email = data.email.lower().strip()
    if await db.scalar(select(MembershipApplication).where(MembershipApplication.email == email)):
        raise HTTPException(409, "An application is already in progress for this email address")
    if await db.scalar(select(Client).where(Client.email == email)):
        raise HTTPException(409, "This email already has a Vector profile. Please sign in instead.")

    invite: InviteKey | None = None
    if data.invite_code and data.invite_code.strip():
        invite = await db.scalar(select(InviteKey).where(InviteKey.code_hash == hash_token(data.invite_code.strip().upper())))
        now = datetime.now(timezone.utc)
        if not invite or invite.redeemed_at or (invite.valid_until and invite.valid_until <= now):
            raise HTTPException(400, "That invitation code is not available")
        if invite.tier != data.tier:
            raise HTTPException(400, "That invitation code is for a different membership level")

    payment_link = membership_payment_link(data.tier)
    item = MembershipApplication(
        full_name=data.full_name.strip(), email=email, phone=data.phone.strip() if data.phone else None,
        tier=data.tier, note=data.note.strip() if data.note else None,
        status="active" if invite else "payment_pending",
        payment_status="complimentary" if invite else ("checkout_ready" if payment_link else "operator_review"),
        invite_key_id=invite.id if invite else None,
    )
    db.add(item)
    await db.flush()
    client = Client(
        full_name=item.full_name, email=item.email, phone=item.phone, tier=MEMBERSHIP_TIERS[item.tier]["name"],
        profile_data={"membership_tier": item.tier, "membership_status": "active" if invite else "payment_pending", "membership_application_id": str(item.id), "membership_source": "invite" if invite else "application", "anything_else": item.note or ""},
    )
    db.add(client)
    await db.flush()
    item.client_id = client.id
    if invite:
        invite.redeemed_at = datetime.now(timezone.utc)
        invite.redeemed_by_application_id = item.id
    if not invite:
        payment_link = await create_membership_checkout(item)
    await db.commit()
    response = {
        "application": application_payload(item),
        "checkout_url": None if invite else payment_link,
        "access_url": membership_access_url(email) if invite else None,
        "message": "Your invitation has activated complimentary access." if invite else "Your application is with the Vector private office.",
    }
    return response


@app.get("/membership/applications")
async def list_membership_applications(
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    items = (await db.scalars(select(MembershipApplication).order_by(MembershipApplication.created_at.desc()))).all()
    return [application_payload(item) for item in items]


@app.post("/membership/applications/{application_id}/enable")
async def enable_membership_application(
    application_id: UUID,
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(MembershipApplication, application_id)
    if not item:
        raise HTTPException(404, "Membership application not found")
    await activate_membership(item, db, user.id, "operator_enabled")
    await db.commit()
    return {"application": application_payload(item), "access_url": membership_access_url(item.email)}


@app.post("/webhooks/stripe", include_in_schema=False)
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"), db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    if not valid_stripe_signature(payload, stripe_signature):
        raise HTTPException(400, "Invalid Stripe signature")
    try:
        event = json.loads(payload)
        event_type = event.get("type")
        session = event.get("data", {}).get("object", {})
    except ValueError:
        raise HTTPException(400, "Invalid Stripe event") from None
    item = await find_membership_application(session, db)
    if event_type == "checkout.session.completed" and item:
        update_stripe_references(item, session)
        if item.status == "payment_pending":
            await activate_membership(item, db, source="stripe")
        await db.commit()
    elif event_type == "invoice.paid" and item:
        update_stripe_references(item, session)
        await activate_membership(item, db, source="stripe")
        await db.commit()
    elif event_type == "invoice.payment_failed" and item:
        item.payment_status = "payment_failed"
        client = await db.get(Client, item.client_id) if item.client_id else None
        if client:
            profile = dict(client.profile_data or {})
            profile["membership_status"] = "past_due"
            client.profile_data = profile
        await db.commit()
    elif event_type == "customer.subscription.deleted" and item:
        item.payment_status = "cancelled"
        item.status = "cancelled"
        client = await db.get(Client, item.client_id) if item.client_id else None
        if client:
            profile = dict(client.profile_data or {})
            profile["membership_status"] = "cancelled"
            client.profile_data = profile
        await db.commit()
    return {"received": True}


@app.get("/membership/invite-keys")
async def list_invite_keys(
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    keys = (await db.scalars(select(InviteKey).order_by(InviteKey.created_at.desc()))).all()
    return [{"id": key.id, "label": key.label, "tier": key.tier, "valid_until": key.valid_until, "redeemed_at": key.redeemed_at} for key in keys]


@app.post("/membership/invite-keys")
async def create_invite_key(
    data: InviteKeyIn,
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    normalized = data.code.strip().upper()
    key = InviteKey(code_hash=hash_token(normalized), label=data.label.strip(), tier=data.tier, valid_until=data.valid_until)
    db.add(key)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(409, "That invitation code already exists") from None
    return {"id": key.id, "label": key.label, "tier": key.tier, "valid_until": key.valid_until, "code": normalized}


@app.get("/requests", response_model=list[RequestOut])
async def list_requests(user: UserAccount = Depends(current_user), db: AsyncSession = Depends(get_db)):
    query = select(ConciergeRequest).order_by(ConciergeRequest.created_at.desc())
    if user.role not in {UserRole.operator, UserRole.admin}:
        items = (await db.scalars(query)).all()
        visible = []
        for item in items:
            try:
                await assert_client_access(user, item.client_id, db, "requests:read")
                visible.append(item)
            except HTTPException:
                continue
        return [await request_payload(item, db) for item in visible]
    items = (await db.scalars(query)).all()
    return [await request_payload(item, db) for item in items]


@app.get("/clients", response_model=list[ClientOut])
async def list_clients(
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    clients = (await db.scalars(
        select(Client).options(selectinload(Client.preferences), selectinload(Client.household)).order_by(Client.full_name)
    )).all()
    return [{
        "id": client.id,
        "full_name": client.full_name,
        "email": client.email,
        "tier": client.tier,
        "phone": client.phone,
        "timezone": client.timezone,
        "onboarding_completed_at": client.onboarding_completed_at,
        "profile_data": client.profile_data or {},
        "household_notes": client.household.notes if client.household else None,
        "preferences": [{
            "id": item.id, "category": item.category, "statement": item.statement,
            "confidence": item.confidence, "source_type": item.source_type,
            "source_reference": item.source_reference, "status": item.status,
            "observation_count": item.observation_count,
        } for item in client.preferences],
        "profile_photo_data_url": profile_photo_data_url(client),
    } for client in clients]


@app.get("/onboarding", response_model=OnboardingOut)
async def get_onboarding(
    user: UserAccount = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.client_id:
        return {
            "completed": True,
            "full_name": user.full_name,
            "email": user.email,
            "profile": {"account_role": user.role.value},
        }
    client = await db.get(Client, user.client_id)
    if not client:
        raise HTTPException(404, "Client profile not found")
    return {
        "completed": client.onboarding_completed_at is not None,
        "full_name": client.full_name,
        "email": client.email or user.email,
        "phone": client.phone,
        "timezone": client.timezone,
        "profile": client.profile_data or {},
        "profile_photo_data_url": profile_photo_data_url(client),
    }


@app.put("/profile-photo")
async def update_profile_photo(
    data: ProfilePhotoIn,
    user: UserAccount = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.client_id or user.role not in {UserRole.client, UserRole.pa}:
        raise HTTPException(403, "Only client profiles can add a profile photo")
    client = await db.get(Client, user.client_id)
    if not client:
        raise HTTPException(404, "Client profile not found")
    mime, content = decode_profile_photo(data.data_url)
    client.profile_photo = content
    client.profile_photo_mime = mime
    client.profile_photo_updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"profile_photo_data_url": profile_photo_data_url(client)}


@app.delete("/profile-photo", status_code=204)
async def remove_profile_photo(
    user: UserAccount = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.client_id or user.role not in {UserRole.client, UserRole.pa}:
        raise HTTPException(403, "Only client profiles can remove a profile photo")
    client = await db.get(Client, user.client_id)
    if not client:
        raise HTTPException(404, "Client profile not found")
    client.profile_photo = None
    client.profile_photo_mime = None
    client.profile_photo_updated_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=204)


@app.put("/onboarding", response_model=OnboardingOut)
async def complete_onboarding(
    data: OnboardingIn,
    user: UserAccount = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not data.confirmed_accurate:
        raise HTTPException(422, "Please confirm the information is accurate")
    if not user.client_id or user.role not in {UserRole.client, UserRole.pa}:
        raise HTTPException(403, "Only client profiles can complete onboarding")
    client = await db.get(Client, user.client_id)
    if not client:
        raise HTTPException(404, "Client profile not found")

    now = datetime.now(timezone.utc)
    profile = data.model_dump(exclude={"full_name", "phone", "timezone", "confirmed_accurate"})
    profile.update({"onboarding_version": 1, "submitted_at": now.isoformat()})
    client.full_name = data.full_name.strip()
    client.phone = data.phone.strip() if data.phone else None
    client.timezone = data.timezone
    client.profile_data = profile
    client.onboarding_completed_at = now
    user.full_name = client.full_name

    if data.household:
        household = await db.get(Household, client.household_id) if client.household_id else None
        if not household:
            household = Household(name=f"{client.full_name} household", notes=data.household.strip())
            db.add(household)
            await db.flush()
            client.household_id = household.id
        else:
            household.notes = data.household.strip()

    await db.execute(delete(Preference).where(
        Preference.client_id == client.id,
        Preference.category.like("onboarding:%"),
    ))
    preference_values = {
        "travel_style": data.travel_style,
        "hotel_style": data.hotel_style,
        "interests": data.interests,
    }
    for category, values in preference_values.items():
        for value in values:
            if value.strip():
                db.add(Preference(
                    client_id=client.id, category=f"onboarding:{category}", statement=value.strip(), confidence=1.0,
                    source_type="questionnaire", source_reference="initial_client_questionnaire", status="confirmed",
                    last_observed_at=now, recorded_by_user_id=user.id,
                ))
    free_text_preferences = {
        "flight_preferences": data.flight_preferences,
        "dietary_requirements": data.dietary_requirements,
        "accessibility_requirements": data.accessibility_requirements,
        "service_style": data.service_style,
        "important_dates": data.important_dates,
        "anything_else": data.anything_else,
    }
    for category, value in free_text_preferences.items():
        if value and value.strip():
            db.add(Preference(
                client_id=client.id, category=f"onboarding:{category}", statement=value.strip(), confidence=1.0,
                source_type="questionnaire", source_reference="initial_client_questionnaire", status="confirmed",
                last_observed_at=now, recorded_by_user_id=user.id,
            ))

    await db.commit()
    await db.refresh(client)
    return {
        "completed": True,
        "full_name": client.full_name,
        "email": client.email or user.email,
        "phone": client.phone,
        "timezone": client.timezone,
        "profile": client.profile_data,
        "profile_photo_data_url": profile_photo_data_url(client),
    }


@app.post("/preferences/feedback")
async def record_client_feedback(
    data: ClientFeedbackIn,
    user: UserAccount = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.client_id or user.role not in {UserRole.client, UserRole.pa}:
        raise HTTPException(403, "Only clients and their authorised delegates can add feedback")
    request_item = None
    if data.request_id:
        request_item = await request_for_user(data.request_id, user, db)
    now = datetime.now(timezone.utc)
    feedback = Preference(
        client_id=user.client_id, category="feedback_note", statement=data.note.strip(), confidence=1.0,
        source_type="client_feedback", source_reference=request_item.reference if request_item else "member_profile",
        status="confirmed", observation_count=1, last_observed_at=now, recorded_by_user_id=user.id,
    )
    db.add(feedback)
    learned = await register_learned_preferences(
        user.client_id, data.note, db, source_type="client_feedback",
        source_reference=request_item.reference if request_item else "member_profile",
        recorded_by_user_id=user.id, explicit=True,
    )
    await db.commit()
    return {"saved": True, "preferences_registered": len(learned), "message": "Thank you. Your feedback is now part of your private profile."}


OPERATIONAL_KINDS = {"mandate", "journey", "proof_event", "decision_capsule"}


def operational_payload(record: OperationalRecord) -> dict:
    return {"id": record.id, "kind": record.kind, "client_id": record.client_id, "request_id": record.request_id, "title": record.title, "status": record.status, "payload": record.payload or {}, "created_at": record.created_at, "updated_at": record.updated_at}


@app.get("/operations/{kind}", response_model=list[OperationalRecordOut])
async def list_operational_records(kind: str, request_id: UUID | None = None, user: UserAccount = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if kind not in OPERATIONAL_KINDS:
        raise HTTPException(404, "Unknown operational record type")
    query = select(OperationalRecord).where(OperationalRecord.kind == kind).order_by(OperationalRecord.updated_at.desc())
    if request_id:
        query = query.where(OperationalRecord.request_id == request_id)
    records = (await db.scalars(query)).all()
    if user.role in {UserRole.operator, UserRole.admin}:
        return [operational_payload(record) for record in records]
    visible = []
    for record in records:
        if record.client_id:
            try:
                await assert_client_access(user, record.client_id, db, "requests:read")
                visible.append(operational_payload(record))
            except HTTPException:
                continue
    return visible


@app.post("/operations/{kind}", response_model=OperationalRecordOut, status_code=201)
async def create_operational_record(kind: str, data: OperationalRecordIn, user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)), db: AsyncSession = Depends(get_db)):
    if kind not in OPERATIONAL_KINDS:
        raise HTTPException(404, "Unknown operational record type")
    if not data.client_id and not data.request_id:
        raise HTTPException(422, "A client or request is required")
    if data.request_id:
        request_item = await request_for_user(data.request_id, user, db)
        if data.client_id and data.client_id != request_item.client_id:
            raise HTTPException(422, "The selected client does not match the request")
        client_id = request_item.client_id
    else:
        client_id = data.client_id
        if not await db.get(Client, client_id):
            raise HTTPException(404, "Client profile not found")
    record = OperationalRecord(kind=kind, client_id=client_id, request_id=data.request_id, title=data.title, status=data.status, payload=data.payload, created_by_user_id=user.id)
    db.add(record)
    await db.flush()
    if kind == "decision_capsule" and data.request_id:
        amount = data.payload.get("amount")
        approval = Approval(request_id=data.request_id, action_type="decision_capsule", summary=str(data.payload.get("summary") or data.title), amount=amount if isinstance(amount, (int, float)) else None)
        db.add(approval)
        await db.flush()
        record.payload = {**record.payload, "approval_id": str(approval.id)}
    if data.request_id:
        db.add(AuditAction(request_id=data.request_id, actor=str(user.id), action=f"{kind}_created", payload={"record_id": str(record.id)}))
    await db.commit()
    await db.refresh(record)
    return operational_payload(record)


@app.patch("/operations/{kind}/{record_id}", response_model=OperationalRecordOut)
async def update_operational_record(kind: str, record_id: UUID, data: OperationalRecordUpdate, user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)), db: AsyncSession = Depends(get_db)):
    record = await db.get(OperationalRecord, record_id)
    if not record or record.kind != kind:
        raise HTTPException(404, "Operational record not found")
    if data.title is not None:
        record.title = data.title
    if data.status is not None:
        record.status = data.status
    if data.payload is not None:
        record.payload = data.payload
    if record.request_id:
        db.add(AuditAction(request_id=record.request_id, actor=str(user.id), action=f"{kind}_updated", payload={"record_id": str(record.id), "status": record.status}))
    await db.commit()
    await db.refresh(record)
    return operational_payload(record)


@app.post("/clients/{client_id}/preferences", status_code=201)
async def record_employee_preference(
    client_id: UUID,
    data: EmployeePreferenceIn,
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(404, "Client profile not found")
    category_map = {"preferences": "general", "life": "interest", "dietary": "dietary", "serviceStyle": "service_style"}
    now = datetime.now(timezone.utc)
    item = Preference(
        client_id=client.id, category=category_map.get(data.category, data.category),
        statement=f"{data.label.strip()}: {data.note.strip()}", confidence=1.0 if data.confirmed_by_client else .85,
        source_type="employee_note", source_reference=user.full_name,
        status="confirmed" if data.confirmed_by_client else "operator_recorded",
        observation_count=1, last_observed_at=now, recorded_by_user_id=user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {
        "id": item.id, "category": item.category, "statement": item.statement,
        "confidence": item.confidence, "source_type": item.source_type,
        "source_reference": item.source_reference, "status": item.status,
        "observation_count": item.observation_count,
    }


@app.get("/contacts", response_model=NetworkContactListOut)
async def list_network_contacts(
    q: str = Query(default="", max_length=160),
    company: str = Query(default="", max_length=160),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=60, ge=1, le=200),
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if q.strip():
        pattern = f"%{q.strip()}%"
        filters.append(or_(
            NetworkContact.full_name.ilike(pattern),
            NetworkContact.company.ilike(pattern),
            NetworkContact.position.ilike(pattern),
        ))
    if company.strip():
        filters.append(NetworkContact.company.ilike(f"%{company.strip()}%"))
    total_query = select(func.count()).select_from(NetworkContact)
    items_query = select(NetworkContact).order_by(NetworkContact.connected_on.desc().nullslast(), NetworkContact.full_name)
    if filters:
        total_query = total_query.where(*filters)
        items_query = items_query.where(*filters)
    total = int(await db.scalar(total_query) or 0)
    items = (await db.scalars(items_query.offset(offset).limit(limit))).all()
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@app.post("/requests", response_model=RequestOut, status_code=201)
async def create_request(data: RequestCreate, user: UserAccount = Depends(current_user), db: AsyncSession = Depends(get_db)):
    client_id = data.client_id or user.client_id
    if not client_id:
        raise HTTPException(400, "client_id is required for staff-created requests")
    await assert_client_access(user, client_id, db, "requests:create")
    count = await db.scalar(select(func.count()).select_from(ConciergeRequest))
    preliminary = triage(data.message, data.category, data.budget_amount)
    preference_context = await preference_context_for_client(client_id, preliminary.category, db)
    result = triage(data.message, preliminary.category, data.budget_amount, preference_context)
    item = ConciergeRequest(
        reference=f"VEC-{1049 + (count or 0)}", client_id=client_id, title=data.title,
        intent=result.category, category=result.category, urgency=result.urgency,
        status=RequestStatus.awaiting_approval if result.requires_approval else RequestStatus.triaged,
        budget_amount=data.budget_amount, ai_confidence=result.confidence, ai_draft=result.draft,
        requires_approval=result.requires_approval,
    )
    db.add(item)
    await db.flush()
    message = Message(request_id=item.id, channel=data.channel, direction="inbound", body=data.message)
    db.add(message)
    await db.flush()
    learned = await register_learned_preferences(
        client_id, data.message, db, source_type="service_request",
        source_reference=item.reference, source_message_id=message.id,
        recorded_by_user_id=user.id,
    )
    await db.flush()
    db.add(AuditAction(request_id=item.id, actor=str(user.id), action="request_created", payload={"channel": data.channel}))
    db.add(AuditAction(request_id=item.id, actor="system", action="ai_triage", payload={"reasons": result.reasons, "preferences_applied": preference_context}))
    if learned:
        db.add(AuditAction(request_id=item.id, actor="system", action="preferences_learned", payload={"preference_ids": [str(pref.id) for pref in learned], "source": data.channel}))
    if result.requires_approval:
        db.add(Approval(request_id=item.id, action_type="recommendation", summary="Review recommendation before any external commitment", amount=data.budget_amount))
    await db.commit()
    await db.refresh(item)
    return await request_payload(item, db)


@app.post("/requests/{request_id}/triage", response_model=TriageOut)
async def preview_triage(request_id: UUID, user: UserAccount = Depends(current_user), db: AsyncSession = Depends(get_db)):
    item = await request_for_user(request_id, user, db)
    message = await db.scalar(select(Message).where(Message.request_id == request_id, Message.direction == "inbound").order_by(Message.received_at))
    preference_context = await preference_context_for_client(item.client_id, item.category, db)
    result = triage(message.body if message else item.title, item.category, float(item.budget_amount) if item.budget_amount else None, preference_context)
    return result.__dict__


def operator_research_payload(run: OperatorResearchRun) -> dict:
    result = run.result or {}
    return {
        "id": run.id, "request_id": run.request_id, "status": run.status, "model": run.model,
        "headline": result.get("headline", ""), "summary": result.get("summary", ""),
        "options": result.get("options", []), "risks": result.get("risks", []),
        "preferences_applied": result.get("preferences_applied", []), "verification_required": result.get("verification_required", []),
        "next_actions": result.get("next_actions", []), "draft_reply": result.get("draft_reply", ""),
        "input_tokens": run.input_tokens, "output_tokens": run.output_tokens, "created_at": run.created_at,
    }


@app.get("/requests/{request_id}/research", response_model=list[OperatorResearchOut])
async def list_operator_research(
    request_id: UUID,
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    await request_for_user(request_id, user, db)
    runs = (await db.scalars(select(OperatorResearchRun).where(
        OperatorResearchRun.request_id == request_id,
        OperatorResearchRun.status == "completed",
    ).order_by(OperatorResearchRun.created_at.desc()).limit(10))).all()
    return [operator_research_payload(run) for run in runs]


@app.post("/requests/{request_id}/research", response_model=OperatorResearchOut, status_code=201)
async def create_operator_research(
    request_id: UUID,
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    if not settings.openai_research_enabled or not settings.openai_api_key:
        raise HTTPException(503, "Live operator research is not enabled")
    item = await request_for_user(request_id, user, db)
    since = datetime.now(timezone.utc) - timedelta(days=1)
    daily_count = await db.scalar(select(func.count()).select_from(OperatorResearchRun).where(
        OperatorResearchRun.created_by_user_id == user.id,
        OperatorResearchRun.created_at >= since,
    ))
    if (daily_count or 0) >= settings.openai_research_daily_limit:
        raise HTTPException(429, "Daily research limit reached. Use the manual research route or try again tomorrow.")

    message = await db.scalar(select(Message).where(
        Message.request_id == request_id, Message.direction == "inbound",
    ).order_by(Message.received_at.asc()))
    preferences = await preference_context_for_client(item.client_id, item.category, db)
    context = build_research_context(
        reference=item.reference, title=item.title, message=message.body if message else item.title,
        category=item.category, urgency=item.urgency,
        budget=float(item.budget_amount) if item.budget_amount is not None else None,
        currency=item.currency, preferences=preferences,
    )
    run = OperatorResearchRun(
        request_id=item.id, created_by_user_id=user.id, status="running", model=settings.openai_model,
    )
    db.add(run)
    await db.flush()
    db.add(AuditAction(
        request_id=item.id, actor=str(user.id), action="operator_research_started",
        payload={"research_run_id": str(run.id), "privacy_filtered": True, "max_tool_calls": settings.openai_research_max_tool_calls},
    ))
    await db.commit()

    try:
        outcome = await run_openai_research(context)
    except OpenAIResearchError as exc:
        run.status = "failed"
        run.error_summary = str(exc)[:500]
        db.add(AuditAction(
            request_id=item.id, actor="system", action="operator_research_failed",
            payload={"research_run_id": str(run.id)},
        ))
        await db.commit()
        raise HTTPException(502, str(exc)) from exc

    run.status = "completed"
    run.model = outcome.model
    run.response_id = outcome.response_id
    run.result = outcome.result
    run.input_tokens = outcome.input_tokens
    run.output_tokens = outcome.output_tokens
    db.add(AuditAction(
        request_id=item.id, actor="system", action="operator_research_completed",
        payload={
            "research_run_id": str(run.id), "model": outcome.model,
            "input_tokens": outcome.input_tokens, "output_tokens": outcome.output_tokens,
            "option_count": len(outcome.result.get("options", [])), "research_only": True,
        },
    ))
    await db.commit()
    await db.refresh(run)
    return operator_research_payload(run)


@app.get("/requests/{request_id}/approvals", response_model=list[ApprovalOut])
async def list_approvals(request_id: UUID, user: UserAccount = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await request_for_user(request_id, user, db)
    return (await db.scalars(select(Approval).where(Approval.request_id == request_id).order_by(Approval.id))).all()


@app.patch("/approvals/{approval_id}", response_model=ApprovalOut)
async def decide_approval(approval_id: UUID, data: ApprovalUpdate, user: UserAccount = Depends(current_user), db: AsyncSession = Depends(get_db)):
    approval = await db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(404, "Approval not found")
    item = await request_for_user(approval.request_id, user, db, "approvals:decide")
    if user.role == UserRole.operator:
        raise HTTPException(403, "Operators cannot approve a booking on the client's behalf")
    if approval.decision != ApprovalDecision.pending:
        raise HTTPException(409, "Approval already decided")
    approval.decision = data.decision
    approval.decided_by = str(user.id)
    approval.decided_at = datetime.now(timezone.utc)
    item.status = RequestStatus.approved if data.decision == ApprovalDecision.approved else RequestStatus.in_progress
    quote = await db.scalar(select(HotelQuote).where(HotelQuote.approval_id == approval.id))
    if quote:
        quote.status = "approved" if data.decision == ApprovalDecision.approved else "rejected"
    db.add(AuditAction(request_id=item.id, actor=str(user.id), action=f"approval_{data.decision.value}", payload={"approval_id": str(approval.id), "note": data.note}))
    await db.commit()
    await db.refresh(approval)
    return approval


@app.post("/partners/hotels/search", response_model=list[HotelOfferOut])
async def search_hotels(data: HotelSearchIn, user: UserAccount = Depends(current_user)):
    if data.checkout <= data.checkin:
        raise HTTPException(422, "checkout must be after checkin")
    payload = {
        "cityName": data.city_name, "countryCode": data.country_code.upper(),
        "checkin": data.checkin.isoformat(), "checkout": data.checkout.isoformat(),
        "currency": data.currency.upper(), "guestNationality": data.guest_nationality.upper(),
        "occupancies": [{"adults": room.adults, "children": room.children} for room in data.occupancies],
        "refundableRatesOnly": data.refundable_only, "maxRatesPerHotel": data.max_rates_per_hotel,
        "includeHotelData": True,
    }
    try:
        offers = await get_hotel_partner().search(payload)
    except PartnerError as exc:
        raise HTTPException(502, str(exc)) from exc
    return [{"provider": settings.partner_provider, **{key: value for key, value in offer.__dict__.items() if key != "raw"}} for offer in offers]


@app.post("/partners/flights/search", response_model=list[FlightOfferOut])
async def search_flights(
    data: FlightSearchIn,
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    item = await request_for_user(data.request_id, user, db)
    payload = {
        "legs": [
            {"origin": leg.origin.upper(), "destination": leg.destination.upper(), "date": leg.date.isoformat(), **({"direction": leg.direction} if leg.direction else {})}
            for leg in data.legs
        ],
        "adults": data.adults, "children": data.children, "infants": data.infants,
        "currency": data.currency.upper(),
    }
    try:
        offers = await NuiteeFlightsPartner().search(payload)
    except PartnerError as exc:
        raise HTTPException(502, str(exc)) from exc
    db.add(AuditAction(
        request_id=item.id, actor=str(user.id), action="flight_search_requested",
        payload={"provider": "nuitee", "legs": payload["legs"], "offer_count": len(offers)},
    ))
    await db.commit()
    return [{
        "provider": "nuitee", "offer_id": offer.offer_id, "itinerary": offer.itinerary,
        "amount": offer.amount, "currency": offer.currency, "refundable": offer.refundable,
    } for offer in offers]


@app.post("/requests/{request_id}/hotel-quotes", response_model=HotelQuoteOut, status_code=201)
async def create_hotel_quote(
    request_id: UUID, data: PrebookIn,
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    item = await request_for_user(request_id, user, db)
    try:
        result = await get_hotel_partner().prebook(data.offer_id)
    except PartnerError as exc:
        raise HTTPException(502, str(exc)) from exc
    if not result.prebook_id:
        raise HTTPException(502, "Partner did not return a prebook identifier")
    amount = result.amount
    approval = Approval(request_id=item.id, action_type="hotel_booking", summary=f"Approve {data.hotel_name} · {data.room_name or result.room_name} · {result.currency} {amount:,.2f}", amount=amount)
    db.add(approval)
    await db.flush()
    quote = HotelQuote(
        request_id=item.id, approval_id=approval.id, created_by_user_id=user.id,
        provider=settings.partner_provider, external_offer_id=data.offer_id,
        external_prebook_id=result.prebook_id, hotel_name=data.hotel_name or result.hotel_name,
        room_name=data.room_name or result.room_name, currency=result.currency, amount=amount,
        cancellation=result.cancellation, quote_snapshot=result.raw,
    )
    item.status = RequestStatus.awaiting_approval
    item.requires_approval = True
    db.add(quote)
    db.add(AuditAction(request_id=item.id, actor=str(user.id), action="hotel_quote_prebooked", payload={"provider": settings.partner_provider, "approval_id": str(approval.id), "amount": amount, "currency": result.currency}))
    await db.commit()
    await db.refresh(quote)
    return quote


@app.get("/requests/{request_id}/hotel-quotes", response_model=list[HotelQuoteOut])
async def list_hotel_quotes(request_id: UUID, user: UserAccount = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await request_for_user(request_id, user, db)
    return (await db.scalars(select(HotelQuote).where(HotelQuote.request_id == request_id).order_by(HotelQuote.created_at.desc()))).all()


@app.post("/hotel-quotes/{quote_id}/book", response_model=PartnerBookingOut, status_code=201)
async def book_hotel(
    quote_id: UUID, data: BookHotelIn,
    user: UserAccount = Depends(require_roles(UserRole.operator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    quote = await db.get(HotelQuote, quote_id)
    if not quote:
        raise HTTPException(404, "Hotel quote not found")
    item = await request_for_user(quote.request_id, user, db)
    existing = await db.scalar(select(PartnerBooking).where(PartnerBooking.provider == quote.provider, PartnerBooking.idempotency_key == data.idempotency_key))
    if existing:
        return existing
    approval = await db.get(Approval, quote.approval_id) if quote.approval_id else None
    if not approval or approval.decision != ApprovalDecision.approved or quote.status != "approved":
        raise HTTPException(409, "This exact quote must be approved by the client or authorised PA before booking")
    if quote.provider != "mock" and not settings.partner_booking_enabled:
        raise HTTPException(409, "Live partner booking is disabled; enable it only after sandbox verification")
    payload = {
        "prebookId": quote.external_prebook_id, "clientReference": data.idempotency_key,
        "holder": {"firstName": data.holder.first_name, "lastName": data.holder.last_name, "email": data.holder.email, "phone": data.holder.phone},
        "guests": [{"occupancyNumber": guest.occupancy_number, "firstName": guest.first_name, "lastName": guest.last_name, "email": guest.email, "remarks": guest.remarks} for guest in data.guests],
        "payment": {"method": "ACC_CREDIT_CARD"}, "customTags": {"VECTOR_REQUEST": item.reference},
    }
    booking = PartnerBooking(request_id=item.id, quote_id=quote.id, booked_by_user_id=user.id, provider=quote.provider, idempotency_key=data.idempotency_key, status="pending")
    db.add(booking)
    await db.flush()
    try:
        result = await get_hotel_partner().book(payload)
    except PartnerError as exc:
        booking.status = "failed"
        booking.response_summary = {"error": str(exc)}
        db.add(AuditAction(request_id=item.id, actor=str(user.id), action="hotel_booking_failed", payload={"provider": quote.provider, "booking_id": str(booking.id)}))
        await db.commit()
        raise HTTPException(502, str(exc)) from exc
    booking.status = result.status
    booking.external_booking_id = result.booking_id
    booking.confirmation_code = result.confirmation_code
    booking.response_summary = result.summary
    quote.status = "booked"
    item.status = RequestStatus.confirmed
    db.add(AuditAction(request_id=item.id, actor=str(user.id), action="hotel_booking_confirmed", payload={"provider": quote.provider, "booking_id": str(booking.id), "external_booking_id": result.booking_id}))
    await db.commit()
    await db.refresh(booking)
    return booking


async def seed_demo_users(db: AsyncSession):
    async def ensure(email: str, name: str, password: str, role: UserRole, client: Client | None = None):
        exists = await db.scalar(select(UserAccount).where(UserAccount.email == email))
        if not exists:
            db.add(UserAccount(client_id=client.id if client else None, email=email, full_name=name, password_hash=hash_password(password), role=role, is_active=True))

    email = "amelia@vectorprive.test"
    client = await db.scalar(select(Client).where(Client.email == email))
    if not client:
        client = Client(full_name="Amelia Hart", email=email, timezone="Europe/London", tier="Signature Family")
        db.add(client)
        await db.flush()
    await ensure(email, "Amelia Hart", "VectorDemo!2026", UserRole.client, client)
    await ensure("operator@vectorprive.test", "Crispin Operator", "VectorOps!2026", UserRole.operator)
    await db.commit()
