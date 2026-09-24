"use client";

import type { RequestItem } from "./data";

const STORAGE_KEY = "vector-prive-private-office-os";

export type DelegateMandate = {
  id: string;
  principal: string;
  delegate: string;
  role: string;
  status: "active" | "paused";
  startsAt: string;
  expiresAt: string;
  spendingLimit: number;
  scopes: string[];
  approvalRules: string[];
  visibleData: string[];
  restrictedData: string[];
};

export type DecisionOption = {
  id: string;
  label: string;
  provider: string;
  summary: string;
  price: string;
  terms: string;
  liveStatus: string;
  fit: number;
};

export type DecisionCapsule = {
  id: string;
  requestId: string;
  client: string;
  title: string;
  recommendation: DecisionOption;
  alternatives: DecisionOption[];
  reasons: string[];
  expiresAt: string;
  approvalState: "draft" | "awaiting_approval" | "approved" | "declined";
  authority: string;
  checkedAt: string;
};

export type ProofEvent = {
  id: string;
  requestId: string;
  at: string;
  actor: string;
  title: string;
  detail: string;
  state: "complete" | "active" | "waiting" | "risk";
};

export type GuardianAlert = {
  id: string;
  level: "watch" | "action" | "resolved";
  title: string;
  detail: string;
  proposedAction: string;
  approvalRequired: boolean;
};

export type GuardianJourney = {
  id: string;
  requestId: string;
  client: string;
  route: string;
  dates: string;
  status: "monitoring" | "attention" | "protected";
  nextCheck: string;
  signals: string[];
  alerts: GuardianAlert[];
};

export type PrivateOfficeState = {
  mandates: DelegateMandate[];
  capsules: DecisionCapsule[];
  proof: ProofEvent[];
  journeys: GuardianJourney[];
};

