import { useMemo } from "react";
import { useResumeCommitDiff } from "./versioning";

export interface CommitDiffStats {
  plusCount: number;
  minusCount: number;
  isLoading: boolean;
}

function countChange(status: string): { plus: number; minus: number } {
  if (status === "added") return { plus: 1, minus: 0 };
  if (status === "removed") return { plus: 0, minus: 1 };
  if (status === "modified") return { plus: 1, minus: 1 };
  return { plus: 0, minus: 0 };
}

export function useCommitDiffStats(
  parentCommitId: string | null | undefined,
  commitId: string | null | undefined,
): CommitDiffStats {
  const { data: diffResult, isLoading } = useResumeCommitDiff(
    parentCommitId ?? null,
    commitId ?? null,
  );

  const stats = useMemo(() => {
    const diff = diffResult?.diff;
    if (!diff) return { plusCount: 0, minusCount: 0 };

    let plusCount = 0;
    let minusCount = 0;

    for (const change of Object.values(diff.scalars)) {
      if (!change) continue;
      const { plus, minus } = countChange("modified");
      plusCount += plus;
      minusCount += minus;
    }

    for (const item of diff.skills) {
      if (item.status === "unchanged") continue;
      const { plus, minus } = countChange(item.status);
      plusCount += plus;
      minusCount += minus;
    }

    for (const item of diff.assignments) {
      if (item.status === "unchanged") continue;
      const { plus, minus } = countChange(item.status);
      plusCount += plus;
      minusCount += minus;
    }

    return { plusCount, minusCount };
  }, [diffResult?.diff]);

  return { ...stats, isLoading };
}
