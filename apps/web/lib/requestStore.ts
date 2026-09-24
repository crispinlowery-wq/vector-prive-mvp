"use client";

import { requests as seedRequests, type RequestItem, type RequestStatus } from "@/lib/data";
import { learnFromRequest, resetClientProfiles } from "@/lib/clientIntelligence";

const STORAGE_KEY = "vector-prive-requests";

export type NewRequestInput = {
  message: string;
  category?: string;
  client?: string;
  initials?: string;
  tier?: string;
  channel?: string;
};

function normalize(items: RequestItem[]) {
  return [...items].sort((a, b) => Number(b.id.replace(/\D/g, "")) - Number(a.id.replace(/\D/g, "")));
}

export function loadRequests(): RequestItem[] {
  if (typeof window === "undefined") return seedRequests;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedRequests;
    const parsed = JSON.parse(raw) as RequestItem[];
    return normalize(parsed);
  } catch {
    return seedRequests;
  }
}

export function saveRequests(items: RequestItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(items)));
  window.dispatchEvent(new Event("vector-prive-requests-updated"));
}

export function resetRequests() {
  saveRequests(seedRequests);
  resetClientProfiles();
  seedRequests.forEach((request) => learnFromRequest(request));
}

export function createMemberRequest(input: NewRequestInput) {
  const existing = loadRequests();
  const nextNumber = Math.max(...existing.map((r) => Number(r.id.replace(/\D/g, ""))), 1048) + 1;
  const category = input.category || "Travel";
  const message = input.message.trim();
  const title = inferTitle(message, category);

  const request: RequestItem = {
    id: `VEC-${nextNumber}`,
    client: input.client || "Amelia Hart",
    initials: input.initials || "AH",
    tier: input.tier || "Signature Family",
    title,
    message,
    category,
    urgency: message.toLowerCase().match(/today|tomorrow|urgent|asap|tonight/) ? "urgent" : "high",
    status: "new",
    channel: input.channel || "Web",
    received: "Just now",
    budget: "To qualify",
    confidence: 81,
    owner: "Unassigned",
    tags: ["Member submitted", category],
    draft: buildDraft(message, category),
    rationale: ["Captured from member portal", "AI triage pending human review", "No external message sent yet"],
  };

  saveRequests([request, ...existing]);
  learnFromRequest(request);
  return request;
}

export function updateRequest(id: string, updates: Partial<RequestItem>) {
  const updated = loadRequests().map((request) => (request.id === id ? { ...request, ...updates } : request));
  saveRequests(updated);
  const item = updated.find((request) => request.id === id);
  if (item) learnFromRequest(item);
  return item;
}

export function statusLabel(status: RequestStatus) {
  return status.replaceAll("_", " ");
}

function inferTitle(message: string, category: string) {
  const lower = message.toLowerCase();
  if (lower.includes("kyoto")) return "Kyoto family planning";
  if (lower.includes("dinner") || lower.includes("restaurant")) return "Dining request";
  if (lower.includes("driver") || lower.includes("flight") || lower.includes("transfer")) return "Travel movement update";
  return `${category} concierge request`;
}

function buildDraft(message: string, category: string) {
  return `Amelia — received. I’m triaging this as a ${category.toLowerCase()} request and will shape one clear recommendation with any approval points called out before anything is committed.\n\nOriginal note: “${message}”`;
}
