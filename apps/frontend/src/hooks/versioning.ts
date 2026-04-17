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

export const commitTagsKey = (resumeId: string, branchId?: string | null) =>
  ["listCommitTags", resumeId, branchId ?? null] as const;

export const translationStatusKey = (sourceResumeId: string, targetResumeId: string) =>
  ["getTranslationStatus", sourceResumeId, targetResumeId] as const;

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/** Lists all commits reachable from a branch head in reverse chronological order. */
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

/** Lists cross-resume commit tags (translation links) involving this resume, optionally scoped to a branch. */
export function useListCommitTags(resumeId: string, branchId?: string | null) {
  return useQuery({
    queryKey: commitTagsKey(resumeId, branchId),
    queryFn: () => orpc.listCommitTags({ resumeId, ...(branchId ? { branchId } : {}) }),
    enabled: Boolean(resumeId),
  });
}

/** Returns staleness status between a source and target resume. */
export function useGetTranslationStatus(
  sourceResumeId: string | null,
  targetResumeId: string | null
) {
  return useQuery({
    queryKey: translationStatusKey(sourceResumeId ?? "", targetResumeId ?? ""),
    queryFn: () =>
      orpc.getTranslationStatus({
        resumeId: sourceResumeId!,
        targetResumeId: targetResumeId!,
      }),
    enabled: Boolean(sourceResumeId) && Boolean(targetResumeId),
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
      title,
      description,
    }: {
      branchId: string;
      title?: string;
      description?: string;
    }) => orpc.saveResumeVersion({ branchId, title, description }),
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

/** Creates a short-lived revision branch off a variant. */
export function useCreateRevisionBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceBranchId,
      name,
    }: {
      sourceBranchId: string;
      name: string;
      resumeId: string;
    }) => orpc.createRevisionBranch({ sourceBranchId, name }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(variables.resumeId) }),
        queryClient.invalidateQueries({ queryKey: ["getResumeBranchHistoryGraph"] }),
      ]);
    },
  });
}

/** Fast-forwards the source variant to the revision's HEAD, then deletes the revision. */
export function useMergeRevisionIntoSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId }: { branchId: string; resumeId: string }) =>
      orpc.mergeRevisionIntoSource({ branchId }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(variables.resumeId) }),
        queryClient.invalidateQueries({ queryKey: ["getResumeBranchHistoryGraph"] }),
        queryClient.invalidateQueries({ queryKey: ["listResumeBranches"] }),
        queryClient.invalidateQueries({ queryKey: ["getResume"] }),
      ]);
    },
  });
}

/** Converts a revision branch into a standalone variant. */
export function usePromoteRevisionToVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      branchId,
      name,
    }: {
      branchId: string;
      name: string;
      resumeId: string;
    }) => orpc.promoteRevisionToVariant({ branchId, name }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(variables.resumeId) }),
        queryClient.invalidateQueries({ queryKey: ["getResumeBranchHistoryGraph"] }),
        queryClient.invalidateQueries({ queryKey: ["listResumeBranches"] }),
      ]);
    },
  });
}

/** Soft-archives or unarchives a branch. */
export function useArchiveResumeBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      branchId,
      isArchived,
    }: {
      branchId: string;
      isArchived: boolean;
      resumeId: string;
    }) => orpc.archiveResumeBranch({ branchId, isArchived }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(variables.resumeId) }),
        queryClient.invalidateQueries({ queryKey: ["getResumeBranchHistoryGraph"] }),
      ]);
    },
  });
}

/** Rebases a revision branch onto its source's current HEAD. */
export function useRebaseRevisionOntoSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId }: { branchId: string; resumeId: string }) =>
      orpc.rebaseRevisionOntoSource({ branchId }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(variables.resumeId) }),
        queryClient.invalidateQueries({ queryKey: ["getResumeBranchHistoryGraph"] }),
        queryClient.invalidateQueries({ queryKey: resumeCommitsKey(variables.branchId) }),
      ]);
    },
  });
}

/** Creates a new CommitTag linking two commits across different resumes. */
export function useCreateCommitTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceCommitId,
      targetCommitId,
      kind,
    }: {
      sourceCommitId: string;
      targetCommitId: string;
      kind?: string;
      sourceResumeId: string;
      targetResumeId: string;
    }) => orpc.createCommitTag({ sourceCommitId, targetCommitId, kind }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["listCommitTags", variables.sourceResumeId] }),
        queryClient.invalidateQueries({ queryKey: ["listCommitTags", variables.targetResumeId] }),
        queryClient.invalidateQueries({ queryKey: ["getTranslationStatus"] }),
      ]);
    },
  });
}

/** Creates a new resume as a translation of an existing one (clones content + initial tag). */
export function useCreateTranslationResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceResumeId,
      targetLanguage,
      name,
    }: {
      sourceResumeId: string;
      targetLanguage: string;
      name?: string;
    }) => orpc.createTranslationResume({ sourceResumeId, targetLanguage, name }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["listCommitTags", variables.sourceResumeId] }),
        queryClient.invalidateQueries({ queryKey: ["listResumes"] }),
        queryClient.invalidateQueries({ queryKey: ["getResume"] }),
      ]);
    },
  });
}

/** Reverts to a prior snapshot by creating a new commit with that content. */
export function useRevertResumeCommit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      branchId,
      targetCommitId,
    }: {
      branchId: string;
      targetCommitId: string;
      resumeId: string;
    }) => orpc.revertCommit({ branchId, targetCommitId }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(variables.resumeId) }),
        queryClient.invalidateQueries({ queryKey: ["getResumeBranchHistoryGraph"] }),
        queryClient.invalidateQueries({ queryKey: resumeCommitsKey(variables.branchId) }),
      ]);
    },
  });
}
