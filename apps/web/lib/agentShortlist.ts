import type { ClientProfile } from "@/lib/clientIntelligence";
import type { RequestItem } from "@/lib/data";

export type AgentShortlistOption = {
  id: string;
  rank: number;
  name: string;
  category: string;
  fitScore: number;
  estimatedCost: string;
  linkLabel: string;
  pursueUrl: string;
  why: string;
  operatorStep: string;
  clientFit: string[];
  caveats: string[];
};

export type AgentShortlist = {
  requestId: string;
  title: string;
  summary: string;
  generatedAt: string;
  options: AgentShortlistOption[];
};

export async function generateAgentShortlist(request: RequestItem, profile?: ClientProfile): Promise<AgentShortlist> {
  await new Promise((resolve) => window.setTimeout(resolve, 720));

  const category = request.category.toLowerCase();
  if (category === "travel") return travelShortlist(request, profile);
  if (category === "dining") return diningShortlist(request, profile);
  if (category === "transport") return transportShortlist(request, profile);
  if (category === "aviation") return aviationShortlist(request, profile);
  return lifestyleShortlist(request, profile);
}

function travelShortlist(request: RequestItem, profile?: ClientProfile): AgentShortlist {
  const familyNote = profile?.household.length ? "Known family travel profile and connecting-room need" : "Family rooming inferred from request";

  return baseShortlist(request, "Top four hotel / experience options for manual pursuit", [
    {
      id: `${request.id}-hoshinoya-kyoto`,
      rank: 1,
      name: "HOSHINOYA Kyoto",
      category: "Hotel",
      fitScore: 94,
      estimatedCost: "Premium / quote required",
      linkLabel: "Open hotel website",
      pursueUrl: "https://hoshinoresorts.com/en/hotels/hoshinoyakyoto/",
      why: "Serene riverside setting, deeply Japanese, intimate and less formal than palace-style luxury.",
      operatorStep: "Check room configuration, child policy, transfers and whether connecting/family layout can be secured.",
      clientFit: [familyNote, "Quiet luxury", "Kyoto-specific sense of place"],
      caveats: ["May require boat transfer planning", "Connecting-room certainty must be confirmed manually"],
    },
    {
      id: `${request.id}-aman-kyoto`,
      rank: 2,
      name: "Aman Kyoto",
      category: "Hotel",
      fitScore: 91,
      estimatedCost: "Ultra-luxury / quote required",
      linkLabel: "Open hotel website",
      pursueUrl: "https://www.aman.com/resorts/aman-kyoto",
      why: "Exceptional calm, private-feeling grounds and high-touch service for a sophisticated family trip.",
      operatorStep: "Confirm family suitability, availability for all dates, room adjacency and cancellation/deposit terms.",
      clientFit: ["Serene setting", "Discreet service", "High-end but not flashy"],
      caveats: ["Can feel very premium/formal if not framed carefully", "High deposit exposure likely"],
    },
    {
      id: `${request.id}-genji-kyoto`,
      rank: 3,
      name: "Genji Kyoto",
      category: "Boutique hotel",
      fitScore: 88,
      estimatedCost: "Luxury boutique / check direct",
      linkLabel: "Open hotel website",
      pursueUrl: "https://www.genjikyoto.com/",
      why: "More intimate boutique tone; a good alternative if the client wants warmth over grandeur.",
      operatorStep: "Check family room layout, exact dates, breakfast, transfer support and nearby dining options.",
      clientFit: ["Informal luxury", "Boutique warmth", "Potentially less formal for children"],
      caveats: ["Inventory may be limited", "Service depth may differ from ultra-luxury resorts"],
    },
    {
      id: `${request.id}-ceramics-experience`,
      rank: 4,
      name: "Private Kyoto ceramics experience",
      category: "Experience",
      fitScore: 86,
      estimatedCost: "££ / supplier quote",
      linkLabel: "Search supplier options",
      pursueUrl: "https://www.google.com/search?q=private+ceramics+class+Kyoto+family",
      why: "Directly matches the children’s interest and adds the memorable, personal concierge layer.",
      operatorStep: "Find an English-speaking private studio, confirm children’s ages, transport time and cancellation terms.",
      clientFit: ["Child-friendly experience", "Cultural specificity", "Not over-scheduled"],
      caveats: ["Quality varies by supplier", "Should be confirmed by phone/email before client presentation"],
    },
  ]);
}

