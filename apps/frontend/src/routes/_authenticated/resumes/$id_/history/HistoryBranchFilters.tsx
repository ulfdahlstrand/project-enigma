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
  /**
   * Branch IDs with at least one tagged commit reachable from the branch head.
   * Drives the "translation" (Översättningar) filter in the tag-based model.
   */
  taggedBranchIds: Set<string>;
  /**
   * Map from branch id to the set of languages reachable via commit tags on
   * that branch. Empty set (or missing entry) means no cross-language links.
   */
  branchTagLanguages: Map<string, Set<string>>;
}

/**
 * Returns the subset of branches that pass the active filters.
 *
 * Tag-based semantics (see `.claude/contexts/one-resume-per-language-tag-linked.md`):
 * - "translation" filter → branches where `taggedBranchIds.has(branch.id)`
 * - Language filter → branches where `branchTagLanguages.get(branch.id)` includes the selected language
 * - variant/revision filter → structural branch-type match (unchanged)
 * - Archived toggle → hides archived branches unless showArchived is true
 */
export function filterBranches({
  branches,
  activeFilters,
  activeLanguages,
  showArchived,
  taggedBranchIds,
  branchTagLanguages,
}: FilterBranchesArgs): GraphBranch[] {
  const noTypeFilter = activeFilters.size === 0;
  const wantVariants = noTypeFilter || activeFilters.has("variant");
  const wantTranslations = noTypeFilter || activeFilters.has("translation");
  const wantRevisions = noTypeFilter || activeFilters.has("revision");
  const translationOnly = activeFilters.has("translation") && !activeFilters.has("variant") && !activeFilters.has("revision");

  return branches.filter((b) => {
    if (!showArchived && b.isArchived) return false;

    const isTagged = taggedBranchIds.has(b.id);
    const branchLanguages = branchTagLanguages.get(b.id);

    // "translation" filter means "has cross-language tags" in the new model.
    // When only "translation" is active, require isTagged.
    if (translationOnly && !isTagged) return false;

    // Language filter: branch must have a tag linking to a resume in the selected language.
    if (activeLanguages.size > 0) {
      if (!branchLanguages || ![...branchLanguages].some((l) => activeLanguages.has(l))) {
        return false;
      }
    }

    // Structural type filter.
    if (b.branchType === "variant" && !wantVariants && !wantTranslations) return false;
    if (b.branchType === "revision" && !wantRevisions) return false;

    return true;
  });
}

interface FilterGraphDataArgs {
  branches: GraphBranch[];
  commits: GraphCommit[];
  edges: GraphEdge[];
  filteredBranches: GraphBranch[];
}

/**
 * Filters commits and edges to those reachable from any visible branch head.
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
  activeFilters: Set<BranchFilterType>;
  activeLanguages: Set<string>;
  showArchived: boolean;
  /** Languages available to filter by — derived by parent from commit tag link targets. */
  availableLanguages: string[];
  onToggleFilter: (filter: BranchFilterType) => void;
  onToggleLanguage: (lang: string) => void;
  onToggleShowArchived: () => void;
}

/**
 * Dumb filter UI. Owns only its local rendering — no data fetching, no
 * derivation of available languages. Parent passes in `availableLanguages`,
 * which it computes from the commit-tags map.
 */
export function HistoryBranchFilters({
  activeFilters,
  activeLanguages,
  showArchived,
  availableLanguages,
  onToggleFilter,
  onToggleLanguage,
  onToggleShowArchived,
}: HistoryBranchFiltersProps) {
  const { t } = useTranslation("common");

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
      {availableLanguages.length > 0 &&
        availableLanguages.map((lang) => (
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
