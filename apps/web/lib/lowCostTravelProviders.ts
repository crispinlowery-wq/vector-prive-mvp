import type { ClientProfile } from "@/lib/clientIntelligence";
import type { RequestItem } from "@/lib/data";

export type LowCostProviderKind = "hotel" | "commercial_flight" | "flight_status" | "private_aviation" | "ground" | "manual";
export type LowCostProviderMode = "free_api" | "low_cost_api" | "mock" | "manual";

export type LowCostProviderOption = {
  id: string;
  name: string;
  kind: LowCostProviderKind;
  mode: LowCostProviderMode;
  cost: "Free tier" | "Low monthly" | "No API cost" | "Partner later";
  confidence: number;
  freshness: string;
  title: string;
  finding: string;
  nextAction: string;
  confirmation: "Live data" | "Manual confirmation required" | "Demo data only";
  risk: string;
};

export type LowCostProviderScan = {
  summary: string;
  options: LowCostProviderOption[];
  operatorNote: string;
};

export async function runLowCostProviderScan(request: RequestItem, profile?: ClientProfile): Promise<LowCostProviderScan> {
  await new Promise((resolve) => window.setTimeout(resolve, 620));

  const category = request.category.toLowerCase();
  const message = request.message.toLowerCase();

  if (category === "travel" || message.includes("hotel") || message.includes("kyoto")) {
    return hotelTravelScan(request, profile);
  }

  if (category === "aviation" || message.includes("helicopter") || message.includes("jet") || message.includes("flight")) {
    return aviationScan(request, profile);
  }

  if (category === "transport" || message.includes("driver") || message.includes("lands")) {
    return flightStatusScan(request, profile);
  }

  if (category === "dining") {
    return {
      summary: "Dining request — keep SevenRooms/manual restaurant route as the primary low-cost connector.",
      operatorNote: "No flight or hotel connector needed. Use SevenRooms-style availability, venue calls and client memory.",
      options: [
        {
          id: `${request.id}-sevenrooms-lite`,
          name: "SevenRooms-style adapter",
          kind: "manual",
          mode: "mock",
          cost: "No API cost",
          confidence: 88,
          freshness: "Demo availability",
          title: "Restaurant availability workflow",
          finding: "Use the existing adapter for venue-style options, then call the venue for table position and payment terms.",
          nextAction: "Check availability below, then confirm table details manually.",
          confirmation: "Manual confirmation required",
          risk: "Restaurant APIs rarely confirm the table quality that matters for HNW clients.",
        },
      ],
    };
  }

  return {
    summary: "Lifestyle request — use manual supplier records first and save any new preferences to client memory.",
    operatorNote: "This is best handled through verified suppliers and human approval until volume justifies deeper integrations.",
    options: [
      {
        id: `${request.id}-manual-supplier`,
        name: "Manual supplier repository",
        kind: "manual",
        mode: "manual",
        cost: "No API cost",
        confidence: 91,
        freshness: "Operator maintained",
        title: "Verified concierge supplier",
        finding: "Use a trusted florist, experience partner or lifestyle supplier and record outcome quality.",
        nextAction: "Brief supplier, confirm availability, then update client memory.",
        confirmation: "Manual confirmation required",
        risk: "Taste-sensitive requests should not be automated before supplier trust is established.",
      },
    ],
  };
}

function hotelTravelScan(request: RequestItem, profile?: ClientProfile): LowCostProviderScan {
  const family = profile?.household.length ? "family configuration from client memory" : "rooming details from request";

  return {
    summary: "Low-cost hotel proof path: curated hotel shortlist + manual availability check now; Hotelbeds/Expedia later.",
    operatorNote: "Use free discovery and operator notes first. Do not present rooms as held until a human checks the hotel or a paid inventory partner is connected.",
    options: [
      {
        id: `${request.id}-curated-hotels`,
        name: "Curated hotel repository",
        kind: "hotel",
        mode: "manual",
        cost: "No API cost",
        confidence: 92,
        freshness: "Operator maintained",
        title: "Luxury hotel shortlist",
        finding: `Shortlist properties against ${family}, service style, location and budget tone.`,
        nextAction: "Add two hotels, rooming logic, cancellation terms and contact notes.",
        confirmation: "Manual confirmation required",
        risk: "Free discovery does not prove room availability or connecting-room certainty.",
      },
      {
        id: `${request.id}-maps-discovery`,
        name: "Google Places / Maps-style discovery",
        kind: "hotel",
        mode: "low_cost_api",
        cost: "Low monthly",
        confidence: 78,
        freshness: "API-ready",
        title: "Hotel discovery data",
        finding: "Useful for photos, location, ratings and property metadata in the operator UI.",
        nextAction: "Use for discovery only; confirm rates and availability directly.",
        confirmation: "Manual confirmation required",
        risk: "Discovery APIs do not give bookable rates or VIP amenity control.",
      },
      {
        id: `${request.id}-hotelbeds-later`,
        name: "Hotelbeds / Expedia Rapid",
        kind: "hotel",
        mode: "mock",
        cost: "Partner later",
        confidence: 70,
        freshness: "Future adapter",
        title: "Paid inventory connector",
        finding: "Best added once real hotel booking demand exists and partner approval is worthwhile.",
        nextAction: "Keep interface adapter-ready, but avoid integration cost during proof stage.",
        confirmation: "Demo data only",
        risk: "Commercial setup adds complexity before the concierge workflow is validated.",
      },
    ],
  };
}