function diningShortlist(request: RequestItem, profile?: ClientProfile): AgentShortlist {
  return baseShortlist(request, "Top four dining options for manual pursuit", [
    {
      id: `${request.id}-twenty-two`,
      rank: 1,
      name: "The Twenty Two",
      category: "Restaurant / members-club feel",
      fitScore: 95,
      estimatedCost: "££££",
      linkLabel: "Open website",
      pursueUrl: "https://www.thetwentytwo.london/",
      why: "Discreet Mayfair setting with strong privacy tone for a board dinner.",
      operatorStep: "Call to confirm quiet table, party of eight, pescatarian options and cancellation/card terms.",
      clientFit: ["Quiet table", "Business hosting", "Mayfair"],
      caveats: ["Exact table position must be confirmed", "Large-party terms may apply"],
    },
    {
      id: `${request.id}-hide`,
      rank: 2,
      name: "Hide",
      category: "Fine dining",
      fitScore: 89,
      estimatedCost: "££££",
      linkLabel: "Open website",
      pursueUrl: "https://hide.co.uk/",
      why: "Polished service and strong food credibility; works if timing or privacy can be secured.",
      operatorStep: "Check table availability and whether they can place the group away from high-traffic areas.",
      clientFit: ["Pescatarian-friendly", "Premium but professional", "Central"],
      caveats: ["May be less discreet depending on room/table", "Time may shift from 19:30"],
    },
    {
      id: `${request.id}-gymkhana`,
      rank: 3,
      name: "Gymkhana",
      category: "Michelin Indian",
      fitScore: 84,
      estimatedCost: "££££",
      linkLabel: "Open website",
      pursueUrl: "https://gymkhanalondon.com/",
      why: "Excellent Mayfair option with prestige and strong pescatarian possibilities.",
      operatorStep: "Check if a quieter table is possible and whether a guarantee is required.",
      clientFit: ["Mayfair", "High-status venue", "Strong menu"],
      caveats: ["Noise/privacy may be imperfect", "Large group may require a guarantee"],
    },
    {
      id: `${request.id}-bacchanalia`,
      rank: 4,
      name: "Bacchanalia",
      category: "Statement dining",
      fitScore: 72,
      estimatedCost: "££££",
      linkLabel: "Open website",
      pursueUrl: "https://bacchanalia.co.uk/",
      why: "A useful fallback if the client values spectacle more than quiet.",
      operatorStep: "Only pursue if the operator confirms the client is open to a more theatrical room.",
      clientFit: ["Mayfair", "Impressive room", "Fallback availability"],
      caveats: ["Likely too loud for quiet board conversation", "Not first choice for discretion"],
    },
  ]);
}

