/**
 * Pure helpers shared across the compare-versions page: range parsing,
 * ref→commit resolution, side-by-side diff row computation, and the
 * status→colour mappings used by the diff cards.
 */
import { diffLines } from "diff";
import type { DiffStatus } from "../../../../../utils/diff-utils";

export type BranchRef = {
  name: string;
  headCommitId: string | null;
};

export type CommitRef = {
  id: string;
};

export type CompareViewMode = "summary" | "split";

export type SideBySideDiffRow = {
  left: string | null;
  right: string | null;
  kind: "unchanged" | "removed" | "added" | "modified";
};

export function statusColor(status: string): "success" | "error" | "warning" | "default" {
  if (status === "added") return "success";
  if (status === "removed") return "error";
  if (status === "modified") return "warning";
  return "default";
}

export function statusBorderColor(status: DiffStatus): string {
  if (status === "added") return "success.main";
  if (status === "removed") return "error.main";
  if (status === "modified") return "warning.main";
  return "divider";
}

export function parseCompareRange(range?: string | null) {
  if (!range) {
    return { baseRef: "", compareRef: "" };
  }

  const separatorIndex = range.indexOf("...");

  if (separatorIndex === -1) {
    return { baseRef: "", compareRef: "" };
  }

  return {
    baseRef: range.slice(0, separatorIndex),
    compareRef: range.slice(separatorIndex + 3),
  };
}

export function resolveCompareRefToCommitId(
  ref: string,
  branchOptions: BranchRef[],
  commitOptions: CommitRef[],
): string {
  if (!ref) {
    return "";
  }

  const branchMatch = branchOptions.find((branch) => branch.name === ref);
  if (branchMatch?.headCommitId) {
    return branchMatch.headCommitId;
  }

  const commitMatch = commitOptions.find((commit) => commit.id === ref);
  return commitMatch?.id ?? "";
}

export function compareByCreatedAtDesc(
  a: { createdAt: string | Date | null },
  b: { createdAt: string | Date | null },
) {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bTime - aTime;
}

export function splitLinesPreserveContent(value: string) {
  const normalized = value.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines;
}

export function buildSideBySideDiffRows(
  original: string,
  suggested: string,
): SideBySideDiffRow[] {
  const parts = diffLines(original, suggested);
  const rows: SideBySideDiffRow[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;

    if (!part.added && !part.removed) {
      const lines = splitLinesPreserveContent(part.value);
      rows.push(
        ...lines.map((line) => ({
          left: line,
          right: line,
          kind: "unchanged" as const,
        })),
      );
      continue;
    }

    const nextPart = parts[index + 1];

    if (part.removed && nextPart?.added) {
      const leftLines = splitLinesPreserveContent(part.value);
      const rightLines = splitLinesPreserveContent(nextPart.value);
      const rowCount = Math.max(leftLines.length, rightLines.length);

      for (let lineIndex = 0; lineIndex < rowCount; lineIndex += 1) {
        rows.push({
          left: leftLines[lineIndex] ?? null,
          right: rightLines[lineIndex] ?? null,
          kind: "modified",
        });
      }

      index += 1;
      continue;
    }

    if (part.removed) {
      const lines = splitLinesPreserveContent(part.value);
      rows.push(
        ...lines.map((line) => ({
          left: line,
          right: null,
          kind: "removed" as const,
        })),
      );
      continue;
    }

    const lines = splitLinesPreserveContent(part.value);
    rows.push(
      ...lines.map((line) => ({
        left: null,
        right: line,
        kind: "added" as const,
      })),
    );
  }

  return rows.length > 0 ? rows : [{ left: "", right: "", kind: "unchanged" }];
}
