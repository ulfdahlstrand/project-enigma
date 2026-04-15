/**
 * Two-column line diff view. Rendered when the compare page's view mode is
 * "split". Character-level highlights inside modified rows come from
 * diffWordsWithSpace so word swaps read naturally.
 *
 * Styling: MUI sx prop only
 */
import Box from "@mui/material/Box";
import { diffWordsWithSpace } from "diff";
import {
  buildSideBySideDiffRows,
  type SideBySideDiffRow,
} from "./compare-utils";

interface SideBySideTextDiffProps {
  original: string;
  suggested: string;
}

export function SideBySideTextDiff({ original, suggested }: SideBySideTextDiffProps) {
  const rows = buildSideBySideDiffRows(original, suggested);

  function renderInlineLine(
    side: "left" | "right",
    left: string | null,
    right: string | null,
    kind: SideBySideDiffRow["kind"],
  ) {
    const value = side === "left" ? left : right;
    if (value === null) {
      return " ";
    }

    if (kind !== "modified" || left === null || right === null) {
      return value;
    }

    const parts = diffWordsWithSpace(left, right);

    return parts
      .filter((part) => {
        if (side === "left") return !part.added;
        return !part.removed;
      })
      .map((part, index) => {
        const isHighlighted = side === "left" ? part.removed : part.added;

        if (!isHighlighted) {
          return <span key={`${side}-${index}`}>{part.value}</span>;
        }

        return (
          <Box
            key={`${side}-${index}`}
            component="span"
            sx={{
              bgcolor: side === "left" ? "rgba(248, 81, 73, 0.38)" : "rgba(46, 160, 67, 0.38)",
              color: side === "left" ? "#ffdcd7" : "#aff5b4",
              borderRadius: 0.5,
              px: 0.25,
            }}
          >
            {part.value}
          </Box>
        );
      });
  }

  return (
    <Box
      sx={{
        mt: 1,
        borderRadius: 1,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#0d1117",
      }}
    >
      {rows.map((row, index) => {
        const leftSx =
          row.kind === "removed" || row.kind === "modified"
            ? {
                bgcolor: "rgba(248, 81, 73, 0.16)",
                color: "#ffdcd7",
              }
            : { color: "#c9d1d9" };
        const rightSx =
          row.kind === "added" || row.kind === "modified"
            ? {
                bgcolor: "rgba(46, 160, 67, 0.16)",
                color: "#aff5b4",
              }
            : { color: "#c9d1d9" };

        return (
          <Box
            key={`${row.kind}-${index}`}
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              borderTop: index === 0 ? "none" : "1px solid rgba(240, 246, 252, 0.08)",
            }}
          >
            <Box
              sx={{
                minHeight: 28,
                px: 1.5,
                py: 0.75,
                fontFamily: "monospace",
                fontSize: "0.875rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                borderRight: "1px solid rgba(240, 246, 252, 0.08)",
                ...leftSx,
              }}
            >
              {renderInlineLine("left", row.left, row.right, row.kind)}
            </Box>
            <Box
              sx={{
                minHeight: 28,
                px: 1.5,
                py: 0.75,
                fontFamily: "monospace",
                fontSize: "0.875rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                ...rightSx,
              }}
            >
              {renderInlineLine("right", row.left, row.right, row.kind)}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
