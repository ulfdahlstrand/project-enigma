/**
 * Tests for the versioning TanStack Query hooks.
 *
 * Covers:
 *   - useResumeCommits — query key factory + enabled flag
 *   - useResumeBranches — query key factory + enabled flag
 *   - useResumeBranchHistoryGraph — query key factory + enabled flag
 *   - useResumeCommitDiff — enabled only when both IDs are set
 *   - useSaveResumeVersion — calls orpc.saveResumeVersion, invalidates commits key
 *   - useForkResumeBranch — calls orpc.forkResumeBranch, invalidates branches key
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  resumeCommitsKey,
  resumeBranchesKey,
  resumeBranchHistoryGraphKey,
  resumeCommitDiffKey,
  useResumeCommits,
  useResumeBranches,
  useResumeBranchHistoryGraph,
  useResumeCommitDiff,
  useSaveResumeVersion,
  useForkResumeBranch,
} from "../versioning";

// ---------------------------------------------------------------------------
// Mock oRPC client
// ---------------------------------------------------------------------------

vi.mock("../../orpc-client", () => ({
  orpc: {
    listResumeCommits: vi.fn(),
    listResumeBranches: vi.fn(),
    getResumeBranchHistoryGraph: vi.fn(),
    compareResumeCommits: vi.fn(),
    saveResumeVersion: vi.fn(),
    forkResumeBranch: vi.fn(),
  },
}));

import { orpc } from "../../orpc-client";

const mockListCommits = orpc.listResumeCommits as ReturnType<typeof vi.fn>;
const mockListBranches = orpc.listResumeBranches as ReturnType<typeof vi.fn>;
const mockGetBranchHistoryGraph = orpc.getResumeBranchHistoryGraph as ReturnType<typeof vi.fn>;
const mockCompare = orpc.compareResumeCommits as ReturnType<typeof vi.fn>;
const mockSaveVersion = orpc.saveResumeVersion as ReturnType<typeof vi.fn>;
const mockForkBranch = orpc.forkResumeBranch as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Wrapper helper
// ---------------------------------------------------------------------------

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function buildClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------

describe("resumeCommitsKey", () => {
  it("returns a tuple with the branchId", () => {
    expect(resumeCommitsKey("branch-1")).toEqual(["listResumeCommits", "branch-1"]);
  });
});

describe("resumeBranchesKey", () => {
  it("returns a tuple with the resumeId", () => {
    expect(resumeBranchesKey("resume-1")).toEqual(["listResumeBranches", "resume-1"]);
  });
});

describe("resumeBranchHistoryGraphKey", () => {
  it("returns a tuple with the resumeId", () => {
    expect(resumeBranchHistoryGraphKey("resume-1")).toEqual([
      "getResumeBranchHistoryGraph",
      "resume-1",
    ]);
  });
});

describe("resumeCommitDiffKey", () => {
  it("returns a tuple with both commit IDs", () => {
    expect(resumeCommitDiffKey("base-1", "head-1")).toEqual([
      "compareResumeCommits",
      "base-1",
      "head-1",
    ]);
  });
});

// ---------------------------------------------------------------------------
// useResumeCommits
// ---------------------------------------------------------------------------

describe("useResumeCommits", () => {
  const COMMITS = [
    { id: "commit-1", message: "v1", createdAt: "2024-01-01T00:00:00Z" },
  ];

  it("calls orpc.listResumeCommits with the branchId and returns data", async () => {
    mockListCommits.mockResolvedValue(COMMITS);
    const qc = buildClient();

    const { result } = renderHook(() => useResumeCommits("branch-1"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockListCommits).toHaveBeenCalledWith({ branchId: "branch-1" });
    expect(result.current.data).toEqual(COMMITS);
  });

  it("is disabled when branchId is an empty string", () => {
    const qc = buildClient();
    const { result } = renderHook(() => useResumeCommits(""), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockListCommits).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useResumeBranches
// ---------------------------------------------------------------------------

describe("useResumeBranches", () => {
  const BRANCHES = [
    { id: "branch-1", resumeId: "resume-1", name: "main", isMain: true, language: "en", headCommitId: "commit-1", createdAt: "2024-01-01T00:00:00Z" },
  ];

  it("calls orpc.listResumeBranches with the resumeId and returns data", async () => {
    mockListBranches.mockResolvedValue(BRANCHES);
    const qc = buildClient();

    const { result } = renderHook(() => useResumeBranches("resume-1"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockListBranches).toHaveBeenCalledWith({ resumeId: "resume-1" });
    expect(result.current.data).toEqual(BRANCHES);
  });

  it("is disabled when resumeId is an empty string", () => {
    const qc = buildClient();
    const { result } = renderHook(() => useResumeBranches(""), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockListBranches).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useResumeBranchHistoryGraph
// ---------------------------------------------------------------------------

describe("useResumeBranchHistoryGraph", () => {
  const GRAPH = {
    branches: [
      { id: "branch-1", resumeId: "resume-1", name: "main", isMain: true, language: "en", headCommitId: "commit-1", forkedFromCommitId: null, createdAt: "2024-01-01T00:00:00Z" },
    ],
    commits: [
      { id: "commit-1", resumeId: "resume-1", parentCommitId: null, message: "v1", createdAt: "2024-01-01T00:00:00Z" },
    ],
  };

  it("calls orpc.getResumeBranchHistoryGraph with the resumeId and returns data", async () => {
    mockGetBranchHistoryGraph.mockResolvedValue(GRAPH);
    const qc = buildClient();

    const { result } = renderHook(() => useResumeBranchHistoryGraph("resume-1"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetBranchHistoryGraph).toHaveBeenCalledWith({ resumeId: "resume-1" });
    expect(result.current.data).toEqual(GRAPH);
  });

  it("is disabled when resumeId is an empty string", () => {
    const qc = buildClient();
    const { result } = renderHook(() => useResumeBranchHistoryGraph(""), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetBranchHistoryGraph).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useResumeCommitDiff
// ---------------------------------------------------------------------------

describe("useResumeCommitDiff", () => {
  const DIFF_RESULT = {
    baseCommitId: "commit-a",
    headCommitId: "commit-b",
    diff: { scalars: {}, skills: [], assignments: [], hasChanges: false },
  };

  it("calls orpc.compareResumeCommits when both IDs are provided", async () => {
    mockCompare.mockResolvedValue(DIFF_RESULT);
    const qc = buildClient();

    const { result } = renderHook(
      () => useResumeCommitDiff("commit-a", "commit-b"),
      { wrapper: makeWrapper(qc) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCompare).toHaveBeenCalledWith({
      baseCommitId: "commit-a",
      headCommitId: "commit-b",
    });
    expect(result.current.data).toEqual(DIFF_RESULT);
  });

  it("is disabled when baseCommitId is null", () => {
    const qc = buildClient();
    const { result } = renderHook(
      () => useResumeCommitDiff(null, "commit-b"),
      { wrapper: makeWrapper(qc) }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it("is disabled when headCommitId is null", () => {
    const qc = buildClient();
    const { result } = renderHook(
      () => useResumeCommitDiff("commit-a", null),
      { wrapper: makeWrapper(qc) }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it("is disabled when both IDs are null", () => {
    const qc = buildClient();
    const { result } = renderHook(() => useResumeCommitDiff(null, null), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// useSaveResumeVersion
// ---------------------------------------------------------------------------

describe("useSaveResumeVersion", () => {
  it("calls orpc.saveResumeVersion with branchId and optional message", async () => {
    mockSaveVersion.mockResolvedValue({ id: "commit-new" });
    const qc = buildClient();

    const { result } = renderHook(() => useSaveResumeVersion(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ branchId: "branch-1", message: "v2" });
    });

    expect(mockSaveVersion).toHaveBeenCalledWith({
      branchId: "branch-1",
      message: "v2",
    });
  });

  it("calls orpc.saveResumeVersion without message when omitted", async () => {
    mockSaveVersion.mockResolvedValue({ id: "commit-new" });
    const qc = buildClient();

    const { result } = renderHook(() => useSaveResumeVersion(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ branchId: "branch-1" });
    });

    expect(mockSaveVersion).toHaveBeenCalledWith({
      branchId: "branch-1",
      message: undefined,
    });
  });

  it("invalidates the commits query key on success", async () => {
    mockSaveVersion.mockResolvedValue({ id: "commit-new" });
    const qc = buildClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useSaveResumeVersion(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ branchId: "branch-1" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: resumeCommitsKey("branch-1"),
    });
  });

  it("surfaces errors from orpc.saveResumeVersion", async () => {
    mockSaveVersion.mockRejectedValue(new Error("Save failed"));
    const qc = buildClient();

    const { result } = renderHook(() => useSaveResumeVersion(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ branchId: "branch-1" }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useForkResumeBranch
// ---------------------------------------------------------------------------

describe("useForkResumeBranch", () => {
  it("calls orpc.forkResumeBranch with fromCommitId and name", async () => {
    mockForkBranch.mockResolvedValue({ id: "branch-new" });
    const qc = buildClient();

    const { result } = renderHook(() => useForkResumeBranch(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        fromCommitId: "commit-1",
        name: "My Variant",
        resumeId: "resume-1",
      });
    });

    expect(mockForkBranch).toHaveBeenCalledWith({
      fromCommitId: "commit-1",
      name: "My Variant",
    });
  });

  it("invalidates the branches query key on success", async () => {
    mockForkBranch.mockResolvedValue({ id: "branch-new" });
    const qc = buildClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useForkResumeBranch(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        fromCommitId: "commit-1",
        name: "My Variant",
        resumeId: "resume-1",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: resumeBranchesKey("resume-1"),
    });
  });

  it("surfaces errors from orpc.forkResumeBranch", async () => {
    mockForkBranch.mockRejectedValue(new Error("Fork failed"));
    const qc = buildClient();

    const { result } = renderHook(() => useForkResumeBranch(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        fromCommitId: "commit-1",
        name: "My Variant",
        resumeId: "resume-1",
      }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
