import { describe, expect, it } from "vitest";

import { buildChatGPTResearchBrief, sanitizeForExternalResearch } from "./chatgptResearch";
import type { RequestItem } from "./data";

describe("ChatGPT research handoff", () => {
  it("removes common contact and account identifiers", () => {
    const result = sanitizeForExternalResearch("Email jane@example.com, call +44 7700 900123, passport number 123456789");
    expect(result).not.toContain("jane@example.com");
    expect(result).not.toContain("7700");
    expect(result).not.toContain("123456789");
  });

  it("creates a research-only brief without the client name", () => {
    const request: RequestItem = {
      id: "VEC-2001", client: "Jane Example", initials: "JE", tier: "Private",
      title: "London to Paris", message: "Two business seats from London to Paris next Friday.",
      category: "Travel", urgency: "normal", status: "new", channel: "Web", received: "Now",
      budget: "£2,000", confidence: 80, owner: "Operator", tags: ["Business"], draft: "", rationale: [],
    };
    const brief = buildChatGPTResearchBrief(request);
    expect(brief).toContain("VEC-2001");
    expect(brief).toContain("Do not book");
    expect(brief).not.toContain("Jane Example");
  });
});
