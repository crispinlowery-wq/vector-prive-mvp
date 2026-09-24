"use client";

import type { ClientProfile } from "@/lib/clientIntelligence";
import type { RequestItem } from "@/lib/data";

export type OperatorAdvice = {
  headline: string;
  recommendation: string;
  confidence: number | null;
  draftReply?: string;
  live?: boolean;
  model?: string;
  preferencesApplied?: string[];
  risks: string[];
  searchResults: Array<{
    source: string;
    title: string;
    finding: string;
    action: string;
    sourceUrl?: string;
  }>;
  nextActions: string[];
};

export async function runOperatorResearch(request: RequestItem, profile: ClientProfile): Promise<OperatorAdvice> {
  await new Promise((resolve) => window.setTimeout(resolve, 520));

  const category = request.category.toLowerCase();
  if (category === "dining") return diningAdvice(request, profile);
  if (category === "travel") return travelAdvice(request, profile);
  if (category === "transport") return transportAdvice(request, profile);
  if (category === "aviation") return aviationAdvice(request, profile);
  return lifestyleAdvice(request, profile);
}

function diningAdvice(request: RequestItem, profile: ClientProfile): OperatorAdvice {
  const quiet = hasSignal(profile, "quiet");
  return {
    headline: "Best route: discreet Mayfair dining with operator-confirmed table position",
    recommendation: quiet
      ? "Prioritise restaurants where a quiet corner, private-feeling banquette, or upstairs table can be confirmed by a human before client reply."
      : "Prioritise confirmed availability, dietary suitability, and low-friction cancellation terms.",
    confidence: 91,
    risks: ["Large-party cancellation terms may require a card guarantee", "Pescatarian menu should be confirmed, not assumed", "Noise level matters more than celebrity venue value"],
    searchResults: [
      { source: "SevenRooms adapter", title: "The Twenty Two · Mayfair", finding: "Strongest privacy/acoustic fit; 19:30 mock availability.", action: "Stage as primary recommendation." },
      { source: "Client memory", title: "Business hosting preference", finding: "Marcus values quiet tables and acoustic comfort.", action: "Mention discreet table positioning in operator notes." },
      { source: "Policy", title: "Financial commitment check", finding: "No payment hold should be committed without explicit approval.", action: "Use approval workflow if guarantee appears." },
    ],
    nextActions: ["Check SevenRooms availability", "Call venue to confirm table position", "Add pescatarian note to booking", "Send one primary option plus two fallbacks"],
  };
}

function travelAdvice(request: RequestItem, profile: ClientProfile): OperatorAdvice {
  return {
    headline: "Best route: family-first itinerary with quiet hotel shortlist",
    recommendation: "Lead with intimate luxury properties, connecting-room certainty, and one memorable child-friendly experience. Avoid formal grand hotels.",
    confidence: 93,
    risks: ["Connecting rooms must be held before presenting as available", "School-holiday inventory can disappear quickly", "High-value trip needs approval before deposit"],
    searchResults: [
      { source: "Client memory", title: "Family of four", finding: profile.travelWith.join(", ") || "Family configuration likely.", action: "Keep rooming and transfer logistics central." },
      { source: "Preference engine", title: "Informal luxury", finding: "Known preference for warm, boutique service.", action: "Filter out formal palace-style hotels." },
      { source: "Operator playbook", title: "Experience layer", finding: "Private ceramics class matches children’s interest.", action: "Add one signature experience, not a packed itinerary." },
    ],
    nextActions: ["Hold two hotel options", "Confirm connecting-room layout", "Ask approval on deposit exposure", "Draft concise comparison for client"],
  };
}

function transportAdvice(request: RequestItem, profile: ClientProfile): OperatorAdvice {
  return {
    headline: "Best route: supplier reconfirmation before client acknowledgement",
    recommendation: "Move the driver, explicitly reconfirm the child seat, and send a short acknowledgement only after supplier confirmation.",
    confidence: 97,
    risks: ["Flight delay may alter pickup buffer", "Child seat is a safety-critical preference", "Meet-and-greet details should match terminal"],
    searchResults: [
      { source: "Client memory", title: "Travels with children", finding: profile.household.join(", ") || "Young children noted.", action: "Make child-seat confirmation mandatory." },
      { source: "Supplier policy", title: "Verified chauffeur", finding: "Existing verified supplier means no new approval required.", action: "Keep within standing authority." },
    ],
    nextActions: ["Update driver ETA", "Reconfirm child seat", "Check terminal/flight status", "Send concise WhatsApp confirmation"],
  };
}

function aviationAdvice(request: RequestItem, profile: ClientProfile): OperatorAdvice {
  return {
    headline: "Best route: specialist partner with weather and baggage caveats",
    recommendation: "Treat as specialist aviation. Present quickest viable route only after partner confirms baggage, landing window, weather fallback, and payment exposure.",
    confidence: 78,
    risks: ["Weather can invalidate helicopter routing", "Baggage allowance may not fit client assumptions", "Aviation always needs approval before commitment"],
    searchResults: [
      { source: "Operator policy", title: "Aviation escalation", finding: "Private aviation always routes to specialist partner.", action: "Keep status awaiting approval." },
      { source: "Client memory", title: "Fast-moving solo travel", finding: "Client wants concise recommendation.", action: "Avoid overloading the reply with options." },
    ],
    nextActions: ["Contact aviation partner", "Confirm baggage and weather fallback", "Prepare approval summary", "Send one recommended route"],
  };
}

function lifestyleAdvice(request: RequestItem, profile: ClientProfile): OperatorAdvice {
  return {
    headline: "Best route: trusted supplier with preference-preserving brief",
    recommendation: "Use a verified supplier and preserve the client’s aesthetic language in the supplier notes.",
    confidence: 88,
    risks: ["Taste-sensitive requests need exact language", "Hotel room access must be coordinated", "Avoid over-designed substitutions"],
    searchResults: [
      { source: "Client memory", title: "Natural florals", finding: hasSignal(profile, "floral") ? "Natural, soft styling is known." : "Style preference can be inferred from request.", action: "Quote client wording in supplier brief." },
    ],
    nextActions: ["Confirm supplier availability", "Send hotel delivery window", "Save aesthetic preference", "Confirm completion with photo if appropriate"],
  };
}

function hasSignal(profile: ClientProfile, needle: string) {
  const haystack = [
    ...profile.preferences,
    ...profile.life,
    ...profile.dietary,
    ...profile.serviceStyle,
    ...profile.recentSignals,
  ].map((signal) => `${signal.label} ${signal.detail}`.toLowerCase()).join(" ");
  return haystack.includes(needle.toLowerCase());
}
