import { describe, expect, it } from "vitest";
import { computeInlineGraphData } from "./history-inline-graph";
import type { GraphBranch, GraphCommit, GraphEdge } from "./history-graph-types";

function commit(id: string, parent: string | null, createdAt: string): GraphCommit {
  return {
    id,
    resumeId: "r1",
    parentCommitId: parent,
    title: id,
    description: "",
    createdBy: null,
    createdAt,
  } as unknown as GraphCommit;
}

function branch(
  id: string,
  name: string,
  head: string,
  createdAt: string,
  isMain = false,
  forkedFromCommitId: string | null = null,
): GraphBranch {
  return {
    id,
    resumeId: "r1",
    name,
    isMain,
    headCommitId: head,
    forkedFromCommitId,
    createdBy: null,
    createdAt,
    branchType: "variant",
    isArchived: false,
  } as unknown as GraphBranch;
}

describe("computeInlineGraphData", () => {
  it("attaches a fork L-curve to the fork-point (parent) commit pointing to the child lane", () => {
    // main:  C1 ← C2 ← C3
    //                      \
    // feat:                  C4 ← C5
    const commits = [
      commit("C1", null, "2026-01-01T10:00:00Z"),
      commit("C2", "C1", "2026-01-02T10:00:00Z"),
      commit("C3", "C2", "2026-01-03T10:00:00Z"),
      commit("C4", "C3", "2026-01-04T10:00:00Z"),
      commit("C5", "C4", "2026-01-05T10:00:00Z"),
    ];
    const branches = [
      branch("b-main", "main", "C3", "2026-01-01T00:00:00Z", true),
      branch("b-feat", "feat", "C5", "2026-01-03T12:00:00Z", false, "C3"),
    ];
    const edges: GraphEdge[] = [];

    const data = computeInlineGraphData(branches, commits, edges);

    // Fork curve lives on the PARENT (C3, fork-point), pointing to the child (feat) lane.
    const c3Row = data.rows.find((r) => r.commit.id === "C3");
    expect(c3Row).toBeDefined();
    expect(c3Row!.outgoingCurves.length).toBe(1);
    expect(c3Row!.outgoingCurves[0]!.targetLaneIndex).toBe(1); // feat lane
    expect(c3Row!.laneIndex).toBe(0); // main lane (C3 belongs to main)
  });

  it("attaches a merge L-curve to the merged-in parent commit pointing to the merge-commit lane", () => {
    // feat:         F1 ← F2 ─┐
    //                         \
    // main:  C1 ← C2 ────────── M  (M merges feat into main)
    const commits = [
      commit("C1", null, "2026-01-01T10:00:00Z"),
      commit("C2", "C1", "2026-01-02T10:00:00Z"),
      commit("F1", "C1", "2026-01-02T11:00:00Z"),
      commit("F2", "F1", "2026-01-03T10:00:00Z"),
      commit("M", "C2", "2026-01-04T10:00:00Z"),
    ];
    const branches = [
      branch("b-main", "main", "M", "2026-01-01T00:00:00Z", true),
      branch("b-feat", "feat", "F2", "2026-01-02T00:00:00Z", false, "C1"),
    ];
    const edges: GraphEdge[] = [
      { commitId: "M", parentCommitId: "C2", parentOrder: 0 },
      { commitId: "M", parentCommitId: "F2", parentOrder: 1 },
    ];

    const data = computeInlineGraphData(branches, commits, edges);

    // Merge curve lives on F2 (the merged-in parent), pointing to main (where M lives).
    const f2Row = data.rows.find((r) => r.commit.id === "F2");
    expect(f2Row).toBeDefined();
    expect(f2Row!.outgoingCurves.length).toBe(1);
    expect(f2Row!.outgoingCurves[0]!.targetLaneIndex).toBe(0); // main lane
    expect(f2Row!.laneIndex).toBe(1); // feat lane

    // M itself is still flagged as a merge commit.
    const mRow = data.rows.find((r) => r.commit.id === "M");
    expect(mRow!.isMerge).toBe(true);
  });
});
