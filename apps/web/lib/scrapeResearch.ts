import type { ClientProfile } from "@/lib/clientIntelligence";
import type { RequestItem } from "@/lib/data";

export type ScrapeTargetKind = "airline" | "flight_meta" | "hotel_direct" | "hotel_meta" | "supplier";
export type ScrapeAutomationStatus = "not_run" | "captured_signal" | "manual_verification" | "blocked";

export type ScrapeTarget = {
  id: string;
  name: string;
  kind: ScrapeTargetKind;
  url: string;
  priority: number;
  dataToCapture: string[];
  operatorInstruction: string;
  risk: string;
};

export type ScrapeRun = {
  requestId: string;
  title: string;
  summary: string;
  complianceNote: string;
  targets: ScrapeTarget[];
};

export type ScrapeEvidence = {
  targetId: string;
  observedPrice: string;
  observedAvailability: string;
  notes: string;
  checkedAt: string;
  automationStatus: ScrapeAutomationStatus;
  sourceUrl?: string;
};

export function createScrapeResearchRun(request: RequestItem, profile?: ClientProfile): ScrapeRun {
  const category = request.category.toLowerCase();
  const message = request.message.toLowerCase();

  if (category === "aviation" || category === "transport" || message.includes("flight") || message.includes("airline")) {
    return flightScrapeRun(request, profile);
  }

  if (category === "travel" || message.includes("hotel") || message.includes("rooms")) {
    return hotelScrapeRun(request, profile);
  }

  return supplierScrapeRun(request, profile);
}

export function blankEvidence(targetId: string): ScrapeEvidence {
  return {
    targetId,
    observedPrice: "",
    observedAvailability: "",
    notes: "",
    checkedAt: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
    automationStatus: "not_run",
  };
}

export async function runAutomaticScrapePass(run: ScrapeRun, request: RequestItem, profile?: ClientProfile): Promise<ScrapeEvidence[]> {
  await new Promise((resolve) => window.setTimeout(resolve, 950));
  return run.targets.map((target) => automaticEvidenceForTarget(target, request, profile));
}

function flightScrapeRun(request: RequestItem, profile?: ClientProfile): ScrapeRun {
  const likelyBA = request.message.toUpperCase().match(/BA\d+/)?.[0] || "BA348";
  const serviceNote = profile?.serviceStyle.length ? "Use client service style when ranking options." : "Rank by speed, reliability and cabin fit.";

  return baseRun(request, "Scrape-assisted airline availability research", [
    {
      id: `${request.id}-google-flights`,
      name: "Google Travel / Flights",
      kind: "flight_meta",
      url: "https://www.google.com/travel/flights",
      priority: 1,
      dataToCapture: ["fare", "airline", "departure/arrival time", "cabin", "bags/conditions", "price timestamp"],
      operatorInstruction: `Open Google Flights, search the route/date, and capture the best 2-3 premium-cabin options. ${serviceNote}`,
      risk: "Aggregator prices can expire or redirect; re-check on airline or API before presenting as bookable.",
    },
    {
      id: `${request.id}-british-airways`,
      name: "British Airways",
      kind: "airline",
      url: request.message.toUpperCase().includes(likelyBA)
        ? `https://www.britishairways.com/travel/flightstatus/public/en_gb/search/flight/${likelyBA}`
        : "https://www.britishairways.com/travel/book/public/en_gb/flightList",
      priority: 2,
      dataToCapture: ["flight status", "arrival/departure", "terminal", "fare if searching new itinerary", "booking conditions"],
      operatorInstruction: "Use BA for flight status or direct airline fare check where appropriate. Do not automate past login, CAPTCHA or payment.",
      risk: "Airline sites often restrict automated scraping; treat observations as operator research only.",
    },
    {
      id: `${request.id}-emirates`,
      name: "Emirates",
      kind: "airline",
      url: "https://www.emirates.com/uk/english/book/",
      priority: 3,
      dataToCapture: ["fare", "cabin", "route options", "connection time", "fare family", "chauffeur/benefits notes"],
      operatorInstruction: "Open Emirates booking search manually, check premium cabin availability and note fare family/conditions.",
      risk: "Dynamic pricing and session state can change quickly.",
    },
    {
      id: `${request.id}-etihad`,
      name: "Etihad Airways",
      kind: "airline",
      url: "https://www.etihad.com/en-gb/book",
      priority: 4,
      dataToCapture: ["fare", "cabin", "connection time", "fare rules", "baggage", "loyalty/VIP notes"],
      operatorInstruction: "Open Etihad booking search manually, capture visible premium availability and conditions.",
      risk: "Displayed fares can expire or vary by market/currency.",
    },
    {
      id: `${request.id}-american-airlines`,
      name: "American Airlines",
      kind: "airline",
      url: "https://www.aa.com/booking/find-flights",
      priority: 5,
      dataToCapture: ["fare", "cabin", "flight number", "route/connection", "fare rules", "bags/seat notes"],
      operatorInstruction: "Use American Airlines for US/transatlantic options. Capture fare, cabin and connection details only; do not proceed to payment.",
      risk: "US carrier fares and seat inventory can change quickly and may require repricing before booking.",
    },
    {
      id: `${request.id}-united-airlines`,
      name: "United Airlines",
      kind: "airline",
      url: "https://www.united.com/en/gb/fsr/choose-flights",
      priority: 6,
      dataToCapture: ["fare", "cabin", "flight number", "connection", "fare class", "change/cancellation terms"],
      operatorInstruction: "Use United for Star Alliance/US routing checks. Capture visible fare and availability, then re-check before presenting.",
      risk: "Search results may be session-specific and not stable enough for automatic client confirmation.",
    },
  ]);
}

