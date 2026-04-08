import { describe, expect, it } from "vitest";
import {
  computeGraphLayout,
  getReachableCommitIds,
  shouldRenderBranchLane,
} from "./history-graph-utils.js";
import type { GraphBranch, GraphCommit, GraphEdge } from "./history-graph-utils.js";

function branch(
  overrides: Partial<GraphBranch> & Pick<GraphBranch, "id" | "createdAt">,
): GraphBranch {
  return {
    resumeId: "resume-1",
    name: overrides.id,
    language: "sv",
    isMain: false,
    headCommitId: null,
    forkedFromCommitId: null,
    createdBy: null,
    ...overrides,
  };
}

function commit(
  overrides: Partial<GraphCommit> & Pick<GraphCommit, "id" | "createdAt">,
): GraphCommit {
  return {
    parentCommitId: null,
    title: "",
    description: "",
    resumeId: "resume-1",
    createdBy: null,
    ...overrides,
  };
}

function edge(commitId: string, parentCommitId: string, parentOrder = 0): GraphEdge {
  return { commitId, parentCommitId, parentOrder };
}

describe("getReachableCommitIds", () => {
  it("returns all ancestors reachable from a merge head across branch boundaries", () => {
    const edges: GraphEdge[] = [
      edge("m3", "m2", 0),
      edge("m3", "s1", 1),
      edge("m2", "m1", 0),
      edge("s1", "m1", 0),
      edge("g1", "s1", 0),
    ];

    expect([...getReachableCommitIds("m3", edges)]).toEqual(["m3", "s1", "m1", "m2"]);
  });

  it("returns an empty set when the branch has no head commit", () => {
    expect([...getReachableCommitIds(null, [])]).toEqual([]);
  });
});

