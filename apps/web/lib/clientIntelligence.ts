"use client";

import { clients, requests, type RequestItem } from "@/lib/data";

const CLIENT_MEMORY_KEY = "vector-prive-client-memory";

export type LearnedSignal = {
  id: string;
  label: string;
  detail: string;
  confidence: number;
  source: string;
  status?: "confirmed" | "inferred" | "hidden";
  expiresAt?: string;
};

export type SignalCollection = "preferences" | "life" | "dietary" | "serviceStyle";

export type ClientProfile = {
  serverId?: string;
  name: string;
  initials: string;
  photo?: string;
  tier: string;
  location: string;
  spend: string;
  summary: string;
  household: string[];
  travelWith: string[];
  preferences: LearnedSignal[];
  life: LearnedSignal[];
  dietary: LearnedSignal[];
  serviceStyle: LearnedSignal[];
  recentSignals: LearnedSignal[];
};

const seedProfiles: ClientProfile[] = clients.map((client) => ({
  name: client.name,
  initials: client.initials,
  tier: client.tier,
  location: client.location,
  spend: client.spend,
  summary: client.note,
  household: seedHousehold(client.name),
  travelWith: seedTravelWith(client.name),
  preferences: client.prefs.map((pref, index) => ({
    id: `${client.initials}-pref-${index}`,
    label: pref,
    detail: seedPreferenceDetail(pref),
    confidence: 86,
    source: "Seed profile",
  })),
  life: seedLife(client.name),
  dietary: seedDietary(client.name),
  serviceStyle: seedServiceStyle(client.name),
  recentSignals: [],
}));

export function loadClientProfiles(): ClientProfile[] {
  if (typeof window === "undefined") return seedProfiles;

  try {
    const raw = window.localStorage.getItem(CLIENT_MEMORY_KEY);
    if (!raw) return seedProfiles;
    return JSON.parse(raw) as ClientProfile[];
  } catch {
    return seedProfiles;
  }
}

export function saveClientProfiles(profiles: ClientProfile[]) {
  window.localStorage.setItem(CLIENT_MEMORY_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event("vector-prive-client-memory-updated"));
}

export function resetClientProfiles() {
  saveClientProfiles(seedProfiles);
}

export function getClientProfile(name: string) {
  return loadClientProfiles().find((profile) => profile.name === name) || seedProfiles.find((profile) => profile.name === name) || seedProfiles[0];
}

export function updateClientSignal(profileName: string, collection: SignalCollection, signalId: string, updates: Partial<LearnedSignal>) {
  const profiles = loadClientProfiles();
  saveClientProfiles(profiles.map((profile) => profile.name === profileName ? {
    ...profile,
    [collection]: profile[collection].map((signal) => signal.id === signalId ? { ...signal, ...updates } : signal),
  } : profile));
}

export function removeClientSignal(profileName: string, collection: SignalCollection, signalId: string) {
  const profiles = loadClientProfiles();
  saveClientProfiles(profiles.map((profile) => profile.name === profileName ? {
    ...profile,
    [collection]: profile[collection].filter((signal) => signal.id !== signalId),
  } : profile));
}

export function addClientSignal(profileName: string, collection: SignalCollection, label: string, detail: string) {
  const profiles = loadClientProfiles();
  const signal: LearnedSignal = {
    id: `manual-${Date.now()}`, label, detail, confidence: 100, source: "Confirmed by client", status: "confirmed",
  };
  saveClientProfiles(profiles.map((profile) => profile.name === profileName ? {
    ...profile, [collection]: [...profile[collection], signal], recentSignals: [signal, ...profile.recentSignals].slice(0, 8),
  } : profile));
}

export function learnFromRequest(request: RequestItem) {
  const profiles = loadClientProfiles();
  const profile = profiles.find((item) => item.name === request.client) || createProfileFromRequest(request);
  const insights = extractInsights(request);

  const merged: ClientProfile = {
    ...profile,
    travelWith: mergeStrings(profile.travelWith, insights.travelWith),
    household: mergeStrings(profile.household, insights.household),
    preferences: mergeSignals(profile.preferences, insights.preferences),
    life: mergeSignals(profile.life, insights.life),
    dietary: mergeSignals(profile.dietary, insights.dietary),
    serviceStyle: mergeSignals(profile.serviceStyle, insights.serviceStyle),
    recentSignals: mergeSignals(insights.recentSignals, profile.recentSignals).slice(0, 8),
  };

  const next = profiles.some((item) => item.name === profile.name)
    ? profiles.map((item) => (item.name === profile.name ? merged : item))
    : [merged, ...profiles];

  saveClientProfiles(next);
  return merged;
}

export function bootstrapLearningFromSeed() {
  if (typeof window === "undefined") return seedProfiles;
  if (window.localStorage.getItem(CLIENT_MEMORY_KEY)) return loadClientProfiles();
  let profiles = seedProfiles;
  saveClientProfiles(profiles);
  requests.forEach((request) => {
    profiles = loadClientProfiles();
    learnFromRequest(request);
  });
  return loadClientProfiles();
}

