import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ArchiveIcon from "@mui/icons-material/Archive";
import FilterListIcon from "@mui/icons-material/FilterList";
import LanguageIcon from "@mui/icons-material/Language";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { BranchType } from "@cv-tool/contracts";
import type { GraphBranch, GraphCommit, GraphEdge } from "./history-graph-utils";
import { getReachableCommitIds } from "./history-graph-utils";

export type BranchFilterType = BranchType | "archived";

interface FilterBranchesArgs {
  branches: GraphBranch[];
  activeFilters: Set<BranchFilterType>;
  activeLanguages: Set<string>;
  showArchived: boolean;
}

/**
 * Returns the subset of branches that pass the active filters.
 *
 * - Archived: kept only if showArchived is true
 * - Type filter: variants are kept if any of (variant|translation) is active and
 *   — when "translation" is the only active type — the variant has ≥1 translation.
 *   Translations are kept if "translation" is active (or no type filter).
 *   Revisions are kept if "revision" is active (or no type filter).
 * - Language filter: variants match against covered languages (own + translations');
 *   translations/revisions match their own language.
 */
export function filterBranches({
  branches,
  activeFilters,
  activeLanguages,
  showArchived,
}: FilterBranchesArgs): GraphBranch[] {
  const typeWhitelist: BranchType[] =
    activeFilters.size === 0
      ? ["variant", "translation", "revision"]
      : (["variant", "translation", "revision"] as BranchType[]).filter((type) =>
          activeFilters.has(type),
        );
  const filterToTranslated = activeFilters.has("translation");

  // Index translations by variant id (unfiltered, for language coverage)
  const allTranslationsByVariantId = new Map<string, GraphBranch[]>();
  branches.forEach((b) => {
    if (b.branchType === "translation" && b.sourceBranchId) {
      const existing = allTranslationsByVariantId.get(b.sourceBranchId) ?? [];
      allTranslationsByVariantId.set(b.sourceBranchId, [...existing, b]);
    }
  });

  const visibleVariantIds = new Set<string>();

  const visibleVariants = branches.filter((b) => {
    if (b.branchType !== "variant") return false;
    if (!showArchived && b.isArchived) return false;
    if (!typeWhitelist.includes("variant") && !filterToTranslated) return false;

    const allTranslations = allTranslationsByVariantId.get(b.id) ?? [];
    const coveredLanguages = [
      ...new Set([b.language, ...allTranslations.map((tr) => tr.language)]),
    ];

    if (activeLanguages.size > 0 && !coveredLanguages.some((l) => activeLanguages.has(l))) {
      return false;
    }
    if (filterToTranslated && allTranslations.length === 0) {
      return false;
    }
    visibleVariantIds.add(b.id);
    return true;
  });

  const visibleTranslations = branches.filter((b) => {
    if (b.branchType !== "translation") return false;
    if (!typeWhitelist.includes("translation")) return false;
    if (!showArchived && b.isArchived) return false;
    if (activeLanguages.size > 0 && !activeLanguages.has(b.language)) return false;
    // Only keep translations whose parent variant is visible
    if (b.sourceBranchId && !visibleVariantIds.has(b.sourceBranchId)) return false;
    return true;
  });

  const visibleRevisions = branches.filter((b) => {
    if (b.branchType !== "revision") return false;
    if (!typeWhitelist.includes("revision")) return false;
    if (!showArchived && b.isArchived) return false;
    if (activeLanguages.size > 0 && !activeLanguages.has(b.language)) return false;
    return true;
  });

  return [...visibleVariants, ...visibleTranslations, ...visibleRevisions];
}

interface FilterGraphDataArgs {
  branches: GraphBranch[];
  commits: GraphCommit[];
  edges: GraphEdge[];
  filteredBranches: GraphBranch[];
}

/**
 * Filters commits and edges to those reachable from any visible branch head.
 * Used so the graph only renders the lanes and commits relevant to the
 * currently-filtered branch set.
 */
export function filterGraphData({
  commits,
  edges,
  filteredBranches,
}: FilterGraphDataArgs): { commits: GraphCommit[]; edges: GraphEdge[] } {
  const visibleCommitIds = new Set<string>();
  filteredBranches.forEach((branch) => {
    const reachable = getReachableCommitIds(branch.headCommitId ?? null, edges);
    reachable.forEach((id) => visibleCommitIds.add(id));
  });

  return {
    commits: commits.filter((c) => visibleCommitIds.has(c.id)),
    edges: edges.filter(
      (e) => visibleCommitIds.has(e.commitId) && visibleCommitIds.has(e.parentCommitId),
    ),
  };
}

interface HistoryBranchFiltersProps {
  branches: GraphBranch[];
  activeFilters: Set<BranchFilterType>;
  activeLanguages: Set<string>;
  showArchived: boolean;
  onToggleFilter: (filter: BranchFilterType) => void;
  onToggleLanguage: (lang: string) => void;
  onToggleShowArchived: () => void;
}

export function HistoryBranchFilters({
  branches,
  activeFilters,
  activeLanguages,
  showArchived,
  onToggleFilter,
  onToggleLanguage,
  onToggleShowArchived,
}: HistoryBranchFiltersProps) {
  const { t } = useTranslation("common");

  const allLanguages = useMemo(() => {
    const langs = new Set<string>();
    branches.forEach((b) => langs.add(b.language));
    return [...langs].sort();
  }, [branches]);

  const typeFilterChips: Array<{ key: BranchType; label: string }> = [
    { key: "variant", label: t("resume.compare.tree.filterVariant") },
    { key: "translation", label: t("resume.compare.tree.filterTranslation") },
    { key: "revision", label: t("resume.compare.tree.filterRevision") },
  ];

  return (
    <Box
      data-testid="history-branch-filters"
      sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <FilterListIcon fontSize="small" sx={{ color: "text.secondary", fontSize: 16 }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {t("resume.compare.tree.filterLabel")}
        </Typography>
      </Box>
      {typeFilterChips.map(({ key, label }) => (
        <Chip
          key={key}
          label={label}
          size="small"
          clickable
          variant={activeFilters.has(key) ? "filled" : "outlined"}
          color={activeFilters.has(key) ? "primary" : "default"}
          onClick={() => onToggleFilter(key)}
        />
      ))}
      <Chip
        label={t("resume.compare.tree.filterArchived")}
        size="small"
        clickable
        variant={showArchived ? "filled" : "outlined"}
        color={showArchived ? "warning" : "default"}
        icon={<ArchiveIcon />}
        onClick={onToggleShowArchived}
      />
      {allLanguages.length > 1 &&
        allLanguages.map((lang) => (
          <Chip
            key={lang}
            label={lang.toUpperCase()}
            size="small"
            clickable
            icon={<LanguageIcon />}
            variant={activeLanguages.has(lang) ? "filled" : "outlined"}
            color={activeLanguages.has(lang) ? "secondary" : "default"}
            onClick={() => onToggleLanguage(lang)}
          />
        ))}
    </Box>
  );
}
