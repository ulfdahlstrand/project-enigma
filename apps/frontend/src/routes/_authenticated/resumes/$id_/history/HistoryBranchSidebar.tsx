import { useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ArchiveIcon from "@mui/icons-material/Archive";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListIcon from "@mui/icons-material/FilterList";
import LanguageIcon from "@mui/icons-material/Language";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
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

// ---------------------------------------------------------------------------
// BranchRow — single selectable branch item
// ---------------------------------------------------------------------------

interface BranchRowProps {
  branch: GraphBranch;
  selectedBranchId: string;
  indent: number;
  icon: React.ReactNode;
  primaryText: string;
  secondaryText?: string | undefined;
  onSelect: (branchId: string) => void;
  onArchive: (branchId: string, isArchived: boolean) => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: (e: MouseEvent) => void;
}

function BranchRow({
  branch,
  selectedBranchId,
  indent,
  icon,
  primaryText,
  secondaryText,
  onSelect,
  onArchive,
  expandable,
  expanded,
  onToggleExpand,
}: BranchRowProps) {
  const { t } = useTranslation("common");
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const isSelected = branch.id === selectedBranchId;

  return (
    <>
      <Box
        component="div"
        role="option"
        aria-selected={isSelected}
        data-branch-id={branch.id}
        tabIndex={isSelected ? 0 : -1}
        onClick={() => onSelect(branch.id)}
        sx={{
          display: "flex",
          alignItems: "center",
          pl: 1 + indent * 1.5,
          pr: 0.5,
          py: 0.5,
          gap: 0.5,
          cursor: "pointer",
          bgcolor: isSelected ? "action.selected" : "transparent",
          color: isSelected ? "primary.main" : "text.primary",
          "&:hover": { bgcolor: isSelected ? "action.selected" : "action.hover" },
          "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: -2 },
          userSelect: "none",
        }}
      >
        <Box sx={{ color: isSelected ? "primary.main" : "text.secondary", display: "flex", flexShrink: 0 }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={isSelected ? 600 : 400}
            noWrap
            sx={{ fontSize: "0.8125rem" }}
          >
            {primaryText}
          </Typography>
          {secondaryText && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {secondaryText}
            </Typography>
          )}
        </Box>
        {!branch.isMain && (
          <IconButton
            size="small"
            aria-label={t("resume.compare.tree.branchActions")}
            onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
            sx={{ p: 0.25, opacity: 0.5, "&:hover": { opacity: 1 }, flexShrink: 0 }}
          >
            <MoreVertIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
        {expandable && (
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onToggleExpand?.(e); }}
            sx={{ p: 0.25, flexShrink: 0 }}
          >
            {expanded ? <ExpandMoreIcon sx={{ fontSize: 14 }} /> : <ChevronRightIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        )}
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            onArchive(branch.id, !branch.isArchived);
            setMenuAnchor(null);
          }}
        >
          {branch.isArchived ? (
            <><UnarchiveIcon fontSize="small" sx={{ mr: 1 }} />{t("resume.compare.tree.unarchive")}</>
          ) : (
            <><ArchiveIcon fontSize="small" sx={{ mr: 1 }} />{t("resume.compare.tree.archive")}</>
          )}
        </MenuItem>
      </Menu>
    </>
  );
}

// ---------------------------------------------------------------------------
// VariantGroup — variant row + collapsible translations
// ---------------------------------------------------------------------------

interface VariantGroupProps {
  variant: GraphBranch;
  translations: GraphBranch[];
  selectedBranchId: string;
  onSelect: (branchId: string) => void;
  onArchive: (branchId: string, isArchived: boolean) => void;
}

