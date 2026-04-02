/**
 * TanStack Query hooks for the resume versioning API.
 *
 * Covers: commits, branches, diff, save version, fork branch.
 * All hooks use the oRPC client — no direct fetch calls.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../orpc-client";

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------

export const resumeCommitsKey = (branchId: string) =>
  ["listResumeCommits", branchId] as const;

export const resumeBranchesKey = (resumeId: string) =>
  ["listResumeBranches", resumeId] as const;

export const resumeBranchHistoryGraphKey = (resumeId: string) =>
  ["getResumeBranchHistoryGraph", resumeId] as const;

export const resumeCommitDiffKey = (
  baseCommitId: string,
  headCommitId: string
) => ["compareResumeCommits", baseCommitId, headCommitId] as const;

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/** Lists all commits for a branch in reverse chronological order. */
export function useResumeCommits(branchId: string) {
  return useQuery({
    queryKey: resumeCommitsKey(branchId),
    queryFn: () => orpc.listResumeCommits({ branchId }),
    enabled: Boolean(branchId),
  });
}

/** Lists all branches (variants) for a resume. */
export function useResumeBranches(resumeId: string) {
  return useQuery({
    queryKey: resumeBranchesKey(resumeId),
    queryFn: () => orpc.listResumeBranches({ resumeId }),
    enabled: Boolean(resumeId),
  });
}

/** Fetches all branches and commits needed to render a resume history overview. */
export function useResumeBranchHistoryGraph(resumeId: string) {
  return useQuery({
    queryKey: resumeBranchHistoryGraphKey(resumeId),
    queryFn: () => orpc.getResumeBranchHistoryGraph({ resumeId }),
    enabled: Boolean(resumeId),
  });
}

/** Compares two commits and returns a structural diff. */
export function useResumeCommitDiff(
  baseCommitId: string | null,
  headCommitId: string | null
) {
  return useQuery({
    queryKey: resumeCommitDiffKey(baseCommitId ?? "", headCommitId ?? ""),
    queryFn: () =>
      orpc.compareResumeCommits({
        baseCommitId: baseCommitId!,
        headCommitId: headCommitId!,
      }),
    enabled: Boolean(baseCommitId) && Boolean(headCommitId),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/** Saves the current branch state as a new commit (version). */
export function useSaveResumeVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      branchId,
      message,
    }: {
      branchId: string;
      message?: string;
    }) => orpc.saveResumeVersion({ branchId, message }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: resumeCommitsKey(variables.branchId),
      });
    },
  });
}

/** Creates a new branch forked from a specific commit. */
export function useForkResumeBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fromCommitId,
      name,
    }: {
      fromCommitId: string;
      name: string;
      resumeId: string;
    }) => orpc.forkResumeBranch({ fromCommitId, name }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: resumeBranchesKey(variables.resumeId),
      });
    },
  });
}

export function useFinaliseResumeBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceBranchId,
      revisionBranchId,
      action,
    }: {
      sourceBranchId: string;
      revisionBranchId: string;
      action: "merge" | "keep";
    }) => orpc.finaliseResumeBranch({ sourceBranchId, revisionBranchId, action }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeCommitsKey(variables.sourceBranchId) }),
        queryClient.invalidateQueries({ queryKey: resumeCommitsKey(variables.revisionBranchId) }),
        queryClient.invalidateQueries({ queryKey: ["getResumeBranchHistoryGraph"] }),
        queryClient.invalidateQueries({ queryKey: ["listResumeBranches"] }),
        queryClient.invalidateQueries({ queryKey: ["getResume"] }),
      ]);
    },
  });
}

export function useDeleteResumeBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId }: { branchId: string }) => orpc.deleteResumeBranch({ branchId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["getResumeBranchHistoryGraph"] }),
        queryClient.invalidateQueries({ queryKey: ["listResumeBranches"] }),
      ]);
    },
  });
}
