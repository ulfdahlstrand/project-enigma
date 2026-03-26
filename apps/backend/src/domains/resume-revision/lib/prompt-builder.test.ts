import { describe, it, expect } from "vitest";
import {
  buildRevisionPrompt,
  extractProposalFromResponse,
  isProposalTriggerMessage,
  PROPOSAL_DELIMITER,
} from "./prompt-builder.js";
import type { BuildPromptParams } from "./prompt-builder.js";
import type { ResumeRevisionDiscoveryOutput } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DISCOVERY_OUTPUT: ResumeRevisionDiscoveryOutput = {
  targetRole: "CTO",
  tone: "leadership-focused",
  strengthsToEmphasise: ["team leadership", "architecture"],
  thingsToDownplay: ["low-level coding"],
  languagePreferences: "concise",
  additionalNotes: "Focus on impact",
  conversationSummary: "The CV should lean into a playful April Fools framing while still keeping the structure readable.",
};

function makeParams(overrides: Partial<BuildPromptParams> = {}): BuildPromptParams {
  return {
    section: "skills",
    sectionDetail: null,
    discovery: DISCOVERY_OUTPUT,
    originalContent: { skills: [] },
    fullCvContent: null,
    consultantProfile: { name: "Anna", title: "Tech Lead", presentation: null },
    conversationHistory: [],
    userMessage: "Please revise my skills",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildRevisionPrompt
// ---------------------------------------------------------------------------

describe("buildRevisionPrompt", () => {
  it("uses the discovery system prompt for the discovery section", () => {
    const result = buildRevisionPrompt(makeParams({ section: "discovery", discovery: null }));
    expect(result.system).toContain("consultation");
  });

  it("includes discovery goals in the system prompt for content sections", () => {
    const result = buildRevisionPrompt(makeParams({ section: "skills" }));
    expect(result.system).toContain(DISCOVERY_OUTPUT.targetRole);
    expect(result.system).toContain(DISCOVERY_OUTPUT.tone);
    expect(result.system).toContain(DISCOVERY_OUTPUT.conversationSummary ?? "");
  });

  it("tolerates incomplete discovery output in content prompts", () => {
    const result = buildRevisionPrompt(
      makeParams({
        section: "consultant_title",
        discovery: {
          targetRole: "CTO",
          tone: "leadership-focused",
          strengthsToEmphasise: undefined as unknown as string[],
          thingsToDownplay: undefined as unknown as string[],
          languagePreferences: "concise",
          additionalNotes: "",
        },
      })
    );

    expect(result.system).toContain("Strengths to emphasise: None specified");
    expect(result.system).toContain("Things to downplay: None specified");
    expect(result.system).toContain("Conversation summary: No summary provided");
  });

  it("passes the userMessage through unchanged", () => {
    const result = buildRevisionPrompt(makeParams({ userMessage: "Hello AI" }));
    expect(result.userMessage).toBe("Hello AI");
  });

  it("caps conversation history at 20 entries", () => {
    const longHistory = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i}`,
    }));
    const result = buildRevisionPrompt(makeParams({ conversationHistory: longHistory }));
    expect(result.history).toHaveLength(20);
  });

  it("keeps the most recent 20 entries when capping history", () => {
    const longHistory = Array.from({ length: 25 }, (_, i) => ({
      role: "user" as "user" | "assistant",
      content: `Message ${i}`,
    }));
    const result = buildRevisionPrompt(makeParams({ conversationHistory: longHistory }));
    expect(result.history[0].content).toBe("Message 5");
    expect(result.history[19].content).toBe("Message 24");
  });

  it("passes history through unchanged when under the cap", () => {
    const shortHistory = [
      { role: "user" as const, content: "Hi" },
      { role: "assistant" as const, content: "Hello" },
    ];
    const result = buildRevisionPrompt(makeParams({ conversationHistory: shortHistory }));
    expect(result.history).toHaveLength(2);
  });

  it("includes the PROPOSAL_DELIMITER instruction in content section system prompt", () => {
    const result = buildRevisionPrompt(makeParams({ section: "consultant_title" }));
    expect(result.system).toContain(PROPOSAL_DELIMITER);
  });

  it("forces a discovery proposal when forceProposal is true", () => {
    const result = buildRevisionPrompt(
      makeParams({
        section: "discovery",
        discovery: null,
        userMessage: "Bra, nu kör vi",
        forceProposal: true,
      })
    );

    expect(result.system).toContain("produce the structured discovery proposal immediately");
    expect(result.system).toContain("Do not ask any more questions");
  });

  it("forces a content proposal when forceProposal is true", () => {
    const result = buildRevisionPrompt(
      makeParams({
        section: "skills",
        userMessage: "kör på",
        forceProposal: true,
      })
    );

    expect(result.system).toContain("produce the proposal immediately");
    expect(result.system).toContain("Do not ask more questions");
  });
});

describe("isProposalTriggerMessage", () => {
  it("detects short confirmation messages", () => {
    expect(isProposalTriggerMessage("ja")).toBe(true);
    expect(isProposalTriggerMessage("Looks good")).toBe(true);
    expect(isProposalTriggerMessage("kör på")).toBe(true);
  });

  it("detects longer Swedish confirmation messages", () => {
    expect(isProposalTriggerMessage("bra. nu vill jag använda detta som input till alla andra kommande steg. låt oss börja")).toBe(true);
    expect(isProposalTriggerMessage("nu kör vi")).toBe(true);
  });

  it("does not treat ordinary discussion as a proposal trigger", () => {
    expect(isProposalTriggerMessage("Jag vill betona mer ledarskap och tona ned hands-on kodning.")).toBe(false);
    expect(isProposalTriggerMessage("Kan du ställa fler frågor om målroll först?")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractProposalFromResponse
// ---------------------------------------------------------------------------

describe("extractProposalFromResponse", () => {
  it("returns null when the delimiter is not present", () => {
    const result = extractProposalFromResponse("Just a plain response with no proposal.");
    expect(result).toBeNull();
  });

  it("returns parsed JSON and text part when delimiter is present", () => {
    const proposal = { proposedContent: { consultantTitle: "CTO" }, reasoning: "test" };
    const response = `Here is my thinking.\n${PROPOSAL_DELIMITER}\n${JSON.stringify(proposal)}`;
    const result = extractProposalFromResponse(response);
    expect(result).not.toBeNull();
    expect(result?.textPart).toBe("Here is my thinking.");
    expect(result?.proposalJson).toEqual(proposal);
  });

  it("returns null when JSON after the delimiter is invalid", () => {
    const response = `Some text\n${PROPOSAL_DELIMITER}\n{ invalid json `;
    const result = extractProposalFromResponse(response);
    expect(result).toBeNull();
  });

  it("returns an empty textPart when the delimiter appears at the start", () => {
    const proposal = { proposedContent: {}, reasoning: "" };
    const response = `${PROPOSAL_DELIMITER}\n${JSON.stringify(proposal)}`;
    const result = extractProposalFromResponse(response);
    expect(result?.textPart).toBe("");
  });
});