const seedState: PrivateOfficeState = {
  mandates: [
    {
      id: "mandate-amelia-pa", principal: "Amelia Hart", delegate: "Charlotte Reed", role: "Full PA", status: "active",
      startsAt: "2026-01-01", expiresAt: "2026-12-31", spendingLimit: 5000,
      scopes: ["Flights", "Hotels", "Dining", "Ground transport"],
      approvalRules: ["Non-refundable bookings", "Any single commitment above £5,000", "Passport-data disclosure"],
      visibleData: ["Preferences", "Traveller names", "Loyalty status", "Passport validity"],
      restrictedData: ["Passport image", "Payment settings", "Private conversations"],
    },
    {
      id: "mandate-sofia-chief", principal: "Sofia Rahman", delegate: "Layla Hassan", role: "Chief of staff", status: "active",
      startsAt: "2026-01-01", expiresAt: "2027-01-01", spendingLimit: 10000,
      scopes: ["Flights", "Hotels", "Dining", "Ground transport", "Family logistics"],
      approvalRules: ["Private aviation", "New payment method", "Non-refundable bookings above £2,500"],
      visibleData: ["Household", "Preferences", "Traveller names", "Document validity"],
      restrictedData: ["Document images", "Authentication settings"],
    },
  ],
  capsules: [
    {
      id: "capsule-kyoto", requestId: "VEC-1048", client: "Amelia Hart", title: "Kyoto family half-term",
      recommendation: { id: "genji", label: "Recommended", provider: "Genji Kyoto · direct", summary: "Riverside suite with confirmed connecting configuration and private ceramics session.", price: "£21,840 total", terms: "48-hour hold · refundable until 30 days before arrival", liveStatus: "Price and rooming checked 8 minutes ago", fit: 96 },
      alternatives: [
        { id: "sowaka", label: "More traditional", provider: "Sowaka · partner desk", summary: "Machiya-style stay with two adjacent rooms; more formal service style.", price: "£19,960 total", terms: "20% refundable deposit", liveStatus: "Availability checked 14 minutes ago", fit: 82 },
        { id: "ace", label: "Lower commitment", provider: "Ace Hotel Kyoto · Nuitee", summary: "Two connecting rooms in a lively central location.", price: "£14,420 total", terms: "Free cancellation until 7 days before arrival", liveStatus: "Live rate checked 6 minutes ago", fit: 76 },
      ],
      reasons: ["Quiet, intimate hotel preference", "Family of four and connecting rooms", "Children’s interest in ceramics"],
      expiresAt: "Today, 16:30", approvalState: "awaiting_approval", authority: "Principal approval required · commitment above PA mandate", checkedAt: "8 minutes ago",
    },
    {
      id: "capsule-mayfair", requestId: "VEC-1047", client: "Marcus Chen", title: "Mayfair board dinner for eight",
      recommendation: { id: "twentytwo", label: "Recommended", provider: "The Twenty Two · operator call", summary: "Quiet corner table at 19:30 with pescatarian menu confirmed.", price: "£1,200 estimated", terms: "Card guarantee · free cancellation until 15:00", liveStatus: "Table position verbally confirmed", fit: 94 },
      alternatives: [
        { id: "mount", label: "More discreet", provider: "The Mount St. Restaurant", summary: "Private-feeling upper-floor table; 20:00 available.", price: "£1,450 estimated", terms: "48-hour cancellation policy", liveStatus: "Operator confirmation pending", fit: 89 },
        { id: "34", label: "Fastest confirmation", provider: "34 Mayfair", summary: "19:30 confirmed, livelier room than preferred.", price: "£1,100 estimated", terms: "Card guarantee", liveStatus: "Live availability confirmed", fit: 78 },
      ],
      reasons: ["Acoustic comfort matters more than celebrity value", "Pescatarian guest confirmed", "Tomorrow evening requires a fast decision"],
      expiresAt: "Today, 15:00", approvalState: "draft", authority: "Principal or authorised PA may approve card guarantee", checkedAt: "4 minutes ago",
    },
  ],
  proof: [
    { id: "proof-k-1", requestId: "VEC-1048", at: "09:04", actor: "Amelia", title: "Request received", detail: "WhatsApp request captured and identity matched.", state: "complete" },
    { id: "proof-k-2", requestId: "VEC-1048", at: "09:05", actor: "Vector", title: "Authority checked", detail: "PA mandate reviewed; principal approval required above £5,000.", state: "complete" },
    { id: "proof-k-3", requestId: "VEC-1048", at: "09:12", actor: "Crispin", title: "Live options researched", detail: "Hotel, rooming, cancellation and ceramics access compared.", state: "complete" },
    { id: "proof-k-4", requestId: "VEC-1048", at: "09:18", actor: "Supplier", title: "Price and terms reconfirmed", detail: "Recommended suite held for 48 hours.", state: "complete" },
    { id: "proof-k-5", requestId: "VEC-1048", at: "Now", actor: "Amelia", title: "Awaiting secure approval", detail: "No payment or booking has been made.", state: "waiting" },
    { id: "proof-m-1", requestId: "VEC-1047", at: "10:26", actor: "Marcus", title: "Request received", detail: "Email request captured and triaged as urgent dining.", state: "complete" },
    { id: "proof-m-2", requestId: "VEC-1047", at: "10:31", actor: "Crispin", title: "Table options checked", detail: "Privacy, acoustics and pescatarian menu prioritised.", state: "complete" },
    { id: "proof-m-3", requestId: "VEC-1047", at: "Now", actor: "Vector", title: "Decision Capsule ready", detail: "Operator review required before client approval.", state: "active" },
  ],
  journeys: [
    {
      id: "guardian-kyoto", requestId: "VEC-1048", client: "Amelia Hart", route: "London → Kyoto", dates: "24–31 October",
      status: "monitoring", nextCheck: "In 42 minutes", signals: ["Flight schedules", "Hotel cancellation deadline", "Passport validity", "Kyoto weather", "Ground transfer"],
      alerts: [
        { id: "alert-k-1", level: "watch", title: "Connecting-room hold expires today", detail: "Genji Kyoto hold expires at 16:30 UK time.", proposedAction: "Remind the principal 60 minutes before expiry.", approvalRequired: false },
      ],
    },
    {
      id: "guardian-sofia", requestId: "VEC-1046", client: "Sofia Rahman", route: "Heathrow arrival → London", dates: "Today",
      status: "attention", nextCheck: "Live", signals: ["Flight BA107", "Driver ETA", "Terminal", "Child seat"],
      alerts: [
        { id: "alert-s-1", level: "action", title: "Arrival moved by 96 minutes", detail: "Original driver pickup no longer aligns with BA107.", proposedAction: "Move pickup to 19:25 and reconfirm child seat at no additional charge.", approvalRequired: false },
      ],
    },
  ],
};

export function loadPrivateOfficeState(): PrivateOfficeState {
  if (typeof window === "undefined") return seedState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState;
    const stored = JSON.parse(raw) as Partial<PrivateOfficeState>;
    return {
      mandates: mergeSeedRecords(seedState.mandates, stored.mandates),
      capsules: mergeSeedRecords(seedState.capsules, stored.capsules),
      proof: mergeSeedRecords(seedState.proof, stored.proof),
      journeys: mergeSeedRecords(seedState.journeys, stored.journeys),
    };
  } catch {
    return seedState;
  }
}