function aviationScan(request: RequestItem, profile?: ClientProfile): LowCostProviderScan {
  const concise = profile?.serviceStyle.some((signal) => signal.detail.toLowerCase().includes("concise"));

  return {
    summary: "Low-cost aviation proof path: manual specialist routing + cheap tracking/status APIs; Avinode later.",
    operatorNote: concise
      ? "Client prefers concise recommendations: show one primary route, one fallback and clear approval requirement."
      : "Aviation should stay human-approved, with weather, baggage and payment exposure called out.",
    options: [
      {
        id: `${request.id}-aviationstack-status`,
        name: "Aviationstack",
        kind: "flight_status",
        mode: "free_api",
        cost: "Free tier",
        confidence: 74,
        freshness: "API-ready",
        title: "Commercial flight status lookup",
        finding: "Useful for identifying arrival timing and delays before arranging onward aviation or transfers.",
        nextAction: "Add API key later; for now store flight number and operator-verified status.",
        confirmation: "Live data",
        risk: "Free tier is limited and not a booking source.",
      },
      {
        id: `${request.id}-opensky-tracking`,
        name: "OpenSky Network",
        kind: "flight_status",
        mode: "free_api",
        cost: "Free tier",
        confidence: 69,
        freshness: "API-ready",
        title: "Aircraft tracking signal",
        finding: "Good for demo-grade tracking and situational awareness.",
        nextAction: "Use as a secondary signal only; never rely on it for client-critical confirmation.",
        confirmation: "Live data",
        risk: "Coverage and commercial-use suitability need review before production.",
      },
      {
        id: `${request.id}-manual-netjets`,
        name: "NetJets manual supplier",
        kind: "private_aviation",
        mode: "manual",
        cost: "No API cost",
        confidence: 84,
        freshness: "Relationship-led",
        title: "Preferred aviation supplier route",
        finding: "No public self-serve NetJets API assumed; handle through owner/member/contact workflow.",
        nextAction: "Record supplier contact, quote status, baggage limits, weather fallback and approval exposure.",
        confirmation: "Manual confirmation required",
        risk: "Do not imply NetJets availability until confirmed by the supplier.",
      },
      {
        id: `${request.id}-avinode-later`,
        name: "Avinode later",
        kind: "private_aviation",
        mode: "mock",
        cost: "Partner later",
        confidence: 73,
        freshness: "Future adapter",
        title: "Private jet marketplace connector",
        finding: "The right long-term path for charter availability, quote requests and aircraft options.",
        nextAction: "Keep the adapter interface ready; defer commercial access until demand is proven.",
        confirmation: "Demo data only",
        risk: "Paid/private marketplace access before volume may burn budget.",
      },
    ],
  };
}

function flightStatusScan(request: RequestItem, profile?: ClientProfile): LowCostProviderScan {
  const children = profile?.household.length ? "child-seat/family context is already known" : "check passenger assistance details";

  return {
    summary: "Low-cost transport path: flight status API + verified chauffeur supplier + manual safety confirmation.",
    operatorNote: `Use live/cheap flight status for timing, but keep ${children} in the manual confirmation checklist.`,
    options: [
      {
        id: `${request.id}-flightaware-lite`,
        name: "FlightAware AeroAPI",
        kind: "flight_status",
        mode: "low_cost_api",
        cost: "Low monthly",
        confidence: 86,
        freshness: "API-ready",
        title: "Commercial-grade flight monitoring",
        finding: "Best later-stage option for reliable ETAs, delays and operator monitoring.",
        nextAction: "Use once paid monitoring is justified; for MVP, simulate the status card.",
        confirmation: "Live data",
        risk: "Commercial/B2B usage should be on the correct paid tier.",
      },
      {
        id: `${request.id}-aviationstack-transport`,
        name: "Aviationstack",
        kind: "flight_status",
        mode: "free_api",
        cost: "Free tier",
        confidence: 76,
        freshness: "API-ready",
        title: "Low-cost flight status starter",
        finding: "Good enough to prove flight-triggered chauffeur updates in the UI.",
        nextAction: "Add API key after demo; keep driver confirmation manual.",
        confirmation: "Live data",
        risk: "Free tier limits and data quality may not suit premium service alone.",
      },
      {
        id: `${request.id}-chauffeur-manual`,
        name: "Verified chauffeur supplier",
        kind: "ground",
        mode: "manual",
        cost: "No API cost",
        confidence: 94,
        freshness: "Operator confirmed",
        title: "Manual transfer confirmation",
        finding: "Most important part is the supplier call/message: ETA, terminal, meet-and-greet and child seat.",
        nextAction: "Confirm driver, child seat and terminal details, then send WhatsApp response.",
        confirmation: "Manual confirmation required",
        risk: "Safety-critical child-seat details should not be inferred from an API.",
      },
    ],
  };
}
