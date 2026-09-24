from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models import ApprovalDecision, RequestStatus


class RequestCreate(BaseModel):
    client_id: UUID | None = None
    title: str = Field(min_length=3, max_length=240)
    message: str = Field(min_length=3)
    category: str = "other"
    urgency: str = "normal"
    budget_amount: float | None = None
    channel: str = "web"


class RequestOut(BaseModel):
    id: UUID
    reference: str
    client_id: UUID
    title: str
    category: str
    urgency: str
    status: RequestStatus
    budget_amount: float | None
    currency: str
    ai_confidence: float | None
    ai_draft: str | None
    requires_approval: bool
    owner: str | None
    client_name: str | None = None
    client_initials: str | None = None
    client_tier: str | None = None
    message: str | None = None
    channel: str | None = None
    created_at: datetime | None = None
    ai_reasons: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TriageOut(BaseModel):
    category: str
    urgency: str
    confidence: float
    draft: str
    requires_approval: bool
    reasons: list[str]


class ResearchOptionOut(BaseModel):
    kind: str
    provider: str
    title: str
    route_or_location: str
    price: str
    availability: str
    terms: str
    source_url: str
    checked_at: str
    why_it_fits: str


class OperatorResearchOut(BaseModel):
    id: UUID
    request_id: UUID
    status: str
    model: str
    headline: str
    summary: str
    options: list[ResearchOptionOut] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    preferences_applied: list[str] = Field(default_factory=list)
    verification_required: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    draft_reply: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    created_at: datetime


class ApprovalUpdate(BaseModel):
    decision: ApprovalDecision
    note: str | None = None


class ApprovalOut(BaseModel):
    id: UUID
    request_id: UUID
    action_type: str
    summary: str
    amount: float | None
    decision: ApprovalDecision
    decided_by: str | None
    decided_at: datetime | None

    model_config = {"from_attributes": True}


class LoginIn(BaseModel):
    email: str
    password: str = Field(min_length=8)


class MembershipApplicationIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: str = Field(max_length=320)
    phone: str | None = Field(default=None, max_length=40)
    tier: str = Field(pattern="^(vector|vector_plus|vector_prive)$")
    note: str | None = Field(default=None, max_length=1200)
    invite_code: str | None = Field(default=None, max_length=120)


class InviteKeyIn(BaseModel):
    code: str = Field(min_length=8, max_length=120)
    label: str = Field(min_length=2, max_length=160)
    tier: str = Field(pattern="^(vector|vector_plus|vector_prive)$")
    valid_until: datetime | None = None


class ForgotPasswordIn(BaseModel):
    email: str


class UserOut(BaseModel):
    id: UUID
    client_id: UUID | None
    email: str
    full_name: str
    role: str


class ClientOut(BaseModel):
    id: UUID
    full_name: str
    email: str | None
    tier: str
    phone: str | None = None
    timezone: str
    onboarding_completed_at: datetime | None = None
    profile_data: dict = Field(default_factory=dict)
    household_notes: str | None = None
    preferences: list[dict] = Field(default_factory=list)
    profile_photo_data_url: str | None = None

    model_config = {"from_attributes": True}


class OnboardingOut(BaseModel):
    completed: bool
    full_name: str
    email: str
    phone: str | None = None
    timezone: str = "Europe/London"
    profile: dict = Field(default_factory=dict)
    profile_photo_data_url: str | None = None


class ProfilePhotoIn(BaseModel):
    data_url: str = Field(min_length=32, max_length=750_000)


class ClientFeedbackIn(BaseModel):
    note: str = Field(min_length=3, max_length=2000)
    request_id: UUID | None = None


class EmployeePreferenceIn(BaseModel):
    category: str = Field(default="general", min_length=2, max_length=64)
    label: str = Field(min_length=2, max_length=120)
    note: str = Field(min_length=3, max_length=1200)
    confirmed_by_client: bool = False


class OnboardingIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    timezone: str = Field(default="Europe/London", min_length=2, max_length=64)
    preferred_contact: str = Field(default="whatsapp", max_length=32)
    household: str | None = Field(default=None, max_length=1200)
    assistant_name: str | None = Field(default=None, max_length=160)
    assistant_email: str | None = Field(default=None, max_length=320)
    travel_style: list[str] = Field(default_factory=list, max_length=12)
    hotel_style: list[str] = Field(default_factory=list, max_length=12)
    flight_preferences: str | None = Field(default=None, max_length=1200)
    dietary_requirements: str | None = Field(default=None, max_length=1200)
    accessibility_requirements: str | None = Field(default=None, max_length=1200)
    interests: list[str] = Field(default_factory=list, max_length=16)
    service_style: str | None = Field(default=None, max_length=1200)
    important_dates: str | None = Field(default=None, max_length=1200)
    anything_else: str | None = Field(default=None, max_length=2000)
    confirmed_accurate: bool