function transportShortlist(request: RequestItem, profile?: ClientProfile): AgentShortlist {
  return baseShortlist(request, "Top four transport actions for manual pursuit", [
    {
      id: `${request.id}-flight-status`,
      rank: 1,
      name: "Flight status check",
      category: "Flight monitoring",
      fitScore: 97,
      estimatedCost: "Free/manual",
      linkLabel: "Search flight status",
      pursueUrl: "https://www.google.com/search?q=BA348+flight+status",
      why: "The driver timing depends on the latest flight arrival data.",
      operatorStep: "Confirm live arrival time, terminal and baggage buffer before messaging the chauffeur.",
      clientFit: ["Urgent", "Travel disruption", "Low-friction service"],
      caveats: ["Flight status can change again", "Airport terminal details should be checked"],
    },
    {
      id: `${request.id}-chauffeur`,
      rank: 2,
      name: "Verified chauffeur supplier",
      category: "Ground transport",
      fitScore: 95,
      estimatedCost: "Existing supplier",
      linkLabel: "Open Heathrow arrivals",
      pursueUrl: "https://www.heathrow.com/arrivals",
      why: "The safest short-term path is direct supplier confirmation, not automation.",
      operatorStep: "Message/call supplier with new ETA, terminal, meet point and child-seat requirement.",
      clientFit: ["Child seat", "Known family profile", "Safety-critical"],
      caveats: ["Child-seat confirmation must be explicit", "Driver response should be logged"],
    },
    {
      id: `${request.id}-meet-greet`,
      rank: 3,
      name: "Heathrow meet & greet",
      category: "Airport assistance",
      fitScore: 82,
      estimatedCost: "Quote required",
      linkLabel: "Open Heathrow services",
      pursueUrl: "https://www.heathrowvip.com/",
      why: "A premium fallback if the client needs extra assistance due to delay or children.",
      operatorStep: "Check lead time and whether service is available for the arrival terminal.",
      clientFit: ["Family travel", "Arrival support", "Premium recovery option"],
      caveats: ["Availability may be limited close to arrival", "May be unnecessary for simple transfer"],
    },
    {
      id: `${request.id}-whatsapp-template`,
      rank: 4,
      name: "Concise WhatsApp confirmation",
      category: "Client comms",
      fitScore: 90,
      estimatedCost: "No cost",
      linkLabel: "Open WhatsApp Web",
      pursueUrl: "https://web.whatsapp.com/",
      why: "Client needs reassurance once operational facts are confirmed.",
      operatorStep: "Send only after flight status and child seat are confirmed.",
      clientFit: ["Short acknowledgement", "No over-explaining", "Reassuring tone"],
      caveats: ["Do not send before supplier confirmation", "Avoid false certainty if flight is still moving"],
    },
  ]);
}

function aviationShortlist(request: RequestItem, profile?: ClientProfile): AgentShortlist {
  return baseShortlist(request, "Top four aviation options for manual pursuit", [
    {
      id: `${request.id}-monacair`,
      rank: 1,
      name: "Monacair",
      category: "Helicopter transfer",
      fitScore: 92,
      estimatedCost: "Quote required",
      linkLabel: "Open website",
      pursueUrl: "https://monacair.mc/",
      why: "Strong Nice–Monaco helicopter relevance and likely best first manual supplier check.",
      operatorStep: "Check post-BA348 timing, baggage allowance, passenger details, weather and payment terms.",
      clientFit: ["Quickest route", "Specialist aviation", "Monaco relevance"],
      caveats: ["Weather can invalidate routing", "Baggage allowance must be confirmed"],
    },
    {
      id: `${request.id}-blade-europe`,
      rank: 2,
      name: "BLADE Europe",
      category: "Helicopter / premium mobility",
      fitScore: 84,
      estimatedCost: "Quote/check live",
      linkLabel: "Open website",
      pursueUrl: "https://www.blade.com/",
      why: "Premium brand option worth checking as an alternative aviation supplier.",
      operatorStep: "Check route coverage, charter availability and fallback ground transfer.",
      clientFit: ["Premium brand", "Fast-moving solo travel", "Fallback option"],
      caveats: ["Coverage/routes must be verified", "May not fit exact Nice–Monaco requirement"],
    },
    {
      id: `${request.id}-nice-airport`,
      rank: 3,
      name: "Nice Airport live arrival context",
      category: "Flight/airport evidence",
      fitScore: 80,
      estimatedCost: "Free",
      linkLabel: "Open arrivals",
      pursueUrl: "https://www.nice.aeroport.fr/en/",
      why: "Helicopter timing depends on actual arrival, baggage and transfer buffer.",
      operatorStep: "Check arrival context and build a realistic connection buffer.",
      clientFit: ["Operational accuracy", "Avoids over-promising", "Evidence-backed"],
      caveats: ["Airport page is evidence only", "Still need supplier quote"],
    },
    {
      id: `${request.id}-ground-fallback`,
      rank: 4,
      name: "Luxury ground transfer fallback",
      category: "Fallback transport",
      fitScore: 78,
      estimatedCost: "Supplier quote",
      linkLabel: "Search supplier",
      pursueUrl: "https://www.google.com/search?q=luxury+chauffeur+Nice+Airport+to+Monaco",
      why: "Aviation requests need a weather and baggage fallback ready before client response.",
      operatorStep: "Hold/check a chauffeur backup and include it in the approval note.",
      clientFit: ["Risk-controlled", "Premium recovery", "Weather fallback"],
      caveats: ["Slower than helicopter", "Traffic can affect timing"],
    },
  ]);
}

