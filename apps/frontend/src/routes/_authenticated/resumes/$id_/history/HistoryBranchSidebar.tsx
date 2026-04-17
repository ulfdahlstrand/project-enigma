import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ArchiveIcon from "@mui/icons-material/Archive";
import FilterListIcon from "@mui/icons-material/FilterList";
import LanguageIcon from "@mui/icons-material/Language";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { BranchType } from "@cv-tool/contracts";
import type { GraphBranch } from "./history-graph-utils";

type FilterType = BranchType | "archived";

interface HistoryBranchSidebarProps {
  branches: GraphBranch[];
  selectedBranchId: string;
  onSelect: (branchId: string) => void;
  onArchive: (branchId: string, isArchived: boolean) => void;
}

export function HistoryBranchSidebar({
  branches,
  selectedBranchId,
  onSelect,
  onArchive,
}: HistoryBranchSidebarProps) {
  const { t } = useTranslation("common");
  const listRef = useRef<HTMLUListElement | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());
  const [activeLanguages, setActiveLanguages] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const allLanguages = useMemo(() => {
    const langs = new Set<string>();
    branches.forEach((b) => langs.add(b.language));
    return [...langs].sort();
  }, [branches]);

  function toggleFilter(filter: FilterType) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }

  function toggleLanguage(lang: string) {
    setActiveLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  }

  const filteredBranches = useMemo(() => {
    return branches.filter((branch) => {
      if (!showArchived && branch.isArchived) return false;
      if (activeFilters.size > 0 && !activeFilters.has(branch.branchType as FilterType)) return false;
      if (activeLanguages.size > 0 && !activeLanguages.has(branch.language)) return false;
      return true;
    });
  }, [branches, showArchived, activeFilters, activeLanguages]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    const items = listRef.current?.querySelectorAll<HTMLElement>("[role='option']");
    if (!items || items.length === 0) return;

    const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const branchId = items[currentIndex]?.getAttribute("data-branch-id");
      if (branchId) onSelect(branchId);
    }
  }

  const typeFilterChips: Array<{ key: BranchType; label: string }> = [
    { key: "variant", label: t("resume.compare.tree.filterVariant") },
    { key: "translation", label: t("resume.compare.tree.filterTranslation") },
    { key: "revision", label: t("resume.compare.tree.filterRevision") },
  ];

  return (
    <Paper
      variant="outlined"
      data-testid="history-branch-sidebar"
      sx={{ width: 220, flexShrink: 0, overflow: "hidden", maxHeight: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Filter section */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
          <FilterListIcon fontSize="small" sx={{ color: "text.secondary", fontSize: 14 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {t("resume.compare.tree.filterLabel")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {typeFilterChips.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              size="small"
              clickable
              variant={activeFilters.has(key) ? "filled" : "outlined"}
              color={activeFilters.has(key) ? "primary" : "default"}
              onClick={() => toggleFilter(key)}
            />
          ))}
          <Chip
            label={t("resume.compare.tree.filterArchived")}
            size="small"
            clickable
            variant={showArchived ? "filled" : "outlined"}
            color={showArchived ? "warning" : "default"}
            icon={<ArchiveIcon />}
            onClick={() => setShowArchived((prev) => !prev)}
          />
        </Box>
        {allLanguages.length > 1 && (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
            {allLanguages.map((lang) => (
              <Chip
                key={lang}
                label={lang.toUpperCase()}
                size="small"
                clickable
                icon={<LanguageIcon />}
                variant={activeLanguages.has(lang) ? "filled" : "outlined"}
                color={activeLanguages.has(lang) ? "secondary" : "default"}
                onClick={() => toggleLanguage(lang)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Branch list */}
      <Box
        component="ul"
        ref={listRef}
        role="listbox"
        aria-label={t("resume.history.branchLabel")}
        onKeyDown={handleKeyDown}
        sx={{ listStyle: "none", m: 0, p: 0, overflowY: "auto", flex: 1 }}
      >
        {filteredBranches.length === 0 ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {t("resume.compare.tree.noBranches")}
            </Typography>
          </Box>
        ) : (
          filteredBranches.map((branch) => {
            const isSelected = branch.id === selectedBranchId;
            return (
              <Box
                key={branch.id}
                component="li"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1,
                  py: 0.25,
                  gap: 0.5,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Box
                  component="div"
                  role="option"
                  aria-selected={isSelected}
                  data-branch-id={branch.id}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => onSelect(branch.id)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    cursor: "pointer",
                    borderRadius: 1,
                    px: 1,
                    py: 0.75,
                    color: isSelected ? "primary.main" : "text.primary",
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: "0.875rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    bgcolor: isSelected ? "action.selected" : "transparent",
                    userSelect: "none",
                    "&:focus-visible": {
                      outline: 2,
                      outlineColor: "primary.main",
                      outlineOffset: -2,
                    },
                  }}
                >
                  {branch.name}
                </Box>
                {!branch.isMain && (
                  <Tooltip
                    title={
                      branch.isArchived
                        ? t("resume.compare.tree.unarchive")
                        : t("resume.compare.tree.archive")
                    }
                  >
                    <IconButton
                      size="small"
                      aria-label={branch.isArchived ? t("resume.compare.tree.unarchive") : t("resume.compare.tree.archive")}
                      onClick={() => onArchive(branch.id, !branch.isArchived)}
                      sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                    >
                      {branch.isArchived ? <UnarchiveIcon fontSize="inherit" /> : <ArchiveIcon fontSize="inherit" />}
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Paper>
  );
}
