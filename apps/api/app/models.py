import enum
from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, LargeBinary, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase): pass
class RequestStatus(str, enum.Enum):
    new="new"; triaged="triaged"; in_progress="in_progress"; awaiting_approval="awaiting_approval"; approved="approved"; confirmed="confirmed"; closed="closed"
class ApprovalDecision(str, enum.Enum): pending="pending"; approved="approved"; rejected="rejected"
class UserRole(str, enum.Enum): client="client"; pa="pa"; operator="operator"; admin="admin"

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Household(Base, TimestampMixin):
    __tablename__="households"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(160)); notes: Mapped[str|None] = mapped_column(Text)
    clients: Mapped[list["Client"]] = relationship(back_populates="household")

class Client(Base, TimestampMixin):
    __tablename__="clients"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    household_id: Mapped[UUID|None] = mapped_column(ForeignKey("households.id"))
    full_name: Mapped[str] = mapped_column(String(160), index=True); email: Mapped[str|None] = mapped_column(String(320), unique=True)
    phone: Mapped[str|None] = mapped_column(String(40)); timezone: Mapped[str] = mapped_column(String(64), default="Europe/London")
    tier: Mapped[str] = mapped_column(String(64), default="Private"); risk_flags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    profile_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    onboarding_completed_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    profile_photo: Mapped[bytes|None] = mapped_column(LargeBinary)
    profile_photo_mime: Mapped[str|None] = mapped_column(String(40))
    profile_photo_updated_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    household: Mapped[Household|None] = relationship(back_populates="clients"); preferences: Mapped[list["Preference"]] = relationship(back_populates="client", cascade="all, delete-orphan")

class NetworkContact(Base, TimestampMixin):
    __tablename__="network_contacts"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    first_name: Mapped[str] = mapped_column(String(120))
    last_name: Mapped[str] = mapped_column(String(160))
    full_name: Mapped[str] = mapped_column(String(280), index=True)
    linkedin_url: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    company: Mapped[str|None] = mapped_column(String(240), index=True)
    position: Mapped[str|None] = mapped_column(String(320), index=True)
    connected_on: Mapped[datetime|None] = mapped_column(DateTime(timezone=True), index=True)
    source: Mapped[str] = mapped_column(String(40), default="linkedin_export")
    relationship_status: Mapped[str] = mapped_column(String(40), default="connection", index=True)

class Delegation(Base, TimestampMixin):
    __tablename__="delegations"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    principal_client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    delegate_user_id: Mapped[UUID] = mapped_column(ForeignKey("user_accounts.id", ondelete="CASCADE"), index=True)
    scopes: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    spending_limit: Mapped[float|None] = mapped_column(Numeric(12,2))
    starts_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))

class UserAccount(Base, TimestampMixin):
    __tablename__="user_accounts"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    external_subject: Mapped[str|None] = mapped_column(String(240), unique=True, index=True)
    client_id: Mapped[UUID|None] = mapped_column(ForeignKey("clients.id"), index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str|None] = mapped_column(String(240))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.client, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))

class UserSession(Base):
    __tablename__="user_sessions"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("user_accounts.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))

class InviteKey(Base, TimestampMixin):
    __tablename__ = "invite_keys"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    code_hash: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(160))
    tier: Mapped[str] = mapped_column(String(32))
    valid_until: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    redeemed_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    redeemed_by_application_id: Mapped[UUID|None] = mapped_column(PGUUID(as_uuid=True), unique=True)

class MembershipApplication(Base, TimestampMixin):
    __tablename__ = "membership_applications"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id: Mapped[UUID|None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"), index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    phone: Mapped[str|None] = mapped_column(String(40))
    tier: Mapped[str] = mapped_column(String(32), index=True)
    note: Mapped[str|None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="payment_pending", index=True)
    payment_status: Mapped[str] = mapped_column(String(32), default="payment_required")
    invite_key_id: Mapped[UUID|None] = mapped_column(ForeignKey("invite_keys.id", ondelete="SET NULL"), index=True)
    reviewed_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    reviewed_by_user_id: Mapped[UUID|None] = mapped_column(ForeignKey("user_accounts.id", ondelete="SET NULL"))
    stripe_checkout_session_id: Mapped[str|None] = mapped_column(String(255), unique=True)
    stripe_customer_id: Mapped[str|None] = mapped_column(String(255), unique=True)
    stripe_subscription_id: Mapped[str|None] = mapped_column(String(255), unique=True)

class PasswordResetToken(Base):
    __tablename__="password_reset_tokens"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("user_accounts.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Preference(Base, TimestampMixin):
    __tablename__="preferences"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(64)); statement: Mapped[str] = mapped_column(Text); confidence: Mapped[float] = mapped_column(Float, default=.8)
    source_message_id: Mapped[UUID|None] = mapped_column(PGUUID(as_uuid=True)); expires_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    source_type: Mapped[str] = mapped_column(String(40), default="inferred")
    source_reference: Mapped[str|None] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(32), default="inferred")
    observation_count: Mapped[int] = mapped_column(Integer, default=1)
    last_observed_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    recorded_by_user_id: Mapped[UUID|None] = mapped_column(ForeignKey("user_accounts.id", ondelete="SET NULL"))
    client: Mapped[Client] = relationship(back_populates="preferences")