function mergeSeedRecords<T extends { id: string }>(seed: T[], stored?: T[]) {
  if (!stored?.length) return seed;
  const storedById = new Map(stored.map((item) => [item.id, item]));
  const seeded = seed.map((item) => storedById.get(item.id) || item);
  const seedIds = new Set(seed.map((item) => item.id));
  return [...seeded, ...stored.filter((item) => !seedIds.has(item.id))];
}

export function savePrivateOfficeState(state: PrivateOfficeState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("vector-prive-private-office-updated"));
}

export function resetPrivateOfficeState() {
  savePrivateOfficeState(seedState);
}

export function getDecisionCapsule(request: RequestItem): DecisionCapsule {
  return loadPrivateOfficeState().capsules.find((item) => item.requestId === request.id) || createCapsule(request);
}

export function getProofTimeline(requestId: string) {
  return loadPrivateOfficeState().proof.filter((event) => event.requestId === requestId);
}

export function setCapsuleState(requestId: string, approvalState: DecisionCapsule["approvalState"], actor = "Vector operator") {
  const state = loadPrivateOfficeState();
  const capsules = state.capsules.map((capsule) => capsule.requestId === requestId ? { ...capsule, approvalState } : capsule);
  const event: ProofEvent = {
    id: `proof-${Date.now()}`, requestId, at: "Now", actor,
    title: approvalState === "approved" ? "Decision approved" : approvalState === "declined" ? "Decision declined" : "Sent for secure approval",
    detail: approvalState === "approved" ? "The operator may execute only the exact approved action." : approvalState === "declined" ? "No commitment will be made." : "The exact recommendation is waiting for the principal or authorised PA.",
    state: approvalState === "approved" ? "complete" : approvalState === "declined" ? "risk" : "waiting",
  };
  savePrivateOfficeState({ ...state, capsules, proof: [...state.proof, event] });
}

export function updateMandate(mandateId: string, updates: Partial<DelegateMandate>) {
  const state = loadPrivateOfficeState();
  savePrivateOfficeState({ ...state, mandates: state.mandates.map((mandate) => mandate.id === mandateId ? { ...mandate, ...updates } : mandate) });
}

export function resolveGuardianAlert(journeyId: string, alertId: string) {
  const state = loadPrivateOfficeState();
  const journeys = state.journeys.map((journey) => journey.id === journeyId ? {
    ...journey,
    status: "protected" as const,
    alerts: journey.alerts.map((alert) => alert.id === alertId ? { ...alert, level: "resolved" as const } : alert),
  } : journey);
  const journey = journeys.find((item) => item.id === journeyId);
  const alert = journey?.alerts.find((item) => item.id === alertId);
  const proof = journey && alert ? [...state.proof, {
    id: `proof-${Date.now()}`, requestId: journey.requestId, at: "Now", actor: "Vector operator",
    title: "Trip Guardian intervention completed", detail: alert.proposedAction, state: "complete" as const,
  }] : state.proof;
  savePrivateOfficeState({ ...state, journeys, proof });
}

export function evaluateAuthority(mandate: DelegateMandate, category: string, amount: number, nonRefundable = false) {
  if (mandate.status !== "active") return { allowed: false, reason: "Mandate is paused" };
  if (!mandate.scopes.some((scope) => scope.toLowerCase().includes(category.toLowerCase()))) return { allowed: false, reason: `${category} is outside this mandate` };
  if (amount > mandate.spendingLimit) return { allowed: false, reason: `£${amount.toLocaleString()} exceeds the £${mandate.spendingLimit.toLocaleString()} limit` };
  if (nonRefundable) return { allowed: false, reason: "Non-refundable bookings require principal approval" };
  return { allowed: true, reason: "Within scope and spending authority" };
}

function createCapsule(request: RequestItem): DecisionCapsule {
  return {
    id: `capsule-${request.id}`, requestId: request.id, client: request.client, title: request.title,
    recommendation: { id: "operator-route", label: "Operator recommendation", provider: "Vector research desk", summary: request.draft, price: request.budget, terms: "Terms require supplier reconfirmation", liveStatus: "Operator verification required", fit: request.confidence },
    alternatives: [], reasons: request.rationale, expiresAt: "No live expiry recorded", approvalState: "draft",
    authority: "Operator must verify delegated authority", checkedAt: "Not yet checked",
  };
}