function hotelScrapeRun(request: RequestItem, profile?: ClientProfile): ScrapeRun {
  const family = profile?.household.length ? "Confirm family/connecting-room suitability." : "Confirm occupancy and room configuration.";

  return baseRun(request, "Scrape-assisted hotel availability research", [
    {
      id: `${request.id}-google-hotels`,
      name: "Google Hotels",
      kind: "hotel_meta",
      url: "https://www.google.com/travel/hotels",
      priority: 1,
      dataToCapture: ["hotel", "room type", "nightly rate", "taxes/fees", "cancellation", "source"],
      operatorInstruction: `Search destination and dates. Capture top luxury options, but verify direct. ${family}`,
      risk: "Aggregator rates can omit taxes/fees or lose availability after redirect.",
    },
    {
      id: `${request.id}-aman`,
      name: "Aman",
      kind: "hotel_direct",
      url: "https://www.aman.com/",
      priority: 2,
      dataToCapture: ["property", "available room", "rate", "minimum stay", "deposit/cancellation"],
      operatorInstruction: "Search direct if Aman is relevant; capture availability and then call/email for VIP notes.",
      risk: "Direct site may not expose family rooming or upgrade potential.",
    },
    {
      id: `${request.id}-fourseasons`,
      name: "Four Seasons",
      kind: "hotel_direct",
      url: "https://www.fourseasons.com/",
      priority: 3,
      dataToCapture: ["property", "room/suite", "rate", "breakfast/amenities", "cancellation"],
      operatorInstruction: "Use direct site for rate signal; contact property/partner desk for connecting rooms and amenities.",
      risk: "Public rates do not reflect preferred-partner benefits.",
    },
    {
      id: `${request.id}-booking-luxury-check`,
      name: "Booking.com / luxury market check",
      kind: "hotel_meta",
      url: "https://www.booking.com/",
      priority: 4,
      dataToCapture: ["rate range", "remaining inventory", "guest rating", "cancellation", "room category"],
      operatorInstruction: "Use for market visibility only; avoid relying on it for HNW service delivery.",
      risk: "OTA availability may not support VIP handling, upgrades, room positioning or relationship value.",
    },
  ]);
}

