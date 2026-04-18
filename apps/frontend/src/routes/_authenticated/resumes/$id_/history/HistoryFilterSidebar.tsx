/**
 * HistoryFilterSidebar — editorial filter panel for the History screen.
 *
 * Three groups (matching the design):
 *   • Varianter  — one entry per branch with a lane-colour swatch
 *   • Typ        — Alla händelser / Ändringar / Sammanslagningar
 *
 * Design tokens are shared with the Compare page via compare-design.ts.
 */

import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { accent, fg, font, ink, line } from "../compare/compare-design";
import { LANE_COLORS, laneColor } from "./history-inline-graph";
import type { GraphBranch } from "./history-graph-types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CommitTypeFilter = "all" | "changes" | "merges";

export interface HistoryFilterState {
  /** null = all branches visible */
  variantBranchId: string | null;
  commitType: CommitTypeFilter;
}

interface HistoryFilterSidebarProps {
  branches: GraphBranch[];
  /** Commit count per branch id */
  commitCountByBranchId: Map<string, number>;
  totalCommitCount: number;
  mergeCommitCount: number;
  filterState: HistoryFilterState;
  onFilterChange: (next: HistoryFilterState) => void;
}

// ---------------------------------------------------------------------------
// Shared filter-item row
// ---------------------------------------------------------------------------

interface FilterItemProps {
  swatchColor?: string | undefined;
  avatar?: React.ReactNode | undefined;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function FilterItem({ swatchColor, avatar, label, count, active, onClick }: FilterItemProps) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "7px 10px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "12.5px",
        fontFamily: font.ui,
        color: active ? fg[1] : fg[3],
        background: active ? ink[2] : "transparent",
        border: 0,
        transition: "background 120ms, color 120ms",
        textAlign: "left",
        whiteSpace: "nowrap",
        "&:hover": { background: ink[1], color: fg[2] },
      }}
    >
      {swatchColor && (
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: swatchColor,
            flexShrink: 0,
          }}
        />
      )}
      {avatar}
      <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </Box>
      <Box
        sx={{
          fontFamily: font.mono,
          fontSize: "10px",
          color: active ? fg[2] : fg[5],
          flexShrink: 0,
        }}
      >
        {count}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

function SectionHead({ label }: { label: string }) {
  return (
    <Typography
      sx={{
        fontFamily: font.mono,
        fontSize: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: fg[5],
        fontWeight: 500,
        mt: "18px",
        mb: "6px",
        "&:first-of-type": { mt: 0 },
      }}
    >
      {label}
    </Typography>
  );
}

// ---------------------------------------------------------------------------
// HistoryFilterSidebar
// ---------------------------------------------------------------------------

export function HistoryFilterSidebar({
  branches,
  commitCountByBranchId,
  totalCommitCount,
  mergeCommitCount,
  filterState,
  onFilterChange,
}: HistoryFilterSidebarProps) {
  const { t } = useTranslation("common");

  function setVariant(branchId: string | null) {
    onFilterChange({ ...filterState, variantBranchId: branchId });
  }

  function setCommitType(commitType: CommitTypeFilter) {
    onFilterChange({ ...filterState, commitType });
  }

  // Assign stable lane indices to branches (sorted by name for consistency).
  const sortedBranches = [...branches].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Box
      data-testid="history-filter-sidebar"
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: `1px solid ${line[1]}`,
        paddingRight: "20px",
        overflowY: "auto",
      }}
    >
      {/* ── Varianter ── */}
      <SectionHead label={t("resume.history.filter.variants", { defaultValue: "Varianter" })} />

      <FilterItem
        swatchColor={fg[4]}
        label={t("resume.history.filter.allVariants", { defaultValue: "Alla varianter" })}
        count={totalCommitCount}
        active={filterState.variantBranchId === null}
        onClick={() => setVariant(null)}
      />

      {sortedBranches.map((branch, i) => (
        <FilterItem
          key={branch.id}
          swatchColor={laneColor(i)}
          label={branch.name}
          count={commitCountByBranchId.get(branch.id) ?? 0}
          active={filterState.variantBranchId === branch.id}
          onClick={() => setVariant(branch.id)}
        />
      ))}

      {/* ── Typ ── */}
      <SectionHead label={t("resume.history.filter.type", { defaultValue: "Typ" })} />

      <FilterItem
        swatchColor={fg[5]}
        label={t("resume.history.filter.allEvents", { defaultValue: "Alla händelser" })}
        count={totalCommitCount}
        active={filterState.commitType === "all"}
        onClick={() => setCommitType("all")}
      />
      <FilterItem
        swatchColor={LANE_COLORS[0]}
        label={t("resume.history.filter.changes", { defaultValue: "Ändringar" })}
        count={totalCommitCount - mergeCommitCount}
        active={filterState.commitType === "changes"}
        onClick={() => setCommitType("changes")}
      />
      <FilterItem
        swatchColor={LANE_COLORS[3]}
        label={t("resume.history.filter.merges", { defaultValue: "Sammanslagningar" })}
        count={mergeCommitCount}
        active={filterState.commitType === "merges"}
        onClick={() => setCommitType("merges")}
      />
    </Box>
  );
}
