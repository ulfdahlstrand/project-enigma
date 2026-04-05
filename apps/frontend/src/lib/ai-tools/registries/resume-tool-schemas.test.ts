import { describe, expect, it } from "vitest";
import { normalizeRevisionSuggestionsInput } from "./resume-tool-schemas";

describe("normalizeRevisionSuggestionsInput", () => {
  it("contextualizes generic assignment titles", () => {
    const result = normalizeRevisionSuggestionsInput({
      suggestions: [{
        id: "suggestion-1",
        title: "Fix spelling in assignment",
        description: "Correct spelling in the Payer assignment description.",
        section: "assignment",
        assignmentId: "assignment-1",
        suggestedText: "Corrected text",
        status: "pending",
      }],
    });

    expect(result.suggestions[0]?.title).toBe("Fix assignment: Payer");
  });

  it("preserves specific titles", () => {
    const result = normalizeRevisionSuggestionsInput({
      suggestions: [{
        id: "suggestion-1",
        title: "Fix spelling in Allicon assignment",
        description: "Correct a typo in the assignment text.",
        section: "assignment",
        assignmentId: "assignment-1",
        suggestedText: "Corrected text",
        status: "pending",
      }],
    });

    expect(result.suggestions[0]?.title).toBe("Fix spelling in Allicon assignment");
  });
});