class NetworkContactOut(BaseModel):
    id: UUID
    full_name: str
    linkedin_url: str
    company: str | None
    position: str | None
    connected_on: datetime | None
    source: str
    relationship_status: str

    model_config = {"from_attributes": True}


class NetworkContactListOut(BaseModel):
    items: list[NetworkContactOut]
    total: int
    offset: int
    limit: int


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordOut(BaseModel):
    message: str
    reset_link_preview: str | None = None


class ResetPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=12)


class ResetPasswordOut(BaseModel):
    message: str


class WhatsAppSendIn(BaseModel):
    body: str = Field(min_length=1, max_length=4096)


class WhatsAppMessageOut(BaseModel):
    message_id: UUID
    provider_message_id: str
    status: str


class OccupancyIn(BaseModel):
    adults: int = Field(ge=1, le=8)
    children: list[int] = Field(default_factory=list, max_length=8)


class HotelSearchIn(BaseModel):
    city_name: str = Field(min_length=2, max_length=120)
    country_code: str = Field(min_length=2, max_length=2)
    checkin: date
    checkout: date
    currency: str = Field(default="GBP", min_length=3, max_length=3)
    guest_nationality: str = Field(default="GB", min_length=2, max_length=2)
    occupancies: list[OccupancyIn] = Field(min_length=1, max_length=4)
    refundable_only: bool = True
    max_rates_per_hotel: int = Field(default=2, ge=1, le=5)


class HotelOfferOut(BaseModel):
    provider: str
    offer_id: str
    hotel_name: str
    room_name: str
    amount: float
    currency: str
    refundable: bool
    cancellation: dict


class FlightLegIn(BaseModel):
    origin: str = Field(min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$")
    destination: str = Field(min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$")
    date: date
    direction: str | None = Field(default=None, pattern=r"^(OUTBOUND|INBOUND)$")


class FlightSearchIn(BaseModel):
    request_id: UUID
    legs: list[FlightLegIn] = Field(min_length=1, max_length=4)
    adults: int = Field(default=1, ge=1, le=9)
    children: int = Field(default=0, ge=0, le=8)
    infants: int = Field(default=0, ge=0, le=8)
    currency: str = Field(default="GBP", min_length=3, max_length=3)


class FlightOfferOut(BaseModel):
    provider: str
    offer_id: str
    itinerary: str
    amount: float
    currency: str
    refundable: bool | None = None
    booking_requires_operator_approval: bool = True


class PrebookIn(BaseModel):
    offer_id: str = Field(min_length=8)
    hotel_name: str = Field(min_length=1, max_length=240)
    room_name: str | None = Field(default=None, max_length=240)


class HotelQuoteOut(BaseModel):
    id: UUID
    request_id: UUID
    approval_id: UUID | None
    provider: str
    hotel_name: str
    room_name: str | None
    currency: str
    amount: float
    cancellation: dict
    status: str
    expires_at: datetime | None

    model_config = {"from_attributes": True}


class BookingHolderIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=320)
    phone: str | None = Field(default=None, max_length=40)


class BookingGuestIn(BaseModel):
    occupancy_number: int = Field(default=1, ge=1, le=4)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str | None = Field(default=None, max_length=320)
    remarks: str | None = Field(default=None, max_length=500)


class BookHotelIn(BaseModel):
    idempotency_key: str = Field(min_length=12, max_length=160, pattern=r"^[A-Za-z0-9_-]+$")
    holder: BookingHolderIn
    guests: list[BookingGuestIn] = Field(min_length=1, max_length=16)


class PartnerBookingOut(BaseModel):
    id: UUID
    request_id: UUID
    quote_id: UUID
    provider: str
    status: str
    external_booking_id: str | None
    confirmation_code: str | None

    model_config = {"from_attributes": True}


class OperationalRecordIn(BaseModel):
    client_id: UUID | None = None
    request_id: UUID | None = None
    title: str = Field(min_length=1, max_length=240)
    status: str = Field(default="active", min_length=1, max_length=32)
    payload: dict = Field(default_factory=dict)


class OperationalRecordUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    status: str | None = Field(default=None, min_length=1, max_length=32)
    payload: dict | None = None


class OperationalRecordOut(BaseModel):
    id: UUID
    kind: str
    client_id: UUID | None
    request_id: UUID | None
    title: str
    status: str
    payload: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PrivacyRequestIn(BaseModel):
    request_type: str = Field(pattern="^(review|correction|export|deletion)$")
    note: str | None = Field(default=None, max_length=1200)


class PrivacyRequestOut(BaseModel):
    id: UUID
    request_type: str
    status: str
    note: str | None
    created_at: datetime
    resolved_at: datetime | None
    client_name: str | None = None
    client_email: str | None = None

    model_config = {"from_attributes": True}


class PrivacyRequestUpdate(BaseModel):
    status: str = Field(pattern="^(received|in_progress|resolved)$")