describe("shouldRenderBranchLane", () => {
  it("returns false for branches that do not yet have any commits", () => {
    expect(shouldRenderBranchLane([])).toBe(false);
  });

  it("returns true once a branch has at least one commit", () => {
    expect(
      shouldRenderBranchLane([
        commit({ id: "c1", createdAt: "2024-01-01T00:00:00Z" }),
      ]),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sibling ordering: merged before non-merged (closer to base branch)
// ---------------------------------------------------------------------------

describe("computeGraphLayout — column assignment", () => {
  /**
   * Merged siblings must get lower column numbers than non-merged siblings.
   *
   * Scenario:
   *   main ─── m1 ────────────────── m2 (merge commit)
   *                 \─ zxcv ─ z1 ─ z2 ─/  (MERGED into main)
   *                 \─ active ─ a1 ─ a2     (NOT merged, still open)
   *
   * zxcv.createdAt > active.createdAt  →  without fix, active (older) is
   * processed first and gets col 1, pushing zxcv (merged) to col 2.
   *
   * Expected after fix: main=0, zxcv=1 (merged, closer), active=2 (non-merged).
   */
  it("places a merged sibling in a lower column than a non-merged sibling", () => {
    const branches: GraphBranch[] = [
      branch({ id: "main",   isMain: true, headCommitId: "m2",  createdAt: "2024-01-01T00:00:00Z" }),
      // active was created BEFORE zxcv (older creation time)
      branch({ id: "active", headCommitId: "a2",  forkedFromCommitId: "m1", createdAt: "2024-01-02T00:00:00Z" }),
      branch({ id: "zxcv",   headCommitId: "z2",  forkedFromCommitId: "m1", createdAt: "2024-01-03T00:00:00Z" }),
    ];

    const commits: GraphCommit[] = [
      commit({ id: "m2", parentCommitId: "m1", createdAt: "2024-01-06T00:00:00Z" }),
      commit({ id: "a2", parentCommitId: "a1", createdAt: "2024-01-05T00:00:00Z" }),
      commit({ id: "z2", parentCommitId: "z1", createdAt: "2024-01-04T00:00:00Z" }),
      commit({ id: "a1", parentCommitId: "m1", createdAt: "2024-01-03T06:00:00Z" }),
      commit({ id: "z1", parentCommitId: "m1", createdAt: "2024-01-02T06:00:00Z" }),
      commit({ id: "m1", parentCommitId: null, createdAt: "2024-01-01T06:00:00Z" }),
    ];

    const edges: GraphEdge[] = [
      edge("m2", "m1", 0),
      edge("m2", "z2", 1), // zxcv merged into main
      edge("a2", "a1", 0),
      edge("a1", "m1", 0),
      edge("z2", "z1", 0),
      edge("z1", "m1", 0),
    ];

    const layout = computeGraphLayout(branches, commits, edges, false);

    expect(layout.branchIndexById.get("main")).toBe(0);
    expect(layout.branchIndexById.get("zxcv")).toBe(1);   // merged → closer to main
    expect(layout.branchIndexById.get("active")).toBe(2); // non-merged → further out
  });

  /**
   * Multiple merged siblings should all get lower columns than the non-merged one.
   */
  it("places multiple merged siblings before the non-merged sibling", () => {
    const branches: GraphBranch[] = [
      branch({ id: "main",   isMain: true, headCommitId: "m3",  createdAt: "2024-01-01T00:00:00Z" }),
      branch({ id: "merged1",headCommitId: "r1b", forkedFromCommitId: "m1", createdAt: "2024-01-02T00:00:00Z" }),
      branch({ id: "merged2",headCommitId: "r2b", forkedFromCommitId: "m1", createdAt: "2024-01-03T00:00:00Z" }),
      // non-merged created BEFORE both merged ones in this test (worst case)
      branch({ id: "active", headCommitId: "a2",  forkedFromCommitId: "m1", createdAt: "2024-01-01T12:00:00Z" }),
    ];

    const commits: GraphCommit[] = [
      commit({ id: "m3", parentCommitId: "m2", createdAt: "2024-01-09T00:00:00Z" }),
      commit({ id: "m2", parentCommitId: "m1", createdAt: "2024-01-08T00:00:00Z" }),
      commit({ id: "a2", parentCommitId: "a1", createdAt: "2024-01-07T00:00:00Z" }),
      commit({ id: "r2b", parentCommitId: "r2a", createdAt: "2024-01-06T00:00:00Z" }),
      commit({ id: "r1b", parentCommitId: "r1a", createdAt: "2024-01-05T00:00:00Z" }),
      commit({ id: "a1", parentCommitId: "m1", createdAt: "2024-01-04T06:00:00Z" }),
      commit({ id: "r2a", parentCommitId: "m1", createdAt: "2024-01-03T06:00:00Z" }),
      commit({ id: "r1a", parentCommitId: "m1", createdAt: "2024-01-02T06:00:00Z" }),
      commit({ id: "m1", parentCommitId: null, createdAt: "2024-01-01T06:00:00Z" }),
    ];

    const edges: GraphEdge[] = [
      edge("m3",  "m2",   0),
      edge("m3",  "r2b",  1),
      edge("m2",  "m1",   0),
      edge("m2",  "r1b",  1),
      edge("a2",  "a1",   0),
      edge("a1",  "m1",   0),
      edge("r2b", "r2a",  0),
      edge("r2a", "m1",   0),
      edge("r1b", "r1a",  0),
      edge("r1a", "m1",   0),
    ];

    const layout = computeGraphLayout(branches, commits, edges, false);

    const mainCol    = layout.branchIndexById.get("main")!;
    const activeCol  = layout.branchIndexById.get("active")!;
    const merged1Col = layout.branchIndexById.get("merged1")!;
    const merged2Col = layout.branchIndexById.get("merged2")!;

    expect(mainCol).toBe(0);
    expect(activeCol).toBeGreaterThan(merged1Col);
    expect(activeCol).toBeGreaterThan(merged2Col);
  });

  // ---------------------------------------------------------------------------
  // Same rule applies at deeper levels (grandchildren of main)
  // ---------------------------------------------------------------------------

  /**
   * Among children of a non-main branch (e.g. ZXCV), merged revisions are
   * still placed before the non-merged active revision.
   * The non-merged current revision is at the same column as the lila (purple)
   * branch, or one level further out — never forced to a lower column.
   *
   * Scenario:
   *   main → zxcv (merged into main)
   *             ├─ rev1 (merged into zxcv, created first)
   *             ├─ rev2 (merged into zxcv, created second)
   *             └─ current (NOT merged, created last)
   *
   * Expected: main=0, zxcv=1, rev1 and rev2 at col 2, current ≥ col 2.
   * current must NOT get a lower column than rev1 or rev2.
   */
  it("does not place a non-merged grandchild before its merged siblings", () => {
    const branches: GraphBranch[] = [
      branch({ id: "main",    isMain: true, headCommitId: "m2",  createdAt: "2024-01-01T00:00:00Z" }),
      branch({ id: "zxcv",   headCommitId: "z3",  forkedFromCommitId: "m1", createdAt: "2024-01-02T00:00:00Z" }),
      branch({ id: "rev1",   headCommitId: "r1b", forkedFromCommitId: "z1", createdAt: "2024-01-03T00:00:00Z" }),
      branch({ id: "rev2",   headCommitId: "r2b", forkedFromCommitId: "z2", createdAt: "2024-01-04T00:00:00Z" }),
      branch({ id: "current",headCommitId: "c1",  forkedFromCommitId: "z3", createdAt: "2024-01-05T00:00:00Z" }),
    ];

    const commits: GraphCommit[] = [
      commit({ id: "m2", parentCommitId: "m1", createdAt: "2024-01-12T00:00:00Z" }),
      commit({ id: "c1", parentCommitId: null, createdAt: "2024-01-11T00:00:00Z" }),
      commit({ id: "z3", parentCommitId: "z2", createdAt: "2024-01-10T00:00:00Z" }),
      commit({ id: "r2b", parentCommitId: "r2a", createdAt: "2024-01-09T00:00:00Z" }),
      commit({ id: "r1b", parentCommitId: "r1a", createdAt: "2024-01-08T00:00:00Z" }),
      commit({ id: "z2", parentCommitId: "z1", createdAt: "2024-01-07T00:00:00Z" }),
      commit({ id: "r2a", parentCommitId: "z2", createdAt: "2024-01-06T00:00:00Z" }),
      commit({ id: "r1a", parentCommitId: "z1", createdAt: "2024-01-05T06:00:00Z" }),
      commit({ id: "z1", parentCommitId: "m1", createdAt: "2024-01-04T00:00:00Z" }),
      commit({ id: "m1", parentCommitId: null, createdAt: "2024-01-01T06:00:00Z" }),
    ];

    const edges: GraphEdge[] = [
      edge("m2",  "m1",  0),
      edge("m2",  "z3",  1), // zxcv merged into main
      edge("z3",  "z2",  0),
      edge("z3",  "r2b", 1), // rev2 merged into zxcv
      edge("z2",  "z1",  0),
      edge("z2",  "r1b", 1), // rev1 merged into zxcv
      edge("r2b", "r2a", 0),
      edge("r2a", "z2",  0),
      edge("r1b", "r1a", 0),
      edge("r1a", "z1",  0),
      edge("c1",  "z3",  0),
    ];

    const layout = computeGraphLayout(branches, commits, edges, false);

    const mainCol    = layout.branchIndexById.get("main")!;
    const zxcvCol    = layout.branchIndexById.get("zxcv")!;
    const rev1Col    = layout.branchIndexById.get("rev1")!;
    const rev2Col    = layout.branchIndexById.get("rev2")!;
    const currentCol = layout.branchIndexById.get("current")!;

    expect(mainCol).toBe(0);
    expect(zxcvCol).toBeGreaterThan(mainCol);
    expect(rev1Col).toBeGreaterThan(zxcvCol);
    expect(rev2Col).toBeGreaterThan(zxcvCol);
    // non-merged current must not be closer to base than merged revisions
    expect(currentCol).toBeGreaterThanOrEqual(Math.min(rev1Col, rev2Col));
  });

  // ---------------------------------------------------------------------------
  // Color assignment — greedy graph coloring
  // ---------------------------------------------------------------------------

  describe("computeGraphLayout — color assignment", () => {
    /**
     * A child branch must get a different color than its parent, since they are
     * visually connected by a fork line.
     */
    it("assigns different colors to a parent branch and its child", () => {
      const branches: GraphBranch[] = [
        branch({ id: "main",  isMain: true, headCommitId: "m2", createdAt: "2024-01-01T00:00:00Z" }),
        branch({ id: "child", headCommitId: "c1", forkedFromCommitId: "m1", createdAt: "2024-01-02T00:00:00Z" }),
      ];
      const commits: GraphCommit[] = [
        commit({ id: "m2", parentCommitId: "m1", createdAt: "2024-01-03T00:00:00Z" }),
        commit({ id: "c1", parentCommitId: "m1", createdAt: "2024-01-02T06:00:00Z" }),
        commit({ id: "m1", parentCommitId: null, createdAt: "2024-01-01T06:00:00Z" }),
      ];

      const layout = computeGraphLayout(branches, commits, [], false);

      expect(layout.branchColorById.get("main")).not.toBe(layout.branchColorById.get("child"));
    });

    /**
     * Branches in neighboring columns whose row ranges overlap appear side-by-side
     * in the graph and must therefore have different colors.
     *
     * Scenario: main=col0, feat1=col1, feat2=col2 — all live at the same time.
     */
    it("assigns different colors to branches in neighboring columns with overlapping row ranges", () => {
      const branches: GraphBranch[] = [
        branch({ id: "main",  isMain: true, headCommitId: "m2", createdAt: "2024-01-01T00:00:00Z" }),
        branch({ id: "feat1", headCommitId: "f1", forkedFromCommitId: "m1", createdAt: "2024-01-02T00:00:00Z" }),
        branch({ id: "feat2", headCommitId: "f2", forkedFromCommitId: "m1", createdAt: "2024-01-03T00:00:00Z" }),
      ];
      const commits: GraphCommit[] = [
        commit({ id: "m2", parentCommitId: "m1", createdAt: "2024-01-05T00:00:00Z" }),
        commit({ id: "f2", parentCommitId: "m1", createdAt: "2024-01-04T00:00:00Z" }),
        commit({ id: "f1", parentCommitId: "m1", createdAt: "2024-01-03T00:00:00Z" }),
        commit({ id: "m1", parentCommitId: null, createdAt: "2024-01-01T06:00:00Z" }),
      ];

      const layout = computeGraphLayout(branches, commits, [], false);

      const mainColor  = layout.branchColorById.get("main");
      const feat1Color = layout.branchColorById.get("feat1");
      const feat2Color = layout.branchColorById.get("feat2");

      expect(mainColor).not.toBe(feat1Color);
      expect(feat1Color).not.toBe(feat2Color);
    });

    /**
     * Colors can be reused for branches that are far apart (non-adjacent columns,
     * no visual connection). This keeps the palette from growing unboundedly.
     *
     * Scenario: a deep chain main → b1 → b2 → b3.
     * b2 (col 2) is not adjacent to main (col 0), so they may share a color.
     */
    it("reuses colors for non-adjacent branches", () => {
      const branches: GraphBranch[] = [
        branch({ id: "main", isMain: true, headCommitId: "m1", createdAt: "2024-01-01T00:00:00Z" }),
        branch({ id: "b1",   headCommitId: "b1c", forkedFromCommitId: "m1", createdAt: "2024-01-02T00:00:00Z" }),
        branch({ id: "b2",   headCommitId: "b2c", forkedFromCommitId: "b1c", createdAt: "2024-01-03T00:00:00Z" }),
      ];
      const commits: GraphCommit[] = [
        commit({ id: "m1", parentCommitId: null, createdAt: "2024-01-05T00:00:00Z" }),
        commit({ id: "b1c", parentCommitId: "m1", createdAt: "2024-01-04T00:00:00Z" }),
        commit({ id: "b2c", parentCommitId: "b1c", createdAt: "2024-01-03T06:00:00Z" }),
      ];

      const layout = computeGraphLayout(branches, commits, [], false);

      // main=col0, b1=col1, b2=col2 — main and b2 are not adjacent so may share a color
      expect(layout.branchColorById.get("main")).toBe(layout.branchColorById.get("b2"));
      // b1 must differ from both its neighbors
      expect(layout.branchColorById.get("b1")).not.toBe(layout.branchColorById.get("main"));
      expect(layout.branchColorById.get("b1")).not.toBe(layout.branchColorById.get("b2"));
    });
  });

  // ---------------------------------------------------------------------------
  // Parent constraint: a child branch must be to the right of its parent
  // ---------------------------------------------------------------------------

  /**
   * When a child branch's row range does not naturally overlap with its parent's
   * range (e.g. forked from a commit not present in the graph or otherwise
   * disjoint), the parent-column constraint ensures the child is still placed to
   * the right of its parent.
   */
  it("always places a child branch to the right of its parent branch", () => {
    const branches: GraphBranch[] = [
      branch({ id: "main",  isMain: true, headCommitId: "m1", createdAt: "2024-01-01T00:00:00Z" }),
      branch({ id: "child", headCommitId: "c1", forkedFromCommitId: "m1", createdAt: "2024-01-02T00:00:00Z" }),
    ];

    const commits: GraphCommit[] = [
      commit({ id: "m1", parentCommitId: null, createdAt: "2024-01-05T00:00:00Z" }),
      commit({ id: "c1", parentCommitId: "c0", createdAt: "2024-01-03T00:00:00Z" }),
      commit({ id: "c0", parentCommitId: null, createdAt: "2024-01-02T00:00:00Z" }),
    ];

    const edges: GraphEdge[] = [
      edge("c1", "c0", 0),
    ];

    const layout = computeGraphLayout(branches, commits, edges, false);

    const mainCol  = layout.branchIndexById.get("main")!;
    const childCol = layout.branchIndexById.get("child")!;

    expect(childCol).toBeGreaterThan(mainCol);
  });

  it("reuses the surviving branch lane for merged orphan commits after a branch is deleted", () => {
    const branches: GraphBranch[] = [
      branch({ id: "main", isMain: true, headCommitId: "m2", createdAt: "2024-01-01T00:00:00Z" }),
    ];

    const commits: GraphCommit[] = [
      commit({ id: "m2", parentCommitId: "m1", createdAt: "2024-01-04T00:00:00Z" }),
      commit({ id: "b1", parentCommitId: "m1", createdAt: "2024-01-03T00:00:00Z" }),
      commit({ id: "m1", parentCommitId: null, createdAt: "2024-01-02T00:00:00Z" }),
    ];

    const edges: GraphEdge[] = [
      edge("m2", "m1", 0),
      edge("m2", "b1", 1),
      edge("b1", "m1", 0),
    ];

    const layout = computeGraphLayout(branches, commits, edges, false);

    expect(layout.branchIdByCommitId.get("b1")).toBe("main");
    expect(layout.orderedBranches.some((branch) => branch.id.startsWith("synthetic-"))).toBe(false);
  });
});
