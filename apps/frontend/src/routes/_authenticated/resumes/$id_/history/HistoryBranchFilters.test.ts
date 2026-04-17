import { describe, it, expect } from "vitest";
import { filterBranches } from "./HistoryBranchFilters";
import type { GraphBranch } from "./history-graph-utils";

function branch(overrides: Partial<GraphBranch>): GraphBranch {
  return {
    id: "b1",
    resumeId: "r1",
    name: "main",
    isMain: false,
    isArchived: false,
    headCommitId: "c1",
    forkedFromCommitId: null,
    createdBy: null,
    createdAt: new Date("2026-01-01"),
    branchType: "variant",
    sourceBranchId: null,
    sourceCommitId: null,
    ...overrides,
  } as GraphBranch;
}

const VARIANT_A = branch({ id: "v1", name: "main", branchType: "variant", headCommitId: "c1" });
const VARIANT_B = branch({ id: "v2", name: "lead", branchType: "variant", headCommitId: "c2" });
const REVISION = branch({ id: "r1", name: "draft", branchType: "revision", headCommitId: "c3" });
const ARCHIVED = branch({ id: "a1", name: "old", branchType: "variant", headCommitId: "c4", isArchived: true });

const ALL_BRANCHES = [VARIANT_A, VARIANT_B, REVISION, ARCHIVED];

describe("filterBranches — tag-based semantics", () => {
  it("returns all non-archived branches when no filter is active", () => {
    const result = filterBranches({
      branches: ALL_BRANCHES,
      activeFilters: new Set(),
      showArchived: false,
      taggedBranchIds: new Set(),
    });
    expect(result.map((b) => b.id)).toEqual(["v1", "v2", "r1"]);
  });

  it("includes archived branches when showArchived is true", () => {
    const result = filterBranches({
      branches: ALL_BRANCHES,
      activeFilters: new Set(),
      showArchived: true,
      taggedBranchIds: new Set(),
    });
    expect(result.map((b) => b.id)).toContain("a1");
  });

  it("'translation' filter alone shows only branches that have cross-language tags", () => {
    const result = filterBranches({
      branches: ALL_BRANCHES,
      activeFilters: new Set(["translation"]),
      showArchived: false,
      taggedBranchIds: new Set(["v1"]),
    });
    expect(result.map((b) => b.id)).toEqual(["v1"]);
  });

  it("'variant' filter excludes revisions", () => {
    const result = filterBranches({
      branches: ALL_BRANCHES,
      activeFilters: new Set(["variant"]),
      showArchived: false,
      taggedBranchIds: new Set(),
    });
    expect(result.map((b) => b.id)).toEqual(["v1", "v2"]);
  });

  it("'revision' filter excludes variants", () => {
    const result = filterBranches({
      branches: ALL_BRANCHES,
      activeFilters: new Set(["revision"]),
      showArchived: false,
      taggedBranchIds: new Set(),
    });
    expect(result.map((b) => b.id)).toEqual(["r1"]);
  });
});