class ConciergeRequest(Base, TimestampMixin):
    __tablename__="requests"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    reference: Mapped[str] = mapped_column(String(24), unique=True, index=True); client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id"), index=True)
    title: Mapped[str] = mapped_column(String(240)); intent: Mapped[str] = mapped_column(String(80)); category: Mapped[str] = mapped_column(String(80))
    urgency: Mapped[str] = mapped_column(String(24), default="normal"); status: Mapped[RequestStatus] = mapped_column(Enum(RequestStatus), default=RequestStatus.new, index=True)
    budget_amount: Mapped[float|None] = mapped_column(Numeric(12,2)); currency: Mapped[str] = mapped_column(String(3), default="GBP")
    details: Mapped[dict] = mapped_column(JSONB, default=dict); ai_confidence: Mapped[float|None] = mapped_column(Float); ai_draft: Mapped[str|None] = mapped_column(Text)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False); owner: Mapped[str|None] = mapped_column(String(160))

class Message(Base):
    __tablename__="messages"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    request_id: Mapped[UUID] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), index=True); channel: Mapped[str] = mapped_column(String(32))
    direction: Mapped[str] = mapped_column(String(16)); body: Mapped[str] = mapped_column(Text); external_id: Mapped[str|None] = mapped_column(String(200), unique=True)
    delivery_status: Mapped[str|None] = mapped_column(String(32))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class InboundWebhookEvent(Base):
    __tablename__="inbound_webhook_events"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    external_id: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    sender: Mapped[str|None] = mapped_column(String(40), index=True)
    message_type: Mapped[str] = mapped_column(String(32), default="unknown")
    body: Mapped[str|None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="received", index=True)
    request_id: Mapped[UUID|None] = mapped_column(ForeignKey("requests.id", ondelete="SET NULL"), index=True)
    payload_summary: Mapped[dict] = mapped_column(JSONB, default=dict)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Approval(Base):
    __tablename__="approvals"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4); request_id: Mapped[UUID] = mapped_column(ForeignKey("requests.id"), index=True)
    action_type: Mapped[str] = mapped_column(String(64)); summary: Mapped[str] = mapped_column(Text); amount: Mapped[float|None] = mapped_column(Numeric(12,2))
    decision: Mapped[ApprovalDecision] = mapped_column(Enum(ApprovalDecision), default=ApprovalDecision.pending); decided_by: Mapped[str|None] = mapped_column(String(160)); decided_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))

class AuditAction(Base):
    __tablename__="audit_actions"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4); request_id: Mapped[UUID] = mapped_column(ForeignKey("requests.id"), index=True)
    actor: Mapped[str] = mapped_column(String(160)); action: Mapped[str] = mapped_column(String(80)); payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class PrivacyRequest(Base, TimestampMixin):
    """Auditable client requests for privacy, data and retention controls."""
    __tablename__ = "privacy_requests"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    request_type: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(32), default="received", index=True)
    note: Mapped[str|None] = mapped_column(Text)
    handled_by_user_id: Mapped[UUID|None] = mapped_column(ForeignKey("user_accounts.id", ondelete="SET NULL"))
    resolved_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))

class OperatorResearchRun(Base, TimestampMixin):
    __tablename__="operator_research_runs"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    request_id: Mapped[UUID] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), index=True)
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("user_accounts.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="running", index=True)
    model: Mapped[str] = mapped_column(String(80))
    result: Mapped[dict] = mapped_column(JSONB, default=dict)
    response_id: Mapped[str|None] = mapped_column(String(160))
    input_tokens: Mapped[int|None] = mapped_column(Integer)
    output_tokens: Mapped[int|None] = mapped_column(Integer)
    error_summary: Mapped[str|None] = mapped_column(String(500))

class Supplier(Base, TimestampMixin):
    __tablename__="suppliers"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4); name: Mapped[str] = mapped_column(String(200)); category: Mapped[str] = mapped_column(String(80)); locations: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    verified: Mapped[bool] = mapped_column(Boolean, default=False); reliability_score: Mapped[float|None] = mapped_column(Float); margin_percent: Mapped[float|None] = mapped_column(Float); contact: Mapped[dict] = mapped_column(JSONB, default=dict)

class HotelQuote(Base, TimestampMixin):
    __tablename__="hotel_quotes"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    request_id: Mapped[UUID] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), index=True)
    approval_id: Mapped[UUID|None] = mapped_column(ForeignKey("approvals.id"), index=True)
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("user_accounts.id"), index=True)
    provider: Mapped[str] = mapped_column(String(64), index=True)
    external_offer_id: Mapped[str] = mapped_column(Text)
    external_prebook_id: Mapped[str] = mapped_column(String(240), unique=True, index=True)
    hotel_name: Mapped[str] = mapped_column(String(240))
    room_name: Mapped[str|None] = mapped_column(String(240))
    currency: Mapped[str] = mapped_column(String(3))
    amount: Mapped[float] = mapped_column(Numeric(12,2))
    cancellation: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="awaiting_approval", index=True)
    expires_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    quote_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict)

class PartnerBooking(Base, TimestampMixin):
    __tablename__="partner_bookings"
    __table_args__=(UniqueConstraint("provider", "idempotency_key", name="uq_partner_booking_idempotency"),)
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    request_id: Mapped[UUID] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), index=True)
    quote_id: Mapped[UUID] = mapped_column(ForeignKey("hotel_quotes.id"), unique=True, index=True)
    booked_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("user_accounts.id"), index=True)
    provider: Mapped[str] = mapped_column(String(64), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    external_booking_id: Mapped[str|None] = mapped_column(String(240), index=True)
    confirmation_code: Mapped[str|None] = mapped_column(String(240))
    response_summary: Mapped[dict] = mapped_column(JSONB, default=dict)


class OperationalRecord(Base, TimestampMixin):
    """Shared operational state for mandates, journey monitoring and decision proof."""
    __tablename__ = "operational_records"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    kind: Mapped[str] = mapped_column(String(48), index=True)
    client_id: Mapped[UUID|None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"), index=True)
    request_id: Mapped[UUID|None] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    title: Mapped[str] = mapped_column(String(240))
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("user_accounts.id", ondelete="RESTRICT"), index=True)
