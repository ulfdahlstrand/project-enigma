import { describe, expect, it } from "vitest";
import {
  deriveNextActionOrchestrationMessage,
} from "./action-orchestration.js";

describe("deriveNextActionOrchestrationMessage", () => {
  it("returns automation for the next pending work item", () => {
    const result = deriveNextActionOrchestrationMessage([
      {
        role: "assistant",
        content:
          '```json\n{"type":"tool_call","toolName":"set_revision_work_items","input":{"summary":"Review","items":[{"id":"work-item-1","title":"Review presentation","description":"Check presentation","section":"presentation","status":"pending"}]}}\n```',
      },
    ]);

    expect(result).toMatchObject({ kind: "automation" });
    expect(result?.content).toContain("[[internal_autostart]]");
    expect(result?.content).toContain("Process only this work item now: work-item-1.");
  });

  it("returns guardrail if the same automation message was already the latest user message", () => {
    const result = deriveNextActionOrchestrationMessage([
      {
        role: "assistant",
        content:
          '```json\n{"type":"tool_call","toolName":"set_revision_work_items","input":{"summary":"Review","items":[{"id":"work-item-1","title":"Review presentation","description":"Check presentation","section":"presentation","status":"pending"}]}}\n```',
      },
      {
        role: "user",
        content:
          '[[internal_autostart]] Process only this work item now: work-item-1. Title: Review presentation. Description: Check presentation. Inspect the exact source text for section presentation and decide the outcome for this work item only. If changes are needed, create suggestions for this work item. If no changes are needed, mark this work item as no changes needed. Do not revisit completed work items. Return a tool call now.',
      },
    ]);

    expect(result).toMatchObject({ kind: "guardrail" });
    expect(result?.content).toContain("[[internal_guardrail]]");
  });

  it("returns null when all work items are already resolved", () => {
    const result = deriveNextActionOrchestrationMessage([
      {
        role: "assistant",
        content:
          '```json\n{"type":"tool_call","toolName":"set_revision_work_items","input":{"summary":"Review","items":[{"id":"work-item-1","title":"Review presentation","description":"Check presentation","section":"presentation","status":"pending"}]}}\n```',
      },
      {
        role: "assistant",
        content:
          '```json\n{"type":"tool_call","toolName":"mark_revision_work_item_no_changes_needed","input":{"workItemId":"work-item-1","note":"No changes needed."}}\n```',
      },
    ]);

    expect(result).toBeNull();
  });

  it("expands a broad assignment work item into explicit assignment work items", () => {
    const result = deriveNextActionOrchestrationMessage([
      {
        role: "assistant",
        content:
          '```json\n{"type":"tool_call","toolName":"set_revision_work_items","input":{"summary":"Review assignments","items":[{"id":"work-item-1","title":"Review assignments","description":"Check all assignments","section":"assignment","status":"pending"}]}}\n```',
      },
    ]);

    expect(result).toMatchObject({ kind: "automation" });
    expect(result?.content).toContain("list_resume_assignments");
    expect(result?.content).toContain("set_revision_work_items");
  });
});

