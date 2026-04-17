import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ArchiveIcon from "@mui/icons-material/Archive";
import FilterListIcon from "@mui/icons-material/FilterList";
import LanguageIcon from "@mui/icons-material/Language";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { BranchType } from "@cv-tool/contracts";
import type { GraphBranch } from "./history-graph-utils";

export type BranchFilterType = BranchType | "archived";

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