function lifestyleShortlist(request: RequestItem, profile?: ClientProfile): AgentShortlist {
  return baseShortlist(request, "Top four lifestyle supplier options for manual pursuit", [
    {
      id: `${request.id}-hotel-concierge`,
      rank: 1,
      name: "Hotel concierge / in-room coordination",
      category: "Hotel coordination",
      fitScore: 93,
      estimatedCost: "No API cost",
      linkLabel: "Search hotel contact",
      pursueUrl: "https://www.google.com/search?q=luxury+hotel+concierge+contact",
      why: "Room access and timing matter more than supplier automation.",
      operatorStep: "Confirm room access, delivery window and whether hotel florist is trusted.",
      clientFit: ["Before arrival", "Discreet execution", "No client friction"],
      caveats: ["Hotel access must be confirmed", "Supplier handoff should be logged"],
    },
    {
      id: `${request.id}-local-florist`,
      rank: 2,
      name: "Local luxury florist",
      category: "Florist",
      fitScore: 89,
      estimatedCost: "££ / quote",
      linkLabel: "Search florist",
      pursueUrl: "https://www.google.com/search?q=luxury+florist+soft+peonies+hotel+delivery",
      why: "Best for taste-sensitive execution when the hotel florist is not suitable.",
      operatorStep: "Share exact aesthetic brief and ask for reference photos before approval.",
      clientFit: ["Natural florals", "Soft colours", "Nothing too arranged"],
      caveats: ["Peony seasonality", "Photo approval useful before delivery"],
    },
    {
      id: `${request.id}-preferred-supplier`,
      rank: 3,
      name: "Preferred lifestyle supplier record",
      category: "Internal supplier",
      fitScore: 86,
      estimatedCost: "No API cost",
      linkLabel: "Open client repository",
      pursueUrl: "/ops/clients",
      why: "Use prior outcomes and save taste preferences back to client memory.",
      operatorStep: "Check if an approved supplier already exists and update preference notes after delivery.",
      clientFit: ["Preference learning", "Repeatable service", "Quality control"],
      caveats: ["Only as good as repository data", "Needs post-completion feedback loop"],
    },
    {
      id: `${request.id}-whatsapp-proof`,
      rank: 4,
      name: "Completion photo workflow",
      category: "Client assurance",
      fitScore: 80,
      estimatedCost: "No cost",
      linkLabel: "Open WhatsApp Web",
      pursueUrl: "https://web.whatsapp.com/",
      why: "A simple confirmation/photo after setup reassures without over-communicating.",
      operatorStep: "Request supplier/hotel photo, then send only if appropriate for the client.",
      clientFit: ["Discreet reassurance", "Taste-sensitive", "Arrival moment"],
      caveats: ["Some clients dislike too many updates", "Photo should feel elegant, not operational"],
    },
  ]);
}

function baseShortlist(request: RequestItem, title: string, options: AgentShortlistOption[]): AgentShortlist {
  return {
    requestId: request.id,
    title,
    summary: "Agent-generated shortlist for operator pursuit. Links are starting points; availability, cost and commitments require manual confirmation.",
    generatedAt: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
    options,
  };
}
