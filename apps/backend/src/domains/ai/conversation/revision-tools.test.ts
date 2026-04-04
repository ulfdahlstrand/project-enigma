import { describe, expect, it } from "vitest";
import { parseRevisionToolArguments } from "./revision-tools.js";

describe("parseRevisionToolArguments", () => {
  it("contextualizes generic assignment suggestion titles", () => {
    const parsed = parseRevisionToolArguments(
      "set_assignment_suggestions",
      JSON.stringify({
        workItemId: "work-item-1",
        suggestions: [{
          id: "suggestion-1",
          title: "Fix spelling in assignment",
          description: "Correct spelling in the Payer assignment description.",
          section: "assignment",
          assignmentId: "assignment-1",
          suggestedText: "Corrected text",
          status: "pending",
        }],
      }),
    ) as {
      suggestions: Array<{ title: string }>;
    };

    expect(parsed.suggestions[0]?.title).toBe("Fix assignment: Payer");
  });

  it("keeps specific suggestion titles unchanged", () => {
    const parsed = parseRevisionToolArguments(
      "set_revision_suggestions",
      JSON.stringify({
        suggestions: [{
          id: "suggestion-1",
          title: "Fix spelling in Allicon assignment",
          description: "Correct a typo in the assignment text.",
          section: "assignment",
          assignmentId: "assignment-1",
          suggestedText: "Corrected text",
          status: "pending",
        }],
      }),
    ) as {
      suggestions: Array<{ title: string }>;
    };

    expect(parsed.suggestions[0]?.title).toBe("Fix spelling in Allicon assignment");
  });
});
