import { useCommitDiff } from "./useCommitDiff";

export interface CommitDiffStats {
  plusCount: number;
  minusCount: number;
  isLoading: boolean;
}

export function useCommitDiffStats(
  parentCommitId: string | null | undefined,
  commitId: string | null | undefined,
): CommitDiffStats {
  const { plusCount, minusCount, isLoading } = useCommitDiff(parentCommitId, commitId);
  return { plusCount, minusCount, isLoading };
}
