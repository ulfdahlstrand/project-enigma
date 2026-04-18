/**
 * HistoryCommitTable — editorial dark commit table with an inline branch-graph column.
 *
 * Columns: Graf · Meddelande · Författare · När · Δ · ID · ⋯
 *
 * Design tokens imported from compare-design.ts (shared with the Compare page).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import type { CommitTagWithLinkedResume } from "@cv-tool/contracts";
import { accent, fg, font, ink, lilac, line } from "../compare/compare-design";
import { CommitDiffBadge } from "../../../../../components/CommitDiffBadge";
import type { GraphBranch, GraphCommit } from "./history-graph-utils";
import { HistoryInlineGraphCell } from "./HistoryInlineGraphCell";
import type { InlineGraphData } from "./history-inline-graph";
import { formatCommitTimestamp } from "./history-graph-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HistoryCommitTableProps {
  rows: Array<{ commit: GraphCommit; rowIndex: number }>;
  inlineGraphData: InlineGraphData;
  selectedBranch: GraphBranch | undefined;
  commitTags?: Map<string, CommitTagWithLinkedResume[]>;
  currentResumeId?: string;
  mergeCommitIds: Set<string>;
  onViewCommit: (commitId: string) => void;
  onCompare?: (commitId: string) => void;
  onRevert?: (commit: GraphCommit) => void;
}

// ---------------------------------------------------------------------------
// Shared cell styling
// ---------------------------------------------------------------------------

const thSx = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontFamily: font.mono,
  fontWeight: 500,
  color: fg[5],
  fontSize: "10px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.14em",
  borderBottom: `1px solid ${line[1]}`,
  background: ink[0],
  whiteSpace: "nowrap" as const,
};

const tdSx = {
  padding: "0 12px",
  borderBottom: `1px solid ${line[1]}`,
  verticalAlign: "middle",
  height: 48,
  color: fg[2],
};

// ---------------------------------------------------------------------------
// AuthorAvatar
// ---------------------------------------------------------------------------

function AuthorAvatar({ isAi }: { isAi: boolean }) {
  return (
    <Box
      sx={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: isAi ? lilac.soft : accent.soft,
        color: isAi ? lilac.main : accent.main,
        border: `1px solid ${isAi ? lilac.line : accent.line}`,
        display: "grid",
        placeItems: "center",
        fontSize: "9px",
        fontWeight: 600,
        fontFamily: font.ui,
        flexShrink: 0,
      }}
    >
      {isAi ? "AI" : "UD"}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// CommitRow
// ---------------------------------------------------------------------------

interface CommitRowProps {
  commit: GraphCommit;
  rowIndex: number;
  inlineGraphData: InlineGraphData;
  isHead: boolean;
  isMerge: boolean;
  active: boolean;
  onSelect: () => void;
  onOpenMenu: (el: HTMLElement, commitId: string) => void;
}

function CommitRow({
  commit,
  rowIndex,
  inlineGraphData,
  isHead,
  isMerge,
  active,
  onSelect,
  onOpenMenu,
}: CommitRowProps) {
  const { t } = useTranslation("common");

  const graphRow = inlineGraphData.rows[rowIndex];
  const title = commit.title || t("resume.history.defaultMessage");
  const isAi = commit.createdBy === null;

  const rowBg = active ? ink[2] : "transparent";
  const hoverBg = ink[1];

  return (
    <Box
      component="tr"
      data-testid={`commit-row-${commit.id}`}
      onClick={onSelect}
      sx={{
        cursor: "pointer",
        transition: "background 120ms",
        background: rowBg,
        "&:hover td": { background: active ? ink[2] : hoverBg },
      }}
    >
      {/* Graf */}
      <Box component="td" sx={{ ...tdSx, padding: "0 !important", width: `${inlineGraphData.svgWidth}px` }}>
        {graphRow && (
          <HistoryInlineGraphCell
            row={graphRow}
            graphData={inlineGraphData}
            active={active}
          />
        )}
      </Box>

      {/* Meddelande */}
      <Box component="td" sx={{ ...tdSx, minWidth: 280 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {isMerge && (
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "1px 8px",
                fontFamily: font.mono,
                fontSize: "10px",
                background: lilac.soft,
                border: `1px solid ${lilac.line}`,
                borderRadius: "999px",
                color: lilac.main,
                letterSpacing: "0.02em",
                flexShrink: 0,
              }}
            >
              merge
            </Box>
          )}
          {isHead && (
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                padding: "1px 8px",
                fontFamily: font.mono,
                fontSize: "10px",
                background: accent.soft,
                border: `1px solid ${accent.line}`,
                borderRadius: "999px",
                color: accent.main,
                letterSpacing: "0.02em",
                flexShrink: 0,
              }}
            >
              {t("resume.history.headBadge")}
            </Box>
          )}
          <Box
            component="b"
            sx={{ fontWeight: 500, color: fg[1], fontFamily: font.ui, fontSize: "12.5px" }}
          >
            {title}
          </Box>
        </Box>
      </Box>

      {/* Författare */}
      <Box component="td" sx={{ ...tdSx }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
          <AuthorAvatar isAi={isAi} />
          <Box sx={{ fontFamily: font.ui, fontSize: "12.5px", color: fg[2] }}>
            {isAi
              ? t("resume.history.authorAI", { defaultValue: "AI-assistent" })
              : t("resume.history.authorHuman", { defaultValue: "Ulf Dahlstrand" })}
          </Box>
        </Box>
      </Box>

      {/* När */}
      <Box component="td" sx={{ ...tdSx }}>
        <Box
          sx={{
            fontFamily: font.mono,
            fontSize: "10.5px",
            color: fg[4],
            whiteSpace: "nowrap",
            letterSpacing: "0.02em",
          }}
        >
          {formatCommitTimestamp(commit.createdAt)}
        </Box>
      </Box>

      {/* Δ diff */}
      <Box component="td" sx={{ ...tdSx }}>
        <Box sx={{ fontFamily: font.mono, fontSize: "10.5px", color: fg[4], whiteSpace: "nowrap" }}>
          <CommitDiffBadge commitId={commit.id} parentCommitId={commit.parentCommitId} />
        </Box>
      </Box>

      {/* ID */}
      <Box component="td" sx={{ ...tdSx }}>
        <Box
          sx={{
            fontFamily: font.mono,
            fontSize: "10.5px",
            color: fg[4],
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {commit.id.slice(0, 7)}
        </Box>
      </Box>

      {/* Actions */}
      <Box component="td" sx={{ ...tdSx, width: 36 }}>
        <Box
          component="button"
          aria-label={t("resume.history.commitActionsButton")}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onOpenMenu(e.currentTarget, commit.id);
          }}
          sx={{
            width: 24,
            height: 24,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            color: fg[3],
            border: 0,
            background: "transparent",
            cursor: "pointer",
            fontFamily: font.ui,
            transition: "background 120ms, color 120ms",
            "&:hover": { background: ink[2], color: fg[1] },
          }}
        >
          ···
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// HistoryCommitTable
// ---------------------------------------------------------------------------

export function HistoryCommitTable({
  rows,
  inlineGraphData,
  selectedBranch,
  mergeCommitIds,
  onViewCommit,
  onCompare,
  onRevert,
}: HistoryCommitTableProps) {
  const { t } = useTranslation("common");
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuCommitId, setMenuCommitId] = useState<string | null>(null);
  const [activeCommitId, setActiveCommitId] = useState<string | null>(null);

  const closeMenu = () => {
    setMenuAnchorEl(null);
    setMenuCommitId(null);
  };

  if (rows.length === 0) {
    return (
      <Typography
        sx={{ fontFamily: font.ui, fontSize: "12.5px", color: fg[3], padding: "24px 0" }}
      >
        {t("resume.history.empty")}
      </Typography>
    );
  }

  return (
    <>
      <Box
        component="table"
        data-testid="history-commit-table"
        sx={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          fontSize: "12.5px",
          fontFamily: font.ui,
        }}
      >
        <Box component="thead">
          <Box component="tr">
            <Box component="th" sx={{ ...thSx, width: `${inlineGraphData.svgWidth}px`, padding: "10px 12px" }}>
              {t("resume.history.tableHeaderGraph", { defaultValue: "Graf" })}
            </Box>
            <Box component="th" sx={thSx}>
              {t("resume.history.tableHeaderMessage")}
            </Box>
            <Box component="th" sx={thSx}>
              {t("resume.history.tableHeaderAuthor", { defaultValue: "Författare" })}
            </Box>
            <Box component="th" sx={thSx}>
              {t("resume.history.tableHeaderWhen", { defaultValue: "När" })}
            </Box>
            <Box component="th" sx={thSx}>Δ</Box>
            <Box component="th" sx={thSx}>ID</Box>
            <Box component="th" sx={{ ...thSx, width: 36 }} />
          </Box>
        </Box>

        <Box component="tbody">
          {rows.map(({ commit, rowIndex }) => (
            <CommitRow
              key={commit.id}
              commit={commit}
              rowIndex={rowIndex}
              inlineGraphData={inlineGraphData}
              isHead={selectedBranch?.headCommitId === commit.id}
              isMerge={mergeCommitIds.has(commit.id)}
              active={activeCommitId === commit.id}
              onSelect={() => setActiveCommitId(commit.id)}
              onOpenMenu={(el, id) => {
                setMenuAnchorEl(el);
                setMenuCommitId(id);
              }}
            />
          ))}
        </Box>
      </Box>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuCommitId) onViewCommit(menuCommitId);
            closeMenu();
          }}
        >
          {t("resume.history.viewCommitMenuItem")}
        </MenuItem>
        {onCompare && (
          <MenuItem
            onClick={() => {
              if (menuCommitId) onCompare(menuCommitId);
              closeMenu();
            }}
          >
            {t("resume.history.compareWithCurrentMenuItem")}
          </MenuItem>
        )}
        {onRevert && (
          <MenuItem
            onClick={() => {
              const commit = rows.find((r) => r.commit.id === menuCommitId)?.commit;
              if (commit) onRevert(commit);
              closeMenu();
            }}
          >
            {t("resume.history.restoreSnapshotMenuItem")}
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