function extractInsights(request: RequestItem) {
  const text = `${request.title} ${request.message} ${request.tags.join(" ")}`.toLowerCase();
  const source = request.id;
  const recentSignals: LearnedSignal[] = [];
  const preferences: LearnedSignal[] = [];
  const life: LearnedSignal[] = [];
  const dietary: LearnedSignal[] = [];
  const serviceStyle: LearnedSignal[] = [];
  const household: string[] = [];
  const travelWith: string[] = [];

  function add(collection: LearnedSignal[], label: string, detail: string, confidence = 84) {
    const signal = { id: `${source}-${slug(label)}`, label, detail, confidence, source, status: "inferred" as const };
    collection.push(signal);
    recentSignals.push(signal);
  }

  if (text.includes("four of us") || text.includes("family") || text.includes("children")) {
    household.push("Travels as a family of four");
    travelWith.push("Children");
    add(life, "Family travel", "Often plans around school holidays and child-friendly experiences.", 91);
  }
  if (text.includes("connecting rooms")) add(preferences, "Connecting rooms", "Important for family hotel stays.", 93);
  if (text.includes("ceramics")) add(life, "Children enjoy craft experiences", "Private ceramics class requested in Kyoto.", 88);
  if (text.includes("avoid very formal") || text.includes("informal")) add(serviceStyle, "Informal luxury", "Prefers warm, understated service over formality.", 92);
  if (text.includes("serene") || text.includes("quiet")) add(preferences, "Quiet atmosphere", "Prioritise calm spaces and low-interruption settings.", 89);
  if (text.includes("pescatarian")) add(dietary, "Pescatarian guest", "At least one dining guest requires pescatarian options.", 94);
  if (text.includes("business") || text.includes("board dinner")) add(serviceStyle, "Business privacy", "Needs acoustic comfort and discreet service for hosting.", 90);
  if (text.includes("child seat")) {
    household.push("Travels with young children");
    add(preferences, "Child seat required", "Transfers should confirm child seat before dispatch.", 95);
  }
  if (text.includes("peonies") || text.includes("flowers")) add(life, "Anniversary gestures", "Prefers natural, soft-colour floral arrangements.", 87);
  if (text.includes("helicopter") || text.includes("aviation")) add(serviceStyle, "Fast-moving specialist travel", "Escalate aviation to approved specialist partners.", 86);

  return { preferences, life, dietary, serviceStyle, household, travelWith, recentSignals };
}

function createProfileFromRequest(request: RequestItem): ClientProfile {
  return {
    name: request.client,
    initials: request.initials,
    tier: request.tier,
    location: "Location to learn",
    spend: "New profile",
    summary: "Profile created automatically from request history.",
    household: [],
    travelWith: [],
    preferences: [],
    life: [],
    dietary: [],
    serviceStyle: [],
    recentSignals: [],
  };
}

function mergeStrings(existing: string[], incoming: string[]) {
  return Array.from(new Set([...existing, ...incoming])).filter(Boolean);
}

function mergeSignals(existing: LearnedSignal[], incoming: LearnedSignal[]) {
  const byLabel = new Map<string, LearnedSignal>();
  [...existing, ...incoming].forEach((signal) => {
    const key = signal.label.toLowerCase();
    const current = byLabel.get(key);
    if (!current || signal.confidence >= current.confidence) byLabel.set(key, signal);
  });
  return Array.from(byLabel.values());
}

function seedHousehold(name: string) {
  if (name === "Amelia Hart") return ["Partner", "Two children"];
  if (name === "Sofia Rahman") return ["Two young children", "Household staff coordination"];
  return [];
}

function seedTravelWith(name: string) {
  if (name === "Amelia Hart") return ["Partner", "Children"];
  if (name === "Sofia Rahman") return ["Children", "Nanny"];
  if (name === "Marcus Chen") return ["Executive guests", "Board guests"];
  return ["Solo"];
}

function seedPreferenceDetail(pref: string) {
  return `Known preference: ${pref.toLowerCase()}.`;
}

function seedLife(name: string): LearnedSignal[] {
  if (name === "Amelia Hart") return [{ id: "AH-life-1", label: "School holidays", detail: "Family trips cluster around UK school breaks.", confidence: 82, source: "Seed profile" }];
  if (name === "Marcus Chen") return [{ id: "MC-life-1", label: "Business hosting", detail: "Often books discreet spaces for senior guests.", confidence: 88, source: "Seed profile" }];
  return [];
}

function seedDietary(name: string): LearnedSignal[] {
  if (name === "Amelia Hart") return [{ id: "AH-diet-1", label: "No shellfish", detail: "Avoid shellfish in dining recommendations.", confidence: 89, source: "Seed profile" }];
  if (name === "Sofia Rahman") return [{ id: "SR-diet-1", label: "Halal dining", detail: "Prioritise halal-aware restaurants and suppliers.", confidence: 91, source: "Seed profile" }];
  return [];
}

function seedServiceStyle(name: string): LearnedSignal[] {
  if (name === "James Whitmore") return [{ id: "JW-style-1", label: "Concise recommendations", detail: "Wants the answer, not the search process.", confidence: 87, source: "Seed profile" }];
  return [{ id: `${slug(name)}-style-1`, label: "Human reviewed", detail: "External commitments should remain operator-approved.", confidence: 80, source: "System policy" }];
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
