import { describe, it, expect } from "vitest";
import {
  extractJsonBlocks,
  extractToolCalls,
  buildToolResultMessage,
} from "./tool-parsing.js";

describe("extractJsonBlocks", () => {
  it("extracts a single JSON block", () => {
    const text = 'Here is the result:\n```json\n{"type":"tool_call","toolName":"inspect_resume"}\n```';
    expect(extractJsonBlocks(text)).toEqual([{ type: "tool_call", toolName: "inspect_resume" }]);
  });

  it("returns empty array when no json blocks", () => {
    expect(extractJsonBlocks("No code blocks here.")).toEqual([]);
  });

  it("skips blocks with invalid JSON", () => {
    const text = "```json\n{invalid}\n```";
    expect(extractJsonBlocks(text)).toEqual([]);
  });

  it("extracts multiple blocks", () => {
    const text = [
      "First:\n```json\n{\"a\":1}\n```",
      "Second:\n```json\n{\"b\":2}\n```",
    ].join("\n");
    expect(extractJsonBlocks(text)).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe("extractToolCalls", () => {
  it("extracts a tool call with input", () => {
    const text =
      '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```';
    const result = extractToolCalls(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "tool_call",
      toolName: "inspect_resume",
      input: { includeAssignments: true },
    });
  });

  it("returns empty array for non-tool-call JSON blocks", () => {
    const text = '```json\n{"type":"suggestion","content":"foo"}\n```';
    expect(extractToolCalls(text)).toEqual([]);
  });

  it("returns empty array when there are no JSON blocks", () => {
    expect(extractToolCalls("Just some text.")).toEqual([]);
  });

  it("ignores blocks missing toolName", () => {
    const text = '```json\n{"type":"tool_call"}\n```';
    expect(extractToolCalls(text)).toEqual([]);
  });
});

describe("buildToolResultMessage", () => {
  it("builds a success message containing tool_result JSON block", () => {
    const msg = buildToolResultMessage("inspect_resume", { ok: true, output: { resumeId: "r1" } });
    expect(msg).toContain("```json");
    expect(msg).toContain('"type":"tool_result"');
    expect(msg).toContain('"toolName":"inspect_resume"');
    expect(msg).toContain('"ok":true');
    expect(msg).toContain('"resumeId":"r1"');
    expect(msg).toContain("Continue the conversation");
  });

  it("builds an error message when ok is false", () => {
    const msg = buildToolResultMessage("inspect_resume", { ok: false, error: "Branch not found" });
    expect(msg).toContain('"ok":false');
    expect(msg).toContain('"error":"Branch not found"');
  });

  it("truncates oversized output", () => {
    const largeOutput = { data: "x".repeat(10000) };
    const msg = buildToolResultMessage("inspect_resume", { ok: true, output: largeOutput });
    expect(msg.length).toBeLessThanOrEqual(10000);
  });
});
