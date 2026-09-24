import { NextRequest, NextResponse } from "next/server";

type LiveScrapeTarget = {
  id: string;
  name: string;
  url: string;
};

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

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({ targets: [] }));
  const targets = Array.isArray(body.targets) ? body.targets.slice(0, 8) as LiveScrapeTarget[] : [];

  const results = await Promise.all(targets.map(checkTarget));

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    results,
    warning: "This checks whether public target pages are reachable from the app server. It does not bypass CAPTCHA/login/payment and does not confirm bookable availability.",
  });
}

async function checkTarget(target: LiveScrapeTarget): Promise<LiveScrapeResult> {
  const checkedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);

  try {
    const response = await fetch(target.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "VectorPriveResearchBot/0.1 (+operator-assisted concierge research)",
      },
    });

    const contentType = response.headers.get("content-type");
    const blockedStatuses = [401, 403, 407, 418, 429, 451, 503];
    const isBlocked = blockedStatuses.includes(response.status);

    if (isBlocked) {
      return {
        id: target.id,
        name: target.name,
        url: target.url,
        status: "blocked",
        httpStatus: response.status,
        contentType,
        checkedAt,
        operatorData: operatorDataForTarget(target),
        extractionQuality: "protected_or_blocked",
        note: "Target responded but appears blocked/rate-limited/protected. Use manual operator check in browser.",
      };
    }

    const extraction = contentType?.includes("text/html") || contentType?.includes("text/plain")
      ? extractSignals(await response.text())
      : {
        pageTitle: undefined,
        priceSignals: [],
        availabilitySignals: [],
        snippet: `Non-HTML response: ${contentType || "unknown content type"}`,
      };

    return {
      id: target.id,
      name: target.name,
      url: target.url,
      status: "reachable",
      httpStatus: response.status,
      contentType,
      ...extraction,
      operatorData: operatorDataForTarget(target),
      extractionQuality: extraction.priceSignals.length || extraction.availabilitySignals.length ? "useful_public_text" : "reachable_no_public_fares",
      checkedAt,
      note: extraction.priceSignals.length || extraction.availabilitySignals.length
        ? "Live page reached and public text signals extracted. Operator must still verify live bookability, fare expiry and terms manually."
        : "Live page reached, but no useful public price/availability text was extractable. This often means the page is JavaScript/session/CAPTCHA protected.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    return {
      id: target.id,
      name: target.name,
      url: target.url,
      status: "error",
      checkedAt,
      operatorData: operatorDataForTarget(target),
      extractionQuality: "error",
      note: message.includes("abort") ? "Timed out checking target. Use manual operator check." : `Could not check target: ${message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractSignals(html: string) {
  const text = htmlToText(html).slice(0, 50000);
  const pageTitle = extractTitle(html);
  const priceSignals = uniqueMatches(text.match(/(?:£|\$|€)\s?\d[\d,]*(?:\.\d{2})?|(?:GBP|USD|EUR|AED)\s?\d[\d,]*(?:\.\d{2})?/gi), 8);
  const availabilitySignals = uniqueMatches(text.match(/\b(?:available|availability|sold out|unavailable|no flights|select flights|choose flights|seats? available|rooms? available|only \d+ left|from\s+(?:£|\$|€)\s?\d[\d,]*)\b.{0,90}/gi), 8);
  const snippet = compactWhitespace(text).slice(0, 420);

  return {
    pageTitle,
    priceSignals,
    availabilitySignals,
    snippet,
  };
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(compactWhitespace(match[1])).slice(0, 160) : undefined;
}

function htmlToText(html: string) {
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " "));
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&pound;/g, "£")
    .replace(/&euro;/g, "€")
    .replace(/&dollar;/g, "$")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function uniqueMatches(matches: RegExpMatchArray | null, limit: number) {
  return [...new Set((matches || []).map((match) => compactWhitespace(match)))].slice(0, limit);
}

function operatorDataForTarget(target: LiveScrapeTarget) {
  const name = target.name.toLowerCase();

  if (name.includes("google")) {
    return [
      "Use as broad market sweep: compare direct/non-stop, one-stop, business/first cabin, total journey time and price expiry.",
      "Useful fields to capture manually: airline, cabin, fare, departure time, arrival time, connection duration, bags, cancellation terms.",
      "If Google Travel exposes only a JavaScript shell, open the link in browser and use visible results as operator research only.",
    ];
  }

  if (name.includes("british")) {
    return [
      "British Airways check: confirm BA flight status or premium cabin fare directly on BA before quoting.",
      "Capture: flight number, Club/First availability, fare family, baggage, seat selection, change/cancel rules and payment deadline.",
      "Do not rely on server scrape for BA booking pages; they are commonly session-protected.",
    ];
  }

  if (name.includes("emirates")) {
    return [
      "Emirates check: useful for premium long-haul options, Dubai connections, chauffeur-drive eligibility and cabin quality.",
      "Capture: Business/First fare, connection time, fare brand, chauffeur-drive notes, baggage and cancellation terms.",
      "Manual verification required before presenting fare because booking search is dynamic.",
    ];
  }

  if (name.includes("etihad")) {
    return [
      "Etihad check: useful for Abu Dhabi connections, premium cabin availability and Middle East/Asia routing.",
      "Capture: Business/First fare, fare family, connection time, baggage, change/cancel rules and lounge/transfer notes.",
      "Manual verification required because fares vary by market/session.",
    ];
  }

  if (name.includes("american")) {
    return [
      "American Airlines check: useful for US, transatlantic and oneworld routing.",
      "Capture: cabin, fare, flight number, connection point, fare class, bags, seat availability and refund/change terms.",
      "Reprice before booking; AA visible results can shift by session.",
    ];
  }

  if (name.includes("united")) {
    return [
      "United check: useful for US and Star Alliance routing.",
      "Capture: Polaris/business availability, fare, flight number, connection point, fare class and change/cancel terms.",
      "Re-check manually before client response because United results are session and availability dependent.",
    ];
  }

  if (name.includes("hotel") || name.includes("aman") || name.includes("four seasons") || name.includes("booking")) {
    return [
      "Hotel check: capture room/suite type, nightly rate, taxes/fees, cancellation policy and whether dates are continuous.",
      "For HNW clients, also verify room position, connecting rooms, VIP amenities and upgrade path manually.",
      "Public scrape is a rate signal only; direct hotel or preferred-partner confirmation is required.",
    ];
  }

  return [
    "Use this target for discovery only.",
    "Capture visible price, availability, supplier contact, cancellation terms and timestamp.",
    "Operator must manually verify before client response or booking.",
  ];
}
