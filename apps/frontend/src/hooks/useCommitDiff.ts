import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useResumeCommitDiff } from "./versioning";
import { buildDiffGroups } from "../utils/diff-utils";
import type { DiffGroup } from "../utils/diff-utils";

export interface CommitDiffResult {
  diffGroups: DiffGroup[];
  plusCount: number;
  minusCount: number;
  hasChanges: boolean | null;
  isLoading: boolean;
  isError: boolean;
}

export function useCommitDiff(
  baseCommitId: string | null | undefined,
  headCommitId: string | null | undefined,
): CommitDiffResult {
  const { t } = useTranslation("common");
  const { data: diffResult, isLoading, isError } = useResumeCommitDiff(
    baseCommitId ?? null,
    headCommitId ?? null,
  );

  const diffGroups = useMemo(
    () => (diffResult?.diff ? buildDiffGroups(diffResult.diff, t) : []),
    [diffResult?.diff, t],
  );

  const plusCount = useMemo(
    () => diffGroups.reduce((sum, g) => sum + g.plusCount, 0),
    [diffGroups],
  );

  const minusCount = useMemo(
    () => diffGroups.reduce((sum, g) => sum + g.minusCount, 0),
    [diffGroups],
  );

  const hasChanges = diffResult ? (diffResult.diff.hasChanges ?? null) : null;

  return { diffGroups, plusCount, minusCount, hasChanges, isLoading, isError };
}