function VariantGroup({ variant, translations, selectedBranchId, onSelect, onArchive }: VariantGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const allLanguages = [...new Set([variant.language, ...translations.map((t) => t.language)])];

  return (
    <>
      <BranchRow
        branch={variant}
        selectedBranchId={selectedBranchId}
        indent={0}
        icon={<AccountTreeIcon sx={{ fontSize: 16 }} />}
        primaryText={variant.name}
        secondaryText={allLanguages.map((l) => l.toUpperCase()).join(" / ")}
        onSelect={onSelect}
        onArchive={onArchive}
        expandable={translations.length > 0}
        expanded={expanded}
        onToggleExpand={() => setExpanded((p) => !p)}
      />
      {translations.length > 0 && (
        <Collapse in={expanded} unmountOnExit>
          {translations.map((tr) => (
            <BranchRow
              key={tr.id}
              branch={tr}
              selectedBranchId={selectedBranchId}
              indent={1.5}
              icon={<LanguageIcon sx={{ fontSize: 14 }} />}
              primaryText={tr.language.toUpperCase()}
              secondaryText={tr.name !== tr.language ? tr.name : undefined}
              onSelect={onSelect}
              onArchive={onArchive}
            />
          ))}
        </Collapse>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// HistoryBranchSidebar
// ---------------------------------------------------------------------------

export function HistoryBranchSidebar({
  branches,
  selectedBranchId,
  onSelect,
  onArchive,
}: HistoryBranchSidebarProps) {
  const { t } = useTranslation("common");
  const listRef = useRef<HTMLDivElement | null>(null);
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

  function passesFilters(branch: GraphBranch): boolean {
    if (!showArchived && branch.isArchived) return false;
    if (activeFilters.size > 0 && !activeFilters.has(branch.branchType as FilterType)) return false;
    if (activeLanguages.size > 0 && !activeLanguages.has(branch.language)) return false;
    return true;
  }

  const { variantGroups, revisionBranches } = useMemo(() => {
    const translationsByVariantId = new Map<string, GraphBranch[]>();
    branches.forEach((b) => {
      if (b.branchType === "translation" && b.sourceBranchId) {
        const existing = translationsByVariantId.get(b.sourceBranchId) ?? [];
        translationsByVariantId.set(b.sourceBranchId, [...existing, b]);
      }
    });

    const variants = branches.filter(
      (b) => b.branchType === "variant" && passesFilters(b),
    );

    const groups = variants
      .map((variant) => {
        const allTr = translationsByVariantId.get(variant.id) ?? [];
        const visibleTr = allTr.filter(
          (tr) =>
            (activeFilters.size === 0 || activeFilters.has("translation")) &&
            passesFilters(tr),
        );
        const coveredLangs = [...new Set([variant.language, ...allTr.map((tr) => tr.language)])];
        if (activeLanguages.size > 0 && !coveredLangs.some((l) => activeLanguages.has(l))) {
          return null;
        }
        return { variant, translations: visibleTr };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);

    const revisions = branches.filter(
      (b) => b.branchType === "revision" && passesFilters(b),
    );

    return { variantGroups: groups, revisionBranches: revisions };
  }, [branches, showArchived, activeFilters, activeLanguages]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
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

  const isEmpty = variantGroups.length === 0 && revisionBranches.length === 0;

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

      {/* Branch tree */}
      <Box
        ref={listRef}
        role="listbox"
        aria-label={t("resume.history.branchLabel")}
        onKeyDown={handleKeyDown}
        sx={{ overflowY: "auto", flex: 1 }}
      >
        {isEmpty ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {t("resume.compare.tree.noBranches")}
            </Typography>
          </Box>
        ) : (
          <>
            {variantGroups.map(({ variant, translations }) => (
              <VariantGroup
                key={variant.id}
                variant={variant}
                translations={translations}
                selectedBranchId={selectedBranchId}
                onSelect={onSelect}
                onArchive={onArchive}
              />
            ))}

            {revisionBranches.length > 0 && (
              <>
                <Divider sx={{ my: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t("resume.compare.tree.revisions")}
                  </Typography>
                </Divider>
                {revisionBranches.map((branch) => (
                  <BranchRow
                    key={branch.id}
                    branch={branch}
                    selectedBranchId={selectedBranchId}
                    indent={0}
                    icon={<LanguageIcon sx={{ fontSize: 14 }} />}
                    primaryText={branch.language.toUpperCase()}
                    secondaryText={branch.name}
                    onSelect={onSelect}
                    onArchive={onArchive}
                  />
                ))}
              </>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}
