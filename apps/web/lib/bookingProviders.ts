import type { RequestItem } from "@/lib/data";

export type BookingProviderId = "sevenrooms" | "manual";

export type AvailabilitySearchInput = {
  request: RequestItem;
  partySize?: number;
  dateHint?: string;
  timeHint?: string;
  locationHint?: string;
};

export type AvailabilityOption = {
  id: string;
  provider: BookingProviderId;
  venueName: string;
  neighborhood: string;
  date: string;
  time: string;
  partySize: number;
  fitScore: number;
  requiresApproval: boolean;
  paymentRequired: boolean;
  cancellationPolicy: string;
  guestNotes: string[];
  operatorNote: string;
};

export type BookingResult = {
  provider: BookingProviderId;
  status: "held" | "confirmed" | "manual_required";
  externalReference?: string;
  message: string;
};

export interface BookingProvider {
  id: BookingProviderId;
  label: string;
  searchAvailability(input: AvailabilitySearchInput): Promise<AvailabilityOption[]>;
  holdOrCreateBooking(option: AvailabilityOption, request: RequestItem): Promise<BookingResult>;
}

function inferPartySize(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("eight") || lower.includes("8")) return 8;
  if (lower.includes("four") || lower.includes("4")) return 4;
  if (lower.includes("two") || lower.includes("2")) return 2;
  return 2;
}

function inferTime(message: string) {
  if (message.match(/7\.?30|19:30/i)) return "19:30";
  if (message.match(/8\.?00|20:00/i)) return "20:00";
  if (message.match(/lunch/i)) return "12:30";
  return "19:00";
}

function inferDate(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("tomorrow")) return "Tomorrow";
  if (lower.includes("tonight")) return "Tonight";
  return "Requested date";
}

export const sevenRoomsProvider: BookingProvider = {
  id: "sevenrooms",
  label: "SevenRooms",
  async searchAvailability({ request }) {
    const partySize = inferPartySize(request.message);
    const time = inferTime(request.message);
    const date = inferDate(request.message);
    const isDining = request.category.toLowerCase() === "dining" || request.message.toLowerCase().includes("dinner");

    await new Promise((resolve) => window.setTimeout(resolve, 450));

    if (!isDining) {
      return [{
        id: `${request.id}-manual-sevenrooms`,
        provider: "manual",
        venueName: "Manual concierge route",
        neighborhood: "Provider handoff",
        date,
        time,
        partySize,
        fitScore: 62,
        requiresApproval: true,
        paymentRequired: false,
        cancellationPolicy: "Not applicable until a venue is selected",
        guestNotes: ["SevenRooms is dining-first; route this request to the correct specialist adapter."],
        operatorNote: "No SevenRooms venue match. Keep the booking request in the human workflow.",
      }];
    }

    return [
      {
        id: `${request.id}-7r-1`,
        provider: "sevenrooms",
        venueName: "The Twenty Two",
        neighborhood: "Mayfair",
        date,
        time,
        partySize,
        fitScore: 96,
        requiresApproval: false,
        paymentRequired: false,
        cancellationPolicy: "Card hold not required; release by 16:00 day-of",
        guestNotes: ["Quiet table", "Pescatarian menu flagged", "Business dinner — minimal interruptions"],
        operatorNote: "Best fit for privacy and acoustics. Ask for corner banquette away from bar traffic.",
      },
      {
        id: `${request.id}-7r-2`,
        provider: "sevenrooms",
        venueName: "Hide Above",
        neighborhood: "Piccadilly",
        date,
        time: time === "19:30" ? "20:00" : time,
        partySize,
        fitScore: 89,
        requiresApproval: false,
        paymentRequired: false,
        cancellationPolicy: "Standard cancellation terms; reconfirm large-party policy",
        guestNotes: ["Quiet table requested", "One pescatarian", "Business pacing"],
        operatorNote: "Strong alternative if Mayfair is full; slightly less discreet for confidential conversation.",
      },
      {
        id: `${request.id}-7r-3`,
        provider: "sevenrooms",
        venueName: "Gymkhana",
        neighborhood: "Mayfair",
        date,
        time: "18:45",
        partySize,
        fitScore: 82,
        requiresApproval: true,
        paymentRequired: true,
        cancellationPolicy: "Large-party card guarantee likely required",
        guestNotes: ["Private-feeling table", "Pescatarian dishes checked", "Client prefers quiet conversation"],
        operatorNote: "Excellent venue, but requires approval before any payment guarantee or commitment.",
      },
    ];
  },
  async holdOrCreateBooking(option, request) {
    await new Promise((resolve) => window.setTimeout(resolve, 350));

    if (option.provider !== "sevenrooms") {
      return {
        provider: "manual",
        status: "manual_required",
        message: "Manual concierge handoff created; no external booking was made.",
      };
    }

    return {
      provider: "sevenrooms",
      status: option.paymentRequired || option.requiresApproval ? "held" : "confirmed",
      externalReference: `7R-${request.id.replace("VEC-", "")}-${option.id.slice(-1)}`,
      message: option.paymentRequired || option.requiresApproval
        ? "SevenRooms option staged for approval; no paid guarantee committed."
        : "SevenRooms reservation mock-confirmed and ready for client review.",
    };
  },
};
