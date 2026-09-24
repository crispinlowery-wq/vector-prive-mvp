"use client";

import { Status } from "@/components/Status";
import { apiFetch } from "@/lib/authClient";
import { generateAgentShortlist, type AgentShortlist, type AgentShortlistOption } from "@/lib/agentShortlist";
import { sevenRoomsProvider, type AvailabilityOption } from "@/lib/bookingProviders";
import { bootstrapLearningFromSeed, learnFromRequest, loadClientProfiles, type ClientProfile } from "@/lib/clientIntelligence";
import {
  buildChatGPTResearchBrief,
  loadChatGPTResearchOptions,
  markResearchOptionStaged,
  saveChatGPTResearchOption,
  type ChatGPTResearchOption,
  type ChatGPTResearchOptionInput,
  type ResearchOptionKind,
} from "@/lib/chatgptResearch";
import { requests, type RequestItem, type RequestStatus } from "@/lib/data";
import { runLowCostProviderScan, type LowCostProviderScan } from "@/lib/lowCostTravelProviders";
import { runOperatorResearch, type OperatorAdvice } from "@/lib/operatorResearch";
import { getDecisionCapsule, getProofTimeline, setCapsuleState, type DecisionCapsule, type ProofEvent } from "@/lib/privateOfficeOS";
import { loadRequests, resetRequests, statusLabel, updateRequest } from "@/lib/requestStore";
import { blankEvidence, createScrapeResearchRun, runAutomaticScrapePass, type ScrapeEvidence, type ScrapeRun } from "@/lib/scrapeResearch";
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Database,
  ExternalLink,
  Globe2,
  ListChecks,
  Lightbulb,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plane,
  ReceiptText,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type InboxTab = "open" | "mine" | "approval" | "done";
type AvailabilityState = Record<string, AvailabilityOption[]>;
type ScrapeEvidenceState = Record<string, ScrapeEvidence>;
const blankResearchOption = (): ChatGPTResearchOptionInput => ({
  kind: "hotel",
  provider: "",
  title: "",
  routeOrLocation: "",
  price: "",
  availability: "",
  terms: "",
  sourceUrl: "",
  notes: "",
  checkedAt: new Date().toISOString().slice(0, 16),
});
type LiveScrapeResult = {
  id: string;
  name: string;
  url: string;
  status: "reachable" | "blocked" | "error";
  httpStatus?: number;
  contentType?: string | null;
  pageTitle?: string;
  priceSignals?: string[];
  availabilitySignals?: string[];
  operatorData?: string[];
  extractionQuality?: "useful_public_text" | "reachable_no_public_fares" | "protected_or_blocked" | "error";
  snippet?: string;
  checkedAt: string;
  note: string;
};
type LiveResearchResponse = {
  id: string; request_id: string; status: string; model: string; headline: string; summary: string;
  options: { kind: string; provider: string; title: string; route_or_location: string; price: string; availability: string; terms: string; source_url: string; checked_at: string; why_it_fits: string }[];
  risks: string[]; preferences_applied: string[]; verification_required: string[]; next_actions: string[]; draft_reply: string; input_tokens: number | null; output_tokens: number | null; created_at: string;
};
type LiveCapabilities = {
  operator_research: boolean; research_model: string | null; hotel_partner: string;
  hotel_booking: boolean; flight_search: boolean; whatsapp: boolean; safety: { research_only: boolean; human_approval_required: boolean };
};
type FlightOffer = {
  provider: string; offer_id: string; itinerary: string; amount: number; currency: string;
  refundable: boolean | null; booking_requires_operator_approval: boolean;
};
type FlightSearchForm = {
  origin: string; destination: string; outboundDate: string; returnDate: string; adults: number;
};
type SharedOperation = {
  id: string; kind: "proof_event" | "decision_capsule"; request_id: string | null; title: string; status: string;
  payload: { actor?: string; detail?: string; state?: ProofEvent["state"]; approval_id?: string };
};

