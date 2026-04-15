/**
 * Mutations for inline resume revision: save a new version, update a branch
 * assignment, and finalise the revision. Each mutation invalidates the right
 * query keys on success so the rest of the app sees fresh data.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../../orpc-client";
import {
  resumeBranchesKey,
  resumeBranchHistoryGraphKey,
  resumeCommitsKey,
} from "../versioning";

export function useInlineRevisionSaveVersion(resumeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof orpc.saveResumeVersion>[0]) =>
      orpc.saveResumeVersion(input),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(resumeId) }),
        queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(resumeId) }),
        queryClient.invalidateQueries({ queryKey: resumeCommitsKey(variables.branchId) }),
      ]);
    },
  });
}

export function useInlineRevisionUpdateAssignment(resumeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof orpc.updateBranchAssignment>[0]) =>
      orpc.updateBranchAssignment(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(resumeId) }),
        queryClient.invalidateQueries({ queryKey: ["getResume", resumeId] }),
      ]);
    },
  });
}