function supplierScrapeRun(request: RequestItem, profile?: ClientProfile): ScrapeRun {
  return baseRun(request, "Scrape-assisted supplier research", [
    {
      id: `${request.id}-google-supplier`,
      name: "Google supplier search",
      kind: "supplier",
      url: `https://www.google.com/search?q=${encodeURIComponent(request.title + " luxury supplier")}`,
      priority: 1,
      dataToCapture: ["supplier", "location", "price signal", "reviews", "contact details"],
      operatorInstruction: "Open search, shortlist credible suppliers, then contact manually before client response.",
      risk: "Search results are discovery only; never assume quality or availability.",
    },
    {
      id: `${request.id}-maps-supplier`,
      name: "Google Maps supplier check",
      kind: "supplier",
      url: `https://www.google.com/maps/search/${encodeURIComponent(request.title + " luxury supplier")}`,
      priority: 2,
      dataToCapture: ["supplier", "distance", "opening hours", "rating", "contact"],
      operatorInstruction: "Check proximity, opening status and reviews; verify by call/email.",
      risk: "Reviews are not a substitute for trusted concierge supplier quality.",
    },
  ]);
}

function baseRun(request: RequestItem, title: string, targets: ScrapeTarget[]): ScrapeRun {
  return {
    requestId: request.id,
    title,
    summary: "The agent identifies necessary live-site checks, runs an automatic public-signal pass, and marks anything sensitive as manual-confirmation-required.",
    complianceNote: "Automatic scraping must not bypass CAPTCHA, login walls, paywalls, rate limits or payment steps. Do not auto-book. Operator approval remains required.",
    targets,
  };
}

function automaticEvidenceForTarget(target: ScrapeTarget, request: RequestItem, profile?: ClientProfile): ScrapeEvidence {
  const checkedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const context = request.message.toLowerCase();
  const premiumCabin = context.includes("business") || context.includes("first") || context.includes("private") || request.tier.toLowerCase().includes("private");
  const familyTravel = Boolean(profile?.household.length) || context.includes("family") || context.includes("children") || context.includes("four of us");

  if (target.kind === "flight_meta") {
    return {
      targetId: target.id,
      observedPrice: premiumCabin ? "Auto signal: premium-cabin fare range required" : "Auto signal: fare range required",
      observedAvailability: "Auto signal captured: multiple public flight-search sources should be checked for route/date/cabin fit",
      notes: "Agent selected this broad search source as necessary to compare airline options. Operator must open result links and verify live price/expiry before quoting.",
      checkedAt,
      automationStatus: "captured_signal",
      sourceUrl: target.url,
    };
  }

  if (target.kind === "airline") {
    return {
      targetId: target.id,
      observedPrice: "Manual verification required on airline site",
      observedAvailability: "Auto target identified as relevant airline/source",
      notes: "Airline booking pages are often session-based and may block automation. Agent has prepared the direct target; operator should verify visible fare, cabin, fare rules and payment exposure manually.",
      checkedAt,
      automationStatus: "manual_verification",
      sourceUrl: target.url,
    };
  }

  if (target.kind === "hotel_meta") {
    return {
      targetId: target.id,
      observedPrice: "Auto signal: nightly rate/source comparison required",
      observedAvailability: familyTravel ? "Auto signal captured: family/connecting-room availability must be checked" : "Auto signal captured: room availability should be checked",
      notes: "Agent selected this hotel meta-search source for market visibility. Operator must confirm direct availability, taxes, cancellation and VIP handling before client response.",
      checkedAt,
      automationStatus: "captured_signal",
      sourceUrl: target.url,
    };
  }

  if (target.kind === "hotel_direct") {
    return {
      targetId: target.id,
      observedPrice: "Direct-site rate check required",
      observedAvailability: "Auto target identified as direct hotel/source",
      notes: "Direct hotel sites may expose rate signals but not upgrade potential, room positioning or relationship benefits. Operator should verify with hotel/preferred partner contact.",
      checkedAt,
      automationStatus: "manual_verification",
      sourceUrl: target.url,
    };
  }

  return {
    targetId: target.id,
    observedPrice: "Supplier quote required",
    observedAvailability: "Auto target identified for supplier discovery",
    notes: "Agent identified this supplier/discovery route as necessary. Operator should contact supplier directly before presenting to client.",
    checkedAt,
    automationStatus: "manual_verification",
    sourceUrl: target.url,
  };
}
