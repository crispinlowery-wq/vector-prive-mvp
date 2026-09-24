import { clients, requests } from "@/lib/data";

export type AccessCategory = "Travel" | "Dining" | "Entertainment" | "Luxury goods" | "Wellbeing" | "Family";

export type AccessOpportunity = {
  id: string;
  title: string;
  category: AccessCategory;
  client: string;
  timing: string;
  signal: string;
  recommendedMove: string;
  confidence: number;
  accessPath: string;
  status: "proactive" | "supplier_check" | "ready_to_pitch" | "watchlist";
};

export type AccessSupplier = {
  name: string;
  category: AccessCategory;
  city: string;
  relationship: "Preferred" | "Warm" | "Scout";
  responseTime: string;
  useFor: string;
};

export type PassionProfile = {
  client: string;
  passions: AccessCategory[];
  dailyHook: string;
  nextGesture: string;
};

export const accessOpportunities: AccessOpportunity[] = [
  {
    id: "AX-001",
    title: "F1 Monaco private terrace + helicopter fallback",
    category: "Entertainment",
    client: "James Whitmore",
    timing: "Next 72 hours",
    signal: "Aviation request into Monaco plus known preference for one clear recommendation.",
    recommendedMove: "Prepare one premium terrace option, one yacht-hosted fallback and a weather-safe ground transfer plan.",
    confidence: 84,
    accessPath: "Manual: Monaco supplier call → aviation partner → approval note",
    status: "supplier_check",
  },
  {
    id: "AX-002",
    title: "Kyoto family skillcation layer",
    category: "Family",
    client: "Amelia Hart",
    timing: "For October half-term",
    signal: "Children asked for ceramics; client dislikes formal hotels.",
    recommendedMove: "Pair quiet boutique hotel shortlist with private ceramics, tea ceremony and one unstructured family day.",
    confidence: 93,
    accessPath: "Curated hotel repository → direct hotel check → private guide/studio",
    status: "ready_to_pitch",
  },
  {
    id: "AX-003",
    title: "Mayfair board dinner with privacy score",
    category: "Dining",
    client: "Marcus Chen",
    timing: "Tomorrow",
    signal: "Quiet enough to talk; one pescatarian; time-sensitive.",
    recommendedMove: "Rank restaurants by acoustics/privacy rather than celebrity value, then call for table position.",
    confidence: 91,
    accessPath: "SevenRooms-style adapter → venue call → human approval if guarantee required",
    status: "proactive",
  },
  {
    id: "AX-004",
    title: "Ramadan family travel support pack",
    category: "Wellbeing",
    client: "Sofia Rahman",
    timing: "Watchlist",
    signal: "Known family office profile; halal dining and child-seat precision matter.",
    recommendedMove: "Build reusable travel checklist: halal arrivals dining, Arabic-speaking meet & greet, child-seat supplier verification.",
    confidence: 86,
    accessPath: "Client memory → supplier repository → proactive template",
    status: "watchlist",
  },
];

export const accessSuppliers: AccessSupplier[] = [
  { name: "Riviera aviation desk", category: "Travel", city: "Nice / Monaco", relationship: "Warm", responseTime: "18m avg", useFor: "Helicopters, weather fallbacks, baggage caveats" },
  { name: "Mayfair quiet-table list", category: "Dining", city: "London", relationship: "Preferred", responseTime: "12m avg", useFor: "Discreet business dinners and private-feeling tables" },
  { name: "Kyoto cultural studio scout", category: "Family", city: "Kyoto", relationship: "Scout", responseTime: "Same day", useFor: "Private ceramics, tea, craft and child-friendly cultural access" },
  { name: "Luxury goods finder", category: "Luxury goods", city: "London / Paris", relationship: "Warm", responseTime: "2h avg", useFor: "Rare gifts, fashion sourcing and last-minute anniversary gestures" },
];

export const passionProfiles: PassionProfile[] = [
  {
    client: "Amelia Hart",
    passions: ["Family", "Travel", "Wellbeing"],
    dailyHook: "Family travel that feels intimate rather than formal.",
    nextGesture: "Send a two-option Kyoto note: serene hotel + ceramics experience, with no deposit committed.",
  },
  {
    client: "Marcus Chen",
    passions: ["Dining", "Entertainment", "Luxury goods"],
    dailyHook: "Business hosting where privacy and acoustics are the luxury.",
    nextGesture: "Offer a recurring quiet-table shortlist for board dinners in London/Singapore.",
  },
  {
    client: "Sofia Rahman",
    passions: ["Family", "Travel", "Wellbeing"],
    dailyHook: "Precise family logistics and culturally aware hospitality.",
    nextGesture: "Create a pre-arrival travel ritual: driver, child seats, halal dining and room setup confirmed in one message.",
  },
  {
    client: "James Whitmore",
    passions: ["Travel", "Entertainment"],
    dailyHook: "Fast-moving solo travel with concise, risk-controlled options.",
    nextGesture: "Proactively prepare Monaco/F1 aviation fallback notes before he asks.",
  },
];

export function accessMetrics() {
  return {
    dailyMoments: accessOpportunities.length,
    readyToPitch: accessOpportunities.filter((item) => item.status === "ready_to_pitch" || item.status === "proactive").length,
    supplierChecks: accessOpportunities.filter((item) => item.status === "supplier_check").length,
    passionCoverage: Math.round((passionProfiles.length / clients.length) * 100),
    activeRequests: requests.filter((request) => !["approved", "confirmed"].includes(request.status)).length,
  };
}
