import { useCommitDiffStats } from "../hooks/useCommitDiffStats";
import { DiffStatsBadge } from "./DiffStatsBadge";

interface CommitDiffBadgeProps {
  commitId: string;
  parentCommitId?: string | null;
  size?: "small" | "medium" | undefined;
}

export function CommitDiffBadge({ commitId, parentCommitId, size }: CommitDiffBadgeProps) {
  const { plusCount, minusCount, isLoading } = useCommitDiffStats(parentCommitId, commitId);

  if (!parentCommitId) return null;

  return (
    <DiffStatsBadge
      plusCount={plusCount}
      minusCount={minusCount}
      isLoading={isLoading}
      {...(size !== undefined ? { size } : {})}
    />
  );
}
