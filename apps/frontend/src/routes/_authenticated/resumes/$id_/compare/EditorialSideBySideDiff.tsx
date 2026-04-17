/**
 * EditorialSideBySideDiff — side-by-side line diff styled with the compare
 * page's editorial tokens (real/styles.css .diff__row / .diff__cell). Word-
 * level highlighting inside modified rows uses diffWordsWithSpace so word
 * swaps read naturally.
 *
 * Styling: MUI sx prop only (design tokens from compare-design.ts)
 */
import { diffWordsWithSpace } from "diff";
import Box from "@mui/material/Box";
import {
  buildSideBySideDiffRows,
  type SideBySideDiffRow,
} from "./compare-utils";
import { danger, fg, font, line, ok } from "./compare-design";

interface EditorialSideBySideDiffProps {
  original: string;
  suggested: string;
}

function gutterFor(kind: SideBySideDiffRow["kind"]) {
  if (kind === "added") return { ch: "+", bg: ok.soft, color: ok.main };
  if (kind === "removed") return { ch: "−", bg: danger.soft, color: danger.main };
  if (kind === "modified") return { ch: "±", bg: danger.soft, color: danger.main };
  return { ch: " ", bg: "transparent", color: fg[5] };
}

function renderInlineLine(
  side: "left" | "right",
  row: SideBySideDiffRow,
) {
  const value = side === "left" ? row.left : row.right;
  if (value === null) return " ";
  if (row.kind !== "modified" || row.left === null || row.right === null) {
    return value;
  }

  const parts = diffWordsWithSpace(row.left, row.right);
  return parts
    .filter((part) => (side === "left" ? !part.added : !part.removed))
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
            backgroundColor: side === "left" ? danger.soft : ok.soft,
            color: side === "left" ? danger.main : ok.main,
            px: "2px",
            borderRadius: "2px",
          }}
        >
          {part.value}
        </Box>
      );
    });
}

export function EditorialSideBySideDiff({
  original,
  suggested,
}: EditorialSideBySideDiffProps) {
  const rows = buildSideBySideDiffRows(original, suggested);

  return (
    <Box>
      {rows.map((row, index) => {
        const gutter = gutterFor(row.kind);
        const leftIsDel = row.kind === "removed" || row.kind === "modified";
        const rightIsAdd = row.kind === "added" || row.kind === "modified";
        return (
          <Box
            key={`${row.kind}-${index}`}
            sx={{
              display: "grid",
              gridTemplateColumns: "28px 1fr 1fr",
              borderTop: index === 0 ? "none" : `1px solid ${line[1]}`,
              fontSize: "13px",
            }}
          >
            <Box
              sx={{
                backgroundColor: gutter.bg,
                color: gutter.color,
                fontFamily: font.mono,
                fontSize: "11px",
                textAlign: "center",
                py: "10px",
                userSelect: "none",
              }}
            >
              {gutter.ch}
            </Box>
            <Box
              sx={{
                px: "16px",
                py: "10px",
                color: fg[2],
                lineHeight: 1.65,
                borderLeft: `1px solid ${line[1]}`,
                backgroundColor: leftIsDel ? danger.cellBg : "transparent",
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                minWidth: 0,
                fontFamily: font.ui,
              }}
            >
              {renderInlineLine("left", row)}
            </Box>
            <Box
              sx={{
                px: "16px",
                py: "10px",
                color: fg[2],
                lineHeight: 1.65,
                borderLeft: `1px solid ${line[1]}`,
                backgroundColor: rightIsAdd ? ok.cellBg : "transparent",
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                minWidth: 0,
                fontFamily: font.ui,
              }}
            >
              {renderInlineLine("right", row)}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