function InboxView() {
  const q = useSearchParams();
  const [items, setItems] = useState<RequestItem[]>(requests);
  const [selectedId, setSelectedId] = useState(q.get("id") || requests[0]?.id);
  const [activeTab, setActiveTab] = useState<InboxTab>("open");
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [checkingProvider, setCheckingProvider] = useState(false);
  const [bookingOptions, setBookingOptions] = useState<AvailabilityState>({});
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [researching, setResearching] = useState(false);
  const [advice, setAdvice] = useState<OperatorAdvice | null>(null);
  const [providerScanning, setProviderScanning] = useState(false);
  const [providerScan, setProviderScan] = useState<LowCostProviderScan | null>(null);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [shortlist, setShortlist] = useState<AgentShortlist | null>(null);
  const [scrapeRun, setScrapeRun] = useState<ScrapeRun | null>(null);
  const [scrapeEvidence, setScrapeEvidence] = useState<ScrapeEvidenceState>({});
  const [autoScraping, setAutoScraping] = useState(false);
  const [liveChecking, setLiveChecking] = useState(false);
  const [liveScrapeResults, setLiveScrapeResults] = useState<Record<string, LiveScrapeResult>>({});
  const [chatgptOptions, setChatgptOptions] = useState<ChatGPTResearchOption[]>([]);
  const [researchOption, setResearchOption] = useState<ChatGPTResearchOptionInput>(blankResearchOption);
  const [decisionCapsule, setDecisionCapsule] = useState<DecisionCapsule | null>(null);
  const [proofTimeline, setProofTimeline] = useState<ProofEvent[]>([]);
  const [capabilities, setCapabilities] = useState<LiveCapabilities | null>(null);
  const [flightSearch, setFlightSearch] = useState<FlightSearchForm>({ origin: "LHR", destination: "JFK", outboundDate: "", returnDate: "", adults: 1 });
  const [flightSearching, setFlightSearching] = useState(false);
  const [flightOffers, setFlightOffers] = useState<FlightOffer[]>([]);

  async function loadSharedTimeline(requestId: string) {
    const records = await apiFetch<SharedOperation[]>(`/operations/proof_event?request_id=${requestId}`);
    return records.map((record) => ({
      id: record.id,
      requestId,
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      actor: record.payload.actor || "Vector",
      title: record.title,
      detail: record.payload.detail || "Recorded in the Vector service timeline.",
      state: record.payload.state || (record.status === "risk" ? "risk" : record.status === "waiting" ? "waiting" : "complete"),
    }));
  }

  useEffect(() => {
    const sync = () => setItems(loadRequests());
    sync();
    void apiFetch<LiveRequest[]>("/requests").then((records) => {
      const live = records.map(liveRequestItem);
      const liveIds = new Set(live.map((item) => item.id));
      setItems([...live, ...loadRequests().filter((item) => !liveIds.has(item.id))]);
      if (!q.get("id") && live[0]) setSelectedId(live[0].id);
    }).catch(() => undefined);
    void apiFetch<LiveCapabilities>("/capabilities").then(setCapabilities).catch(() => undefined);
    window.addEventListener("vector-prive-requests-updated", sync);
    return () => window.removeEventListener("vector-prive-requests-updated", sync);
  }, []);

  useEffect(() => {
    const syncMemory = () => setProfiles(loadClientProfiles());
    bootstrapLearningFromSeed();
    syncMemory();
    void apiFetch<LiveClientMemory[]>("/clients").then((records) => {
      const live = records.filter((record) => record.onboarding_completed_at).map(liveClientProfile);
      setProfiles((current) => {
        const liveNames = new Set(live.map((item) => item.name));
        return [...live, ...current.filter((item) => !liveNames.has(item.name))];
      });
    }).catch(() => undefined);
    window.addEventListener("vector-prive-client-memory-updated", syncMemory);
    return () => window.removeEventListener("vector-prive-client-memory-updated", syncMemory);
  }, []);

  const selected = useMemo(() => {
    return items.find((request) => request.id === selectedId) || items[0];
  }, [items, selectedId]);

  const profile = useMemo(() => {
    return profiles.find((item) => item.name === selected?.client);
  }, [profiles, selected?.client]);

  useEffect(() => {
    if (selected) {
      const remembered = profile?.serverId ? [...profile.preferences, ...profile.dietary, ...profile.serviceStyle]
        .filter((item) => item.status !== "hidden" && item.confidence >= 75)
        .slice(0, 3)
        .map((item) => item.detail.replace(/[.]+$/, "")) : [];
      setDraft(remembered.length ? `${selected.draft}\n\nI’m also taking account of what you have told us previously, including ${remembered.join("; ").toLowerCase()}.` : selected.draft);
    }
    setSelectedOptionId("");
    setAdvice(null);
    setProviderScan(null);
    setShortlist(null);
    setScrapeRun(null);
    setScrapeEvidence({});
    setAutoScraping(false);
    setLiveScrapeResults({});
    setChatgptOptions(selected ? loadChatGPTResearchOptions(selected.id) : []);
    setFlightOffers([]);
    setResearchOption(blankResearchOption());
    if (selected) {
      setDecisionCapsule(getDecisionCapsule(selected));
      setProofTimeline(getProofTimeline(selected.id));
      if (selected.serverId) {
        void loadSharedTimeline(selected.serverId).then((timeline) => {
          if (timeline.length) setProofTimeline(timeline);
        }).catch(() => undefined);
      }
    }
  }, [selected?.id, profile?.serverId]);

  const chatgptBrief = useMemo(() => selected ? buildChatGPTResearchBrief(selected, profile) : "", [selected, profile]);

  const filtered = useMemo(() => {
    if (activeTab === "mine") return items.filter((request) => request.owner === "Crispin");
    if (activeTab === "approval") return items.filter((request) => request.status === "awaiting_approval");
    if (activeTab === "done") return items.filter((request) => ["approved", "confirmed"].includes(request.status));
    return items.filter((request) => !["approved", "confirmed"].includes(request.status));
  }, [activeTab, items]);

  function act(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function patchSelected(updates: Partial<RequestItem>, message: string) {
    if (!selected) return;
    const updated = updateRequest(selected.id, updates);
    setItems(loadRequests());
    if (updated) setSelectedId(updated.id);
    act(message);
  }

  function saveDraft() {
    patchSelected({ draft, status: selected.status === "new" ? "triaged" : selected.status }, "Draft saved and triage updated");
  }

  async function stageDecisionCapsule() {
    if (!selected || !decisionCapsule) return;
    if (selected.serverId) {
      try {
        const existing = await apiFetch<SharedOperation[]>(`/operations/decision_capsule?request_id=${selected.serverId}`);
        if (!existing.some((record) => record.status === "awaiting_approval" || record.status === "active")) {
          await apiFetch("/operations/decision_capsule", { method: "POST", body: JSON.stringify({
            request_id: selected.serverId,
            title: decisionCapsule.title,
            status: "awaiting_approval",
            payload: {
              provider: decisionCapsule.recommendation.provider,
              summary: decisionCapsule.recommendation.summary,
              price: decisionCapsule.recommendation.price,
              terms: decisionCapsule.recommendation.terms,
              liveStatus: decisionCapsule.recommendation.liveStatus,
              reasons: decisionCapsule.reasons,
              authority: decisionCapsule.authority,
              expiresAt: decisionCapsule.expiresAt,
              checkedAt: decisionCapsule.checkedAt,
            },
          }) });
          await apiFetch("/operations/proof_event", { method: "POST", body: JSON.stringify({ request_id: selected.serverId, title: "Decision sent for secure approval", status: "waiting", payload: { actor: selected.owner === "Unassigned" ? "Vector operator" : selected.owner, detail: "Exact recommendation, price and terms were sent for secure member approval.", state: "waiting" } }) });
        }
        setProofTimeline(await loadSharedTimeline(selected.serverId));
      } catch (error) {
        act(error instanceof Error ? error.message : "Could not create the secure approval.");
        return;
      }
    }
    setCapsuleState(selected.id, "awaiting_approval", selected.owner === "Unassigned" ? "Vector operator" : selected.owner);
    const refreshed = getDecisionCapsule(selected);
    setDecisionCapsule(refreshed);
    setProofTimeline(getProofTimeline(selected.id));
    patchSelected({
      status: "awaiting_approval",
      owner: selected.owner === "Unassigned" ? "Crispin" : selected.owner,
      rationale: [...selected.rationale, `Decision Capsule sent: ${refreshed.recommendation.provider}`],
    }, "Decision Capsule sent for secure approval");
  }

  function reviewSend() {
    if (selected.status === "awaiting_approval") {
      act("Human approval required before sending");
      return;
    }
    patchSelected({ draft, status: "in_progress", owner: selected.owner === "Unassigned" ? "Crispin" : selected.owner }, "Ready for channel review");
  }

  function approve() {
    patchSelected({ draft, status: "approved", owner: "Crispin" }, "Approved — audit entry created");
  }

  function returnToOperator() {
    patchSelected({ status: "triaged", owner: "Crispin" }, "Returned to operator for refinement");
  }

  function learnSelectedRequest() {
    if (!selected) return;
    const updated = learnFromRequest(selected);
    setProfiles(loadClientProfiles());
    act(`Client memory updated for ${updated.name}`);
  }

  async function copyChatGPTBrief(openChatGPT = false) {
    try {
      await navigator.clipboard.writeText(chatgptBrief);
      act(openChatGPT ? "Safe brief copied — paste it into ChatGPT" : "Safe research brief copied");
    } catch {
      act("Select and copy the safe brief manually");
    }
    if (openChatGPT) window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }

  function updateResearchOption<K extends keyof ChatGPTResearchOptionInput>(key: K, value: ChatGPTResearchOptionInput[K]) {
    setResearchOption((current) => ({ ...current, [key]: value }));
  }

  function updateFlightSearch<K extends keyof FlightSearchForm>(key: K, value: FlightSearchForm[K]) {
    setFlightSearch((current) => ({ ...current, [key]: value }));
  }

  async function searchNuiteeFlights() {
    if (!selected?.serverId) {
      act("Choose a live request before searching flights");
      return;
    }
    const origin = flightSearch.origin.trim().toUpperCase();
    const destination = flightSearch.destination.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || !flightSearch.outboundDate) {
      act("Enter valid three-letter airport codes and an outbound date");
      return;
    }
    if (flightSearch.returnDate && flightSearch.returnDate < flightSearch.outboundDate) {
      act("Return date must be after the outbound date");
      return;
    }
    setFlightSearching(true);
    setFlightOffers([]);
    try {
      const legs = [{ origin, destination, date: flightSearch.outboundDate, direction: "OUTBOUND" }];
      if (flightSearch.returnDate) legs.push({ origin: destination, destination: origin, date: flightSearch.returnDate, direction: "INBOUND" });
      const offers = await apiFetch<FlightOffer[]>("/partners/flights/search", {
        method: "POST",
        body: JSON.stringify({ request_id: selected.serverId, legs, adults: flightSearch.adults, currency: "GBP" }),
      });
      setFlightOffers(offers);
      act(offers.length ? `${offers.length} flight option${offers.length === 1 ? "" : "s"} found — research only` : "No flight options returned for these dates");
    } catch (error) {
      act(error instanceof Error ? error.message : "Flight search is temporarily unavailable");
    } finally {
      setFlightSearching(false);
    }
  }

  function captureChatGPTOption() {
    if (!selected) return;
    if (!researchOption.provider.trim() || !researchOption.title.trim() || !researchOption.sourceUrl.trim()) {
      act("Add the provider, option title and source link first");
      return;
    }
    try {
      const parsedUrl = new URL(researchOption.sourceUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error("unsupported protocol");
    } catch {
      act("Add a valid http or https source link");
      return;
    }
    saveChatGPTResearchOption(selected.id, researchOption, selected.owner === "Unassigned" ? "Vector operator" : selected.owner);
    setChatgptOptions(loadChatGPTResearchOptions(selected.id));
    setResearchOption(blankResearchOption());
    patchSelected({
      owner: selected.owner === "Unassigned" ? "Crispin" : selected.owner,
      status: selected.status === "new" ? "triaged" : selected.status,
      rationale: [...selected.rationale, `ChatGPT-assisted research recorded from ${researchOption.provider}; operator verification pending`],
    }, "Research option recorded with source and timestamp");
  }

  function stageChatGPTOption(option: ChatGPTResearchOption) {
    if (!selected) return;
    const firstName = selected.client.split(" ")[0];
    const price = option.price || "Price to be reconfirmed";
    const terms = option.terms || "Terms require confirmation";
    const revisedDraft = `${firstName} — I’ve researched ${option.title} via ${option.provider}. ${option.routeOrLocation ? `${option.routeOrLocation}. ` : ""}${price}. ${option.availability || "Availability requires final confirmation"}. ${terms}. I will reconfirm the live price and terms before anything is booked.`;
    markResearchOptionStaged(option.id);
    setChatgptOptions(loadChatGPTResearchOptions(selected.id));
    setDraft(revisedDraft);
    patchSelected({
      draft: revisedDraft,
      status: "awaiting_approval",
      owner: selected.owner === "Unassigned" ? "Crispin" : selected.owner,
      rationale: [...selected.rationale, `Operator staged ${option.provider} research checked ${new Date(option.checkedAt).toLocaleString()}; human approval required`],
    }, "Option staged for human approval");
  }

  async function runResearch() {
    if (!selected || !profile) return;
    setResearching(true);
    try {
      if (selected.serverId && capabilities?.operator_research) {
        const result = await apiFetch<LiveResearchResponse>(`/requests/${selected.serverId}/research`, { method: "POST" });
        setAdvice({
          headline: result.headline, recommendation: result.summary, confidence: null,
          preferencesApplied: result.preferences_applied || [], risks: [...result.risks, ...(result.verification_required || []).map((item) => `Verify before action: ${item}`)], nextActions: result.next_actions, draftReply: result.draft_reply,
          live: true, model: result.model,
          searchResults: result.options.map((option) => ({
            source: option.provider, title: option.title,
            finding: [option.route_or_location, option.price, option.availability, option.terms].filter(Boolean).join(" · "),
            action: option.why_it_fits, sourceUrl: option.source_url,
          })),
        });
        act("Live research completed with sources");
      } else {
        const result = await runOperatorResearch(selected, profile);
        setAdvice(result);
        act(selected.serverId ? "Guided research ready — live web research is not enabled yet" : "Demo research completed");
      }
    } catch (error) {
      act(error instanceof Error ? error.message : "Live research failed — use the manual route");
    } finally {
      setResearching(false);
    }
  }

  function useResearchDraft() {
    if (!selected || !advice?.draftReply) return;
    setDraft(advice.draftReply);
    patchSelected({
      draft: advice.draftReply,
      status: selected.status === "new" ? "triaged" : selected.status,
      owner: selected.owner === "Unassigned" ? "Crispin" : selected.owner,
      rationale: [...selected.rationale, "Live AI research reviewed by operator; no booking or commitment made"],
    }, "Research draft added for operator review");
  }

  async function runProviderScan() {
    if (!selected) return;
    setProviderScanning(true);
    try {
      const result = await runLowCostProviderScan(selected, profile);
      setProviderScan(result);
      act("Low-cost provider routes generated");
    } finally {
      setProviderScanning(false);
    }
  }

  async function runAgentShortlist() {
    if (!selected) return;
    setShortlistLoading(true);
    try {
      const result = await generateAgentShortlist(selected, profile);
      setShortlist(result);
      act("Top four agent options generated");
    } finally {
      setShortlistLoading(false);
    }
  }

  function useShortlistInDraft(option?: AgentShortlistOption) {
    if (!selected || !shortlist) return;
    const firstName = selected.client.split(" ")[0];
    const optionLines = (option ? [option] : shortlist.options).map((item) => `${item.rank}. ${item.name} — ${item.why} Manual check: ${item.operatorStep}`).join("\n");
    const revisedDraft = option
      ? `${firstName} — my strongest route is ${option.name}. ${option.why} I’m manually checking availability, cost and any commitment terms before I recommend or book it.`
      : `${firstName} — I’m checking four strong options now:\n${optionLines}\n\nI’ll verify availability, cost and terms manually before anything is committed.`;
    setDraft(revisedDraft);
    patchSelected({
      draft: revisedDraft,
      status: selected.status === "new" ? "triaged" : selected.status,
      owner: selected.owner === "Unassigned" ? "Crispin" : selected.owner,
      rationale: [...selected.rationale, `Agent shortlist generated: ${shortlist.options.map((item) => item.name).join(", ")}`],
    }, option ? "Selected option added to draft" : "Top four options added to draft");
  }

  async function startScrapeResearch() {
    if (!selected) return;
    setAutoScraping(true);
    const run = createScrapeResearchRun(selected, profile);
    setScrapeRun(run);
    const nextEvidence = run.targets.reduce<ScrapeEvidenceState>((acc, target) => {
      acc[target.id] = blankEvidence(target.id);
      return acc;
    }, {});
    setScrapeEvidence(nextEvidence);
    try {
      const automaticEvidence = await runAutomaticScrapePass(run, selected, profile);
      setScrapeEvidence(automaticEvidence.reduce<ScrapeEvidenceState>((acc, evidence) => {
        acc[evidence.targetId] = evidence;
        return acc;
      }, {}));
      act("Automatic scrape research pass completed");
    } finally {
      setAutoScraping(false);
    }
  }

  function updateScrapeEvidence(targetId: string, updates: Partial<ScrapeEvidence>) {
    setScrapeEvidence((current) => ({
      ...current,
      [targetId]: { ...(current[targetId] || blankEvidence(targetId)), ...updates },
    }));
  }

  function addScrapeEvidenceToDraft() {
    if (!selected || !scrapeRun) return;
    const firstName = selected.client.split(" ")[0];
    const lines = scrapeRun.targets.map((target) => {
      const evidence = scrapeEvidence[target.id] || blankEvidence(target.id);
      return `${target.priority}. ${target.name}: ${evidence.observedAvailability || "availability not recorded"} · ${evidence.observedPrice || "price not recorded"} · checked ${evidence.checkedAt}. Notes: ${evidence.notes || "manual verification still required"}`;
    }).join("\n");
    const revisedDraft = `${firstName} — I’m checking live-site availability/pricing now. Current research notes:\n${lines}\n\nI’ll manually verify the strongest option before recommending or booking anything.`;
    setDraft(revisedDraft);
    patchSelected({
      draft: revisedDraft,
      status: selected.status === "new" ? "triaged" : selected.status,
      owner: selected.owner === "Unassigned" ? "Crispin" : selected.owner,
      rationale: [...selected.rationale, "Scrape-assisted operator research captured; manual confirmation required"],
    }, "Scrape research added to draft");
  }

  async function runLiveScrapeCheck() {
    if (!scrapeRun) return;
    setLiveChecking(true);
    try {
      const response = await fetch("/api/live-scrape/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targets: scrapeRun.targets.map((target) => ({
            id: target.id,
            name: target.name,
            url: target.url,
          })),
        }),
      });
      const payload = await response.json();
      const results = Array.isArray(payload.results) ? payload.results as LiveScrapeResult[] : [];
      setLiveScrapeResults(results.reduce<Record<string, LiveScrapeResult>>((acc, result) => {
        acc[result.id] = result;
        return acc;
      }, {}));
      setScrapeEvidence((current) => {
        const next = { ...current };
        for (const result of results) {
          const existing = next[result.id] || blankEvidence(result.id);
          const priceText = result.priceSignals?.length ? result.priceSignals.join(" · ") : existing.observedPrice;
          const availabilityText = result.availabilitySignals?.length
            ? result.availabilitySignals.join(" · ")
            : result.status === "reachable"
              ? existing.observedAvailability || "Live page reached; fares/availability hidden behind dynamic site flow"
              : existing.observedAvailability || "No live data extracted";
          const noteParts = [
            result.pageTitle ? `Page: ${result.pageTitle}` : "",
            result.snippet ? `Snippet: ${result.snippet}` : "",
            result.operatorData?.length ? `Operator data:\n- ${result.operatorData.join("\n- ")}` : "",
            result.note,
          ].filter(Boolean);
          next[result.id] = {
            ...existing,
            observedPrice: priceText || "Live extraction did not expose public fare text; use airline search link for manual fare check",
            observedAvailability: availabilityText,
            notes: noteParts.join("\n"),
            checkedAt: result.checkedAt,
            automationStatus: result.status === "reachable" && (result.priceSignals?.length || result.availabilitySignals?.length)
              ? "captured_signal"
              : result.status === "blocked"
                ? "blocked"
                : "manual_verification",
            sourceUrl: result.url,
          };
        }
        return next;
      });
      act("Live target reachability check completed");
    } catch {
      act("Live target check failed — use manual links");
    } finally {
      setLiveChecking(false);
    }
  }

  async function checkSevenRoomsAvailability() {
    if (!selected) return;
    setCheckingProvider(true);
    try {
      const options = await sevenRoomsProvider.searchAvailability({ request: selected });
      setBookingOptions((current) => ({ ...current, [selected.id]: options }));
      act(options[0]?.provider === "manual" ? "SevenRooms checked — manual route recommended" : "SevenRooms availability returned");
    } finally {
      setCheckingProvider(false);
    }
  }

  async function stageBooking(option: AvailabilityOption) {
    if (!selected) return;
    const result = await sevenRoomsProvider.holdOrCreateBooking(option, selected);
    const optionSummary = `${option.venueName}, ${option.neighborhood} — ${option.date} at ${option.time} for ${option.partySize}.`;
    const externalLine = result.externalReference ? ` Provider ref: ${result.externalReference}.` : "";
    const approvalLine = option.requiresApproval || option.paymentRequired
      ? " I’ll get approval before committing any guarantee or payment."
      : " I can proceed once you approve this recommendation.";

    const revisedDraft = `${selected.client.split(" ")[0]} — I’ve checked SevenRooms availability and the strongest option is ${optionSummary}${approvalLine}${externalLine}`;
    setDraft(revisedDraft);
    patchSelected({
      draft: revisedDraft,
      status: option.requiresApproval || option.paymentRequired ? "awaiting_approval" : "in_progress",
      owner: selected.owner === "Unassigned" ? "Crispin" : selected.owner,
      rationale: [...selected.rationale, `${sevenRoomsProvider.label}: ${result.message}`],
    }, result.message);
  }

  function resetDemo() {
    resetRequests();
    const seeded = loadRequests();
    setItems(seeded);
    setSelectedId(seeded[0]?.id);
    act("Demo data restored");
  }

  if (!selected) return null;

  const counts = {
    open: items.filter((request) => !["approved", "confirmed"].includes(request.status)).length,
    mine: items.filter((request) => request.owner === "Crispin").length,
    approval: items.filter((request) => request.status === "awaiting_approval").length,
    done: items.filter((request) => ["approved", "confirmed"].includes(request.status)).length,
  };
  const options = bookingOptions[selected.id] || [];
  const selectedOption = options.find((option) => option.id === selectedOptionId);

  return <div className="inbox-page">
    <section className="inbox-list">
      <div className="inbox-title">
        <div><p className="eyebrow">OPERATIONS</p><h1>Request inbox</h1></div>
        <button onClick={resetDemo} title="Restore seed data"><RotateCcw/></button>
      </div>
      <div className="inbox-tabs">
        {([
          ["open", "Open", counts.open],
          ["mine", "Mine", counts.mine],
          ["approval", "Approval", counts.approval],
          ["done", "Done", counts.done],
        ] as const).map(([key, label, count]) => <button key={key} className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)}>{label} <b>{count}</b></button>)}
      </div>
      <div className="filter-row"><button>All categories <ChevronDown/></button><button>All urgency <ChevronDown/></button></div>
      <div className="request-list">
        {filtered.map((request) => <button onClick={() => setSelectedId(request.id)} className={selected.id === request.id ? "selected" : ""} key={request.id}>
          <div className="request-line"><div className="avatar sm">{request.initials}</div><div><strong>{request.client}</strong><small>{request.received}</small></div></div>
          <h3>{request.title}</h3>
          <p>{request.message}</p>
          <div className="request-meta"><Status value={request.status}/><span>{request.category}</span><i className={`dot ${request.urgency}`}/></div>
        </button>)}
      </div>
    </section>

    <section className="request-detail">
      <div className="detail-head">
        <div><span className="crumb">REQUESTS / {selected.id}</span><h2>{selected.title}</h2><div><Status value={selected.status}/><span className={`urgency ${selected.urgency}`}>{selected.urgency}</span><span><Clock3/> {selected.received}</span></div></div>
        <button><MoreHorizontal/></button>
      </div>
      <div className="message-card">
        <div className="avatar">{selected.initials}</div>
        <div><div className="message-name"><strong>{selected.client}</strong><span>{selected.channel === "WhatsApp" ? <MessageCircle/> : <Mail/>}{selected.channel}</span></div><p>{selected.message}</p></div>
      </div>
      <div className="facts">
        <div><small>CATEGORY</small><b>{selected.category}</b></div>
        <div><small>BUDGET</small><b>{selected.budget}</b></div>
        <div><small>OWNER</small><b><UserRound/> {selected.owner}</b></div>
        <div><small>AI CONFIDENCE</small><b className="confidence">{selected.confidence}%</b></div>
      </div>
      {decisionCapsule && <div className="decision-capsule-panel">
        <header className="decision-head">
          <div><span><ReceiptText/></span><div><small>60-SECOND DECISION</small><h3>Decision Capsule</h3><p>One recommendation, exact terms and clear authority.</p></div></div>
          <div className={`decision-state ${decisionCapsule.approvalState}`}>{decisionCapsule.approvalState.replaceAll("_", " ")}</div>
        </header>
        <div className="decision-recommendation">
          <div className="decision-rank"><Sparkles/><span>{decisionCapsule.recommendation.label}</span><b>{decisionCapsule.recommendation.fit}% fit</b></div>
          <div className="decision-main"><small>{decisionCapsule.recommendation.provider}</small><h3>{decisionCapsule.recommendation.summary}</h3><div><strong>{decisionCapsule.recommendation.price}</strong><span>{decisionCapsule.recommendation.terms}</span></div><p><Check/> {decisionCapsule.recommendation.liveStatus}</p></div>
        </div>
        <div className="decision-bottom">
          <section><small>WHY THIS WINS</small>{decisionCapsule.reasons.map((reason) => <p key={reason}><Check/>{reason}</p>)}</section>
          <section><small>ALTERNATIVES</small>{decisionCapsule.alternatives.map((option) => <article key={option.id}><div><b>{option.provider}</b><span>{option.fit}% fit</span></div><p>{option.summary}</p><strong>{option.price}</strong></article>)}</section>
          <aside><small>AUTHORITY & EXPIRY</small><ShieldCheck/><b>{decisionCapsule.authority}</b><p>Decision window: {decisionCapsule.expiresAt}</p><button onClick={() => void stageDecisionCapsule()} disabled={decisionCapsule.approvalState === "awaiting_approval" || decisionCapsule.approvalState === "approved"}>{decisionCapsule.approvalState === "draft" ? "Send for secure approval" : decisionCapsule.approvalState === "approved" ? "Approved" : "Awaiting principal"}</button></aside>
        </div>
      </div>}
      <div className="proof-timeline-panel">
        <header><div><span><ShieldCheck/></span><div><small>SERVICE PROOF</small><h3>No chasing required.</h3><p>Every check, decision and supplier action in one trusted timeline.</p></div></div><b>{proofTimeline.filter((event) => event.state === "complete").length}/{proofTimeline.length} complete</b></header>
        <div className="proof-events">{proofTimeline.length ? proofTimeline.map((event, index) => <article key={event.id} className={event.state}><div className="proof-line"><i>{event.state === "complete" ? <Check/> : event.state === "risk" ? <AlertTriangle/> : <Clock3/>}</i>{index < proofTimeline.length - 1 && <span/>}</div><div><time>{event.at} · {event.actor}</time><h4>{event.title}</h4><p>{event.detail}</p></div></article>) : <p className="proof-empty">The first verified action will start this timeline.</p>}</div>
      </div>
      <div className="operator-advice">
        <div className="operator-advice-head">
          <div><span><Search/></span><div><h3>Vector Intelligence Brief</h3><p>Privacy-filtered research, confirmed preference context and explicit human checks.</p></div></div>
          <button onClick={runResearch} disabled={researching || !profile}>{researching ? "Preparing…" : selected.serverId && capabilities?.operator_research ? "Prepare brief" : "Run guided research"}</button>
        </div>
        {advice ? <div className="advice-body">
          <div className="advice-primary"><small>{advice.live ? `INTELLIGENCE BRIEF · ${advice.model || "OpenAI"} · RESEARCH ONLY` : `DEMO RECOMMENDED ROUTE · ${advice.confidence}% confidence`}</small><h3>{advice.headline}</h3><p>{advice.recommendation}</p>{advice.preferencesApplied?.length ? <div className="preferences-applied"><small>PREFERENCES APPLIED</small>{advice.preferencesApplied.map((item) => <span key={item}><Check/>{item}</span>)}</div> : null}{advice.draftReply && <button className="use-research-draft" onClick={useResearchDraft}>Use suggested reply in draft</button>}</div>
          <div className="advice-grid">
            <div><small>SOURCED OPTIONS</small>{advice.searchResults.map((result) => <article key={`${result.source}-${result.title}`}><b>{result.title}</b><span>{result.source}</span><p>{result.finding}</p><em>{result.action}</em>{result.sourceUrl && <a href={result.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink/> Open source</a>}</article>)}</div>
            <div><small>RISKS TO CONTROL</small>{advice.risks.map((risk) => <p key={risk}><Lightbulb/> {risk}</p>)}<small>NEXT ACTIONS</small>{advice.nextActions.map((action) => <p key={action}><Check/> {action}</p>)}</div>
          </div>
        </div> : <div className="advice-empty"><Brain/><p>{selected.serverId && capabilities && !capabilities.operator_research ? "Guided research is available now. Live web research will activate when the OpenAI API project has credits." : "Research current public sources. Results are evidence for an operator, never authority to book, contact or spend."}</p></div>}
      </div>
      <div className="chatgpt-research-panel">
        <div className="chatgpt-research-head">
          <div><span><Sparkles/></span><div><h3>Manual research fallback</h3><p>Use connected ChatGPT tools when a specialist plugin adds useful coverage.</p></div></div>
          <div className="chatgpt-research-actions"><button onClick={() => copyChatGPTBrief(false)}>Copy safe brief</button><button className="primary-research" onClick={() => copyChatGPTBrief(true)}><ExternalLink/> Open ChatGPT</button></div>
        </div>
        <div className="chatgpt-privacy-note"><ShieldCheck/><div><strong>Privacy-safe operator workflow</strong><p>The brief excludes the client name and removes common contact, passport, account and payment-number patterns. Review it before pasting. ChatGPT may research; it must not book.</p></div></div>
        <details className="chatgpt-brief"><summary>Review the brief sent to ChatGPT</summary><textarea readOnly value={chatgptBrief}/></details>
        <div className="chatgpt-capture">
          <div className="chatgpt-capture-title"><div><small>RETURN RESULTS TO VECTOR PRIVÉ</small><h4>Record a sourced option</h4></div><span>Operator-entered · unverified</span></div>
          <div className="chatgpt-fields">
            <label>Type<select value={researchOption.kind} onChange={(event) => updateResearchOption("kind", event.target.value as ResearchOptionKind)}><option value="hotel">Hotel</option><option value="flight">Flight</option></select></label>
            <label>Provider or plugin<input value={researchOption.provider} onChange={(event) => updateResearchOption("provider", event.target.value)} placeholder="e.g. Booking.com or Skyscanner"/></label>
            <label>Option title<input value={researchOption.title} onChange={(event) => updateResearchOption("title", event.target.value)} placeholder="Property, flight or fare"/></label>
            <label>Route or location<input value={researchOption.routeOrLocation} onChange={(event) => updateResearchOption("routeOrLocation", event.target.value)} placeholder="LHR–HND or Kyoto, Japan"/></label>
            <label>Exact price and currency<input value={researchOption.price} onChange={(event) => updateResearchOption("price", event.target.value)} placeholder="e.g. £2,840 return incl. taxes"/></label>
            <label>Availability wording<input value={researchOption.availability} onChange={(event) => updateResearchOption("availability", event.target.value)} placeholder="e.g. Available when checked; not held"/></label>
            <label>Cancellation/change terms<input value={researchOption.terms} onChange={(event) => updateResearchOption("terms", event.target.value)} placeholder="Refundable, deadline and penalties"/></label>
            <label>Direct source URL<input value={researchOption.sourceUrl} onChange={(event) => updateResearchOption("sourceUrl", event.target.value)} placeholder="https://…" inputMode="url"/></label>
            <label>Checked at<input type="datetime-local" value={researchOption.checkedAt} onChange={(event) => updateResearchOption("checkedAt", event.target.value)}/></label>
            <label className="wide">Operator notes<textarea value={researchOption.notes} onChange={(event) => updateResearchOption("notes", event.target.value)} placeholder="What is included, caveats, baggage or room configuration…"/></label>
          </div>
          <button className="capture-option" onClick={captureChatGPTOption}>Record research evidence</button>
        </div>
        {chatgptOptions.length > 0 && <div className="chatgpt-options">
          {chatgptOptions.map((option) => <article key={option.id}>
            <div className="chatgpt-option-head"><div><small>{option.kind} · {option.provider}</small><h4>{option.title}</h4></div><span className={option.verificationStatus}>{option.verificationStatus === "staged_for_approval" ? "Awaiting approval" : "Operator-entered"}</span></div>
            <p>{option.routeOrLocation || "Route/location not recorded"}</p>
            <div className="chatgpt-option-facts"><b>{option.price || "Price not recorded"}</b><b>{option.availability || "Availability not recorded"}</b><b>{option.terms || "Terms not recorded"}</b></div>
            {option.notes && <p className="chatgpt-option-notes">{option.notes}</p>}
            <div className="chatgpt-option-footer"><a href={option.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink/> Open source</a><time>Checked {new Date(option.checkedAt).toLocaleString()}</time><button onClick={() => stageChatGPTOption(option)}>Stage for approval</button></div>
          </article>)}
        </div>}
      </div>
      <div className="provider-panel">
        <div className="provider-head">
          <div><span><Plane/></span><div><h3>Low-cost connector routes</h3><p>Free/cheap APIs, manual suppliers and future paid adapters — clearly separated.</p></div></div>
          <button onClick={runProviderScan} disabled={providerScanning}>{providerScanning ? "Scanning…" : "Find low-cost routes"}</button>
        </div>
        {providerScan ? <div className="provider-body">
          <div className="provider-summary">
            <ShieldCheck/>
            <div><strong>{providerScan.summary}</strong><p>{providerScan.operatorNote}</p></div>
          </div>
          <div className="provider-grid">
            {providerScan.options.map((option) => <article key={option.id} className={`provider-card ${option.mode}`}>
              <div className="provider-card-top">
                <div><small>{option.name}</small><h4>{option.title}</h4></div>
                <span>{option.confidence}%</span>
              </div>
              <p>{option.finding}</p>
              <div className="provider-tags">
                <b>{option.cost}</b>
                <b>{option.confirmation}</b>
                <b>{option.freshness}</b>
              </div>
              <div className="provider-action"><Check/> {option.nextAction}</div>
              <div className="provider-risk"><AlertTriangle/> {option.risk}</div>
            </article>)}
          </div>
        </div> : <div className="advice-empty"><Plane/><p>Generate the cheapest safe provider route for this request: free flight status, manual hotels, NetJets handoff, Avinode later, and confirmation rules.</p></div>}
      </div>
      <div className="shortlist-panel">
        <div className="shortlist-head">
          <div><span><ListChecks/></span><div><h3>Agent support: top four options</h3><p>Ranked options with pursue links for manual operator checking and booking.</p></div></div>
          <button onClick={runAgentShortlist} disabled={shortlistLoading}>{shortlistLoading ? "Building…" : "Generate top four"}</button>
        </div>
        {shortlist ? <div className="shortlist-body">
          <div className="shortlist-summary">
            <div><strong>{shortlist.title}</strong><p>{shortlist.summary}</p></div>
            <time>{shortlist.generatedAt}</time>
          </div>
          <div className="shortlist-grid">
            {shortlist.options.map((option) => <article key={option.id} className="shortlist-card">
              <div className="shortlist-rank">#{option.rank}</div>
              <div className="shortlist-main">
                <div className="shortlist-card-top">
                  <div><small>{option.category}</small><h4>{option.name}</h4></div>
                  <span>{option.fitScore}% fit</span>
                </div>
                <p>{option.why}</p>
                <div className="shortlist-meta">
                  <b>{option.estimatedCost}</b>
                  {option.clientFit.slice(0, 3).map((fit) => <b key={fit}>{fit}</b>)}
                </div>
                <div className="shortlist-step"><Check/> {option.operatorStep}</div>
                <div className="shortlist-caveats">{option.caveats.map((caveat) => <span key={caveat}><AlertTriangle/> {caveat}</span>)}</div>
                <div className="shortlist-actions">
                  <a href={option.pursueUrl} target="_blank" rel="noreferrer"><ExternalLink/> {option.linkLabel}</a>
                  <button onClick={() => useShortlistInDraft(option)}>Use in draft</button>
                </div>
              </div>
            </article>)}
          </div>
          <div className="shortlist-footer">
            <button onClick={() => useShortlistInDraft()}>Add all four to draft</button>
            <span>Operator must manually verify live availability, price and terms before booking.</span>
          </div>
        </div> : <div className="advice-empty"><ListChecks/><p>Generate a ranked top-four shortlist with links the operator can open to check hotels, flights, restaurants, aviation or suppliers manually.</p></div>}
      </div>
      <div className="scrape-panel">
        <div className="scrape-head">
          <div><span><Globe2/></span><div><h3>Automatic live-site research</h3><p>Agent identifies necessary web checks, runs public-signal scraping, then flags manual confirmations.</p></div></div>
          <button onClick={startScrapeResearch} disabled={autoScraping}>{autoScraping ? "Auto-scraping…" : scrapeRun ? "Re-run automatic scrape" : "Auto-identify & scrape"}</button>
        </div>
        {scrapeRun ? <div className="scrape-body">
          <div className="scrape-warning">
            <AlertTriangle/>
            <div><strong>{scrapeRun.title}</strong><p>{scrapeRun.summary}</p><em>{scrapeRun.complianceNote}</em></div>
          </div>
          <div className="scrape-targets">
            {scrapeRun.targets.map((target) => {
              const evidence = scrapeEvidence[target.id] || blankEvidence(target.id);
              const liveResult = liveScrapeResults[target.id];
              return <article key={target.id} className="scrape-card">
                <div className="scrape-card-head">
                  <div><small>{target.kind.replace("_", " ")}</small><h4>{target.priority}. {target.name}</h4></div>
                  <a href={target.url} target="_blank" rel="noreferrer"><ExternalLink/> Open site</a>
                </div>
                <div className={`scrape-status ${evidence.automationStatus}`}>
                  {evidence.automationStatus === "captured_signal" && <><Check/> Auto signal captured</>}
                  {evidence.automationStatus === "manual_verification" && <><AlertTriangle/> Manual verification required</>}
                  {evidence.automationStatus === "blocked" && <><AlertTriangle/> Blocked for automation</>}
                  {evidence.automationStatus === "not_run" && <><Clock3/> Awaiting automatic pass</>}
                </div>
                {liveResult && <div className={`live-scrape-result ${liveResult.status}`}>
                  <strong>{liveResult.status === "reachable" ? "Live check reachable" : liveResult.status === "blocked" ? "Live check blocked/protected" : "Live check error"}</strong>
                  <span>{liveResult.httpStatus ? `HTTP ${liveResult.httpStatus} · ` : ""}{liveResult.note}</span>
                  {liveResult.pageTitle && <span>Title: {liveResult.pageTitle}</span>}
                  {!!liveResult.priceSignals?.length && <span>Prices: {liveResult.priceSignals.join(" · ")}</span>}
                  {!!liveResult.availabilitySignals?.length && <span>Availability text: {liveResult.availabilitySignals.join(" · ")}</span>}
                  {!!liveResult.operatorData?.length && <span>Useful operator data: {liveResult.operatorData.join(" · ")}</span>}
                  <time>{liveResult.checkedAt}</time>
                </div>}
                <p>{target.operatorInstruction}</p>
                <div className="scrape-capture-list">{target.dataToCapture.map((item) => <span key={item}>{item}</span>)}</div>
                <div className="scrape-fields">
                  <label>Observed availability<input value={evidence.observedAvailability} onChange={(event) => updateScrapeEvidence(target.id, { observedAvailability: event.target.value })} placeholder="e.g. Business seats available / 2 suites left"/></label>
                  <label>Observed price<input value={evidence.observedPrice} onChange={(event) => updateScrapeEvidence(target.id, { observedPrice: event.target.value })} placeholder="e.g. £2,840 / £1,120 per night"/></label>
                  <label>Notes<textarea value={evidence.notes} onChange={(event) => updateScrapeEvidence(target.id, { notes: event.target.value })} placeholder="Fare family, conditions, screenshots taken, supplier caveats..."/></label>
                </div>
                <div className="scrape-risk"><AlertTriangle/> {target.risk}</div>
              </article>;
            })}
          </div>
          <div className="scrape-footer">
            <button onClick={addScrapeEvidenceToDraft}>Add scraped observations to draft</button>
            <button onClick={runLiveScrapeCheck} disabled={liveChecking}>{liveChecking ? "Checking live targets…" : "Extract live signals"}</button>
            <span>All observations remain unconfirmed until the operator checks price, availability and terms manually.</span>
          </div>
        </div> : <div className="advice-empty"><Globe2/><p>Run an automatic research pass. The agent decides which public airline, hotel or supplier checks are needed, captures safe signals, and marks anything requiring manual confirmation.</p></div>}
      </div>
      <div className="booking-panel">
        <div className="booking-head">
          <div><span className="provider-badge">7R</span><div><h3>Booking integration route</h3><p>Adapter-ready SevenRooms availability check with human approval before commitment</p></div></div>
          <button onClick={checkSevenRoomsAvailability} disabled={checkingProvider}>{checkingProvider ? "Checking…" : "Check SevenRooms availability"}</button>
        </div>
        {options.length > 0 && <div className="booking-options">
          {options.map((option) => <button key={option.id} onClick={() => setSelectedOptionId(option.id)} className={selectedOptionId === option.id ? "selected" : ""}>
            <div><strong>{option.venueName}</strong><span>{option.fitScore}% fit</span></div>
            <p>{option.neighborhood} · {option.date} · {option.time} · {option.partySize} guests</p>
            <small>{option.operatorNote}</small>
          </button>)}
        </div>}
        {selectedOption && <div className="booking-detail">
          <div className="booking-detail-grid">
            <div><small>POLICY</small><b>{selectedOption.cancellationPolicy}</b></div>
            <div><small>COMMITMENT</small><b>{selectedOption.paymentRequired ? "Payment guarantee" : selectedOption.requiresApproval ? "Approval required" : "No payment hold"}</b></div>
          </div>
          <div className="booking-notes">{selectedOption.guestNotes.map((note) => <span key={note}><Check/> {note}</span>)}</div>
          <button onClick={() => stageBooking(selectedOption)}>{selectedOption.paymentRequired || selectedOption.requiresApproval ? "Stage for approval" : "Stage recommendation"}</button>
        </div>}
      </div>
      <div className="booking-panel flight-search-panel">
        <div className="booking-head">
          <div><span className="provider-badge"><Plane/></span><div><h3>Live flight research</h3><p>Nuitee sandbox · operator research only · no ticketing or payment</p></div></div>
          <button onClick={searchNuiteeFlights} disabled={flightSearching || !selected.serverId || !capabilities?.flight_search}>{flightSearching ? "Searching…" : "Search flights"}</button>
        </div>
        <div className="flight-search-fields">
          <label>From (IATA)<input value={flightSearch.origin} maxLength={3} onChange={(event) => updateFlightSearch("origin", event.target.value.toUpperCase())} placeholder="LHR"/></label>
          <label>To (IATA)<input value={flightSearch.destination} maxLength={3} onChange={(event) => updateFlightSearch("destination", event.target.value.toUpperCase())} placeholder="JFK"/></label>
          <label>Outbound<input type="date" value={flightSearch.outboundDate} onChange={(event) => updateFlightSearch("outboundDate", event.target.value)}/></label>
          <label>Return <span>optional</span><input type="date" min={flightSearch.outboundDate || undefined} value={flightSearch.returnDate} onChange={(event) => updateFlightSearch("returnDate", event.target.value)}/></label>
          <label>Adults<select value={flightSearch.adults} onChange={(event) => updateFlightSearch("adults", Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
        </div>
        {!selected.serverId && <p className="flight-search-note"><ShieldCheck/> Flight research is available once this request is saved to the live service.</p>}
        {selected.serverId && !capabilities?.flight_search && <p className="flight-search-note"><AlertTriangle/> Nuitee flight search is not currently configured for this operator account.</p>}
        {flightOffers.length > 0 && <div className="booking-options flight-options">{flightOffers.map((offer) => <article key={offer.offer_id}>
          <div><strong>{offer.itinerary}</strong><span>{offer.refundable === true ? "Refundable" : offer.refundable === false ? "Terms restricted" : "Terms to confirm"}</span></div>
          <p>{offer.currency} {offer.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <small>Nuitee research result. An operator must verify the fare and secure client approval before any booking step.</small>
        </article>)}</div>}
      </div>
      <div className="ai-panel">
        <div className="ai-head">
          <div><span><Sparkles/></span><div><h3>Suggested response</h3><p>Grounded in profile and request context</p></div></div>
          <div className="rating"><button onClick={() => act("Marked useful")}><ThumbsUp/></button><button onClick={() => act("Marked for rewrite")}><ThumbsDown/></button></div>
        </div>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)}/>
        <div className="ai-reason"><strong>WHY THIS DRAFT</strong>{selected.rationale.map((item) => <span key={item}><Check/> {item}</span>)}</div>
        <div className="draft-actions"><button onClick={saveDraft}>Save draft</button><button className="send" onClick={reviewSend}><Send/>Review & send</button></div>
      </div>
    </section>

    <aside className="context-panel">
      <div className="context-head"><h3>Client context</h3><button><X/></button></div>
      <div className="profile-mini"><div className="avatar lg">{selected.initials}</div><h3>{selected.client}</h3><span>{selected.tier}</span><button onClick={() => act("Profile panel placeholder")}>Open full profile</button></div>
      <div className="context-section intelligence-actions"><small>CLIENT DATA REPOSITORY</small><button onClick={learnSelectedRequest}><Database/> Learn from this request</button><p>{profile?.summary || "Learning profile from request history."}</p></div>
      <div className="context-section"><small>FAMILY & HOUSEHOLD</small><div className="memory-list">{(profile?.household.length ? profile.household : ["No family facts learned yet"]).map((item) => <span key={item}><Users/> {item}</span>)}</div></div>
      <div className="context-section"><small>TRAVELS WITH</small><div className="prefs">{(profile?.travelWith.length ? profile.travelWith : ["Unknown"]).map((item) => <span key={item}>{item}</span>)}</div></div>
      <div className="context-section"><small>KNOWN PREFERENCES</small><div className="prefs">{(profile?.preferences.length ? profile.preferences : []).slice(0, 6).map((item) => <span key={item.id}>{item.label}</span>)}</div></div>
      <div className="context-section"><small>LIFE & SERVICE STYLE</small><div className="memory-feed">{[...(profile?.life || []), ...(profile?.serviceStyle || []), ...(profile?.dietary || [])].slice(0, 5).map((signal) => <p key={signal.id}><b>{signal.label}</b><span>{signal.detail}</span><time>{signal.confidence}%</time></p>)}</div></div>
      <div className="context-section"><small>APPROVAL CONTROL</small><div className="approval-box"><CircleDollarSign/><div><strong>{selected.status === "awaiting_approval" ? "Human approval required" : `Workflow: ${statusLabel(selected.status as RequestStatus)}`}</strong><p>{selected.rationale.at(-1)}</p></div></div>
        {selected.status === "awaiting_approval" && <div className="approval-actions"><button onClick={returnToOperator}>Return</button><button className="approve" onClick={approve}><Check/>Approve</button></div>}
        {selected.status === "approved" && <div className="approved-note"><Check/> Approved by you just now</div>}
      </div>
      <div className="context-section audit"><small>RECENT ACTIVITY</small><p><i/>AI triage completed <time>2 min</time></p><p><i/>Request received <time>{selected.received}</time></p></div>
    </aside>
    {toast && <div className="toast"><Check/>{toast}</div>}
  </div>;
}

type LiveClientMemory = {
  id: string; full_name: string; tier: string; timezone: string; onboarding_completed_at: string | null;
  household_notes: string | null;
  preferences: { id?: string; category: string; statement: string; confidence: number; source_type?: string; source_reference?: string | null; status?: string }[];
};

type LiveRequest = {
  id: string; reference: string; client_name: string | null; client_initials: string | null; client_tier: string | null;
  title: string; message: string | null; category: string; urgency: "urgent" | "high" | "normal";
  status: RequestStatus; channel: string | null; created_at: string | null; budget_amount: number | null;
  currency: string; ai_confidence: number | null; ai_draft: string | null; owner: string | null; ai_reasons: string[];
};

function liveRequestItem(item: LiveRequest): RequestItem {
  return {
    id: item.reference, serverId: item.id, client: item.client_name || "Unknown client", initials: item.client_initials || "VP",
    tier: item.client_tier || "Private", title: item.title, message: item.message || item.title,
    category: item.category, urgency: item.urgency, status: item.status,
    channel: item.channel || "Web", received: item.created_at ? new Date(item.created_at).toLocaleString() : "Recently",
    budget: item.budget_amount == null ? "To qualify" : `${item.currency} ${Number(item.budget_amount).toLocaleString()}`,
    confidence: Math.round((item.ai_confidence || 0) * 100), owner: item.owner || "Unassigned",
    tags: ["Live request", item.category], draft: item.ai_draft || "Request received for human review.",
    rationale: item.ai_reasons.length ? item.ai_reasons : ["Human review required before any external commitment"],
  };
}

function liveClientProfile(client: LiveClientMemory): ClientProfile {
  const signals = client.preferences.map((item, index) => ({
    id: item.id || `${client.id}-${index}`,
    label: item.category.replace("onboarding:", "").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()),
    detail: item.statement,
    confidence: Math.round(item.confidence * 100),
    source: item.source_type === "questionnaire" ? "Client questionnaire" : item.source_type === "client_feedback" ? "Client feedback" : item.source_type === "employee_note" ? `Vector note${item.source_reference ? ` · ${item.source_reference}` : ""}` : `Service usage${item.source_reference ? ` · ${item.source_reference}` : ""}`,
    status: item.status === "confirmed" ? "confirmed" as const : "inferred" as const,
    category: item.category,
  }));
  const by = (...categories: string[]) => signals.filter((item) => categories.includes(item.category)).map(({ category: _category, ...item }) => item);
  return {
    serverId: client.id,
    name: client.full_name,
    initials: client.full_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    tier: client.tier, location: client.timezone.replace("_", " "), spend: "Live member",
    summary: "Live preference memory from questionnaire, service activity and confirmed feedback.",
    household: client.household_notes ? [client.household_notes] : [], travelWith: client.household_notes ? [client.household_notes] : [],
    preferences: by("onboarding:travel_style", "onboarding:hotel_style", "onboarding:flight_preferences", "general", "travel_atmosphere", "hotel_style", "hotel_room", "flight_seat", "transport"),
    dietary: by("onboarding:dietary_requirements", "onboarding:accessibility_requirements", "dietary", "accessibility"),
    serviceStyle: by("onboarding:service_style", "service_style"),
    life: by("onboarding:important_dates", "onboarding:anything_else", "onboarding:interests", "interest", "feedback_note"),
    recentSignals: signals.slice(-8).reverse().map(({ category: _category, ...item }) => item),
  };
}

export default function RequestsPage() {
  return <Suspense><InboxView/></Suspense>;
}
