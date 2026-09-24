"use client";

import type { ClientProfile } from "./clientIntelligence";
import type { RequestItem } from "./data";

const STORAGE_KEY = "vector-prive-chatgpt-research";

export type ResearchOptionKind = "flight" | "hotel";

export type ChatGPTResearchOption = {
  id: string;
  requestId: string;
  kind: ResearchOptionKind;
  provider: string;
  title: string;
  routeOrLocation: string;
  price: string;
  availability: string;
  terms: string;
  sourceUrl: string;
  notes: string;
  checkedAt: string;
  enteredBy: string;
  verificationStatus: "operator_entered" | "staged_for_approval";
};

export type ChatGPTResearchOptionInput = Omit<ChatGPTResearchOption, "id" | "requestId" | "enteredBy" | "verificationStatus">;

export function sanitizeForExternalResearch(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[telephone or account number removed]")
    .replace(/\b(?:passport|card|account)\s*(?:number|no\.?|#)?\s*[:=-]?\s*[A-Z0-9-]{5,}\b/gi, "$1 details removed")
    .replace(/\b\d{13,19}\b/g, "[payment number removed]")
    .trim();
}

export function buildChatGPTResearchBrief(request: RequestItem, profile?: ClientProfile) {
  const preferenceLabels = ([...(profile?.preferences || []), ...(profile?.dietary || []), ...(profile?.serviceStyle || []), ...(profile?.life || [])])
    .filter((item) => !/passport|payment|address|medical|health/i.test(`${item.label} ${item.detail}`))
    .filter((item) => item.status !== "hidden" && item.confidence >= 75)
    .slice(0, 10)
    .map((item) => sanitizeForExternalResearch(`${item.label}: ${item.detail}`));

  const tags = request.tags
    .filter((tag) => !/passport|payment|address|medical|health/i.test(tag))
    .map(sanitizeForExternalResearch);

  return [
    "VECTOR PRIVÉ — OPERATOR RESEARCH BRIEF",
    `Request reference: ${request.id}`,
    "Purpose: Research only. Do not book, reserve, pay, cancel, contact the traveller, or disclose data to a supplier.",
    "",
    `Category: ${sanitizeForExternalResearch(request.category)}`,
    `Request: ${sanitizeForExternalResearch(request.message)}`,
    `Budget: ${sanitizeForExternalResearch(request.budget)}`,
    tags.length ? `Context tags: ${tags.join(", ")}` : "",
    preferenceLabels.length ? `Relevant non-sensitive preferences: ${preferenceLabels.join(", ")}` : "",
    "",
    "Use the live flight and hotel tools connected to this ChatGPT account where relevant. Compare no more than four strong options.",
    "For every option return: type, provider/source, flight route or hotel/property, exact price and currency, what the price includes, live availability wording, cancellation/change terms, direct source URL, and the date/time checked.",
    "Clearly label anything estimated, cached, unavailable, or requiring direct supplier confirmation. Never claim a booking or hold has been made.",
    "Do not request or include a traveller name, email, telephone number, home address, passport details, loyalty number, payment information, or authentication credentials.",
  ].filter(Boolean).join("\n");
}

function loadAll(): ChatGPTResearchOption[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(options: ChatGPTResearchOption[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
}

export function loadChatGPTResearchOptions(requestId: string) {
  return loadAll().filter((option) => option.requestId === requestId);
}

export function saveChatGPTResearchOption(requestId: string, input: ChatGPTResearchOptionInput, enteredBy = "Vector operator") {
  const option: ChatGPTResearchOption = {
    ...input,
    id: `research-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    requestId,
    enteredBy,
    verificationStatus: "operator_entered",
  };
  saveAll([option, ...loadAll()]);
  return option;
}

export function markResearchOptionStaged(optionId: string) {
  const updated = loadAll().map((option) => option.id === optionId
    ? { ...option, verificationStatus: "staged_for_approval" as const }
    : option);
  saveAll(updated);
  return updated.find((option) => option.id === optionId);
}
