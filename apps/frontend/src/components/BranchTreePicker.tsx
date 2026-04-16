/**
 * BranchTreePicker — shared tree-structured branch/language/commit selector.
 *
 * Hierarchy: variant branch → language branches (translations) → commits
 *
 * Props:
 *  - showCommits (default true): render per-branch commit lists; false for history view
 *  - valueField (default "name"): whether value/onSelect use branch.name or branch.id
 *  - mergedCommitIds: Set of commit IDs reachable from a reference HEAD; branches
 *    whose headCommitId is in this set display a "merged" badge
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useState, useMemo, useRef, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ArchiveIcon from "@mui/icons-material/Archive";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CommitIcon from "@mui/icons-material/Commit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListIcon from "@mui/icons-material/FilterList";
import LanguageIcon from "@mui/icons-material/Language";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import type { ResumeBranch, ResumeCommitListItem, BranchType } from "@cv-tool/contracts";
import { useResumeCommits } from "../hooks/versioning";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BranchTreePickerProps {
  /** Button label — "From (older)" or "To (newer)". */
  label: string;
  /** Current selected ref: a branch name, branch id, or commit id. Empty = none. */
  value: string;
  /** All branches for this resume. */
  branches: ResumeBranch[];
  /** All commits (for label resolution when a commit is selected). */
  allCommits?: ResumeCommitListItem[];
  /** Called when the user selects a ref. */
  onSelect: (ref: string) => void;
  /** Called to archive or unarchive a branch. */
  onArchive: (branchId: string, isArchived: boolean) => void;
  /** Whether to show per-branch commit lists. Default: true. */
  showCommits?: boolean;
  /** Whether value/onSelect use branch.name or branch.id. Default: "name". */
  valueField?: "name" | "id";
  /**
   * Set of commit IDs reachable from a reference HEAD (e.g. main branch).
   * Branches whose headCommitId is in this set show a "merged" badge.
   */
  mergedCommitIds?: Set<string>;
}

type FilterType = BranchType | "archived";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCommitDate(createdAt: string | Date | null): string {
  if (!createdAt) return "";
  return new Date(createdAt).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function commitLabel(commit: ResumeCommitListItem): string {
  const date = formatCommitDate(commit.createdAt);
  return commit.title ? `${commit.title} (${date})` : date;
}

function getBranchValue(branch: ResumeBranch, valueField: "name" | "id"): string {
  return valueField === "id" ? branch.id : branch.name;
}

// ---------------------------------------------------------------------------
// CommitList — lazy-loaded commit list for a single branch
// ---------------------------------------------------------------------------

interface CommitListProps {
  branchId: string;
  selectedRef: string;
  onSelect: (ref: string) => void;
}

function CommitList({ branchId, selectedRef, onSelect }: CommitListProps) {
  const { data: commits = [], isLoading } = useResumeCommits(branchId);

  if (isLoading) {
    return (
      <Box sx={{ pl: 8, py: 1 }}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  if (commits.length === 0) {
    return null;
  }

  return (
    <List dense disablePadding>
      {commits.map((commit) => (
        <ListItemButton
          key={commit.id}
          selected={selectedRef === commit.id}
          onClick={() => onSelect(commit.id)}
          sx={{ pl: 8 }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <CommitIcon fontSize="small" sx={{ color: "text.disabled", fontSize: 14 }} />
          </ListItemIcon>
          <ListItemText
            primary={commitLabel(commit)}
            primaryTypographyProps={{ variant: "caption", noWrap: true }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}

// ---------------------------------------------------------------------------
// LanguageBranchNode — one translation/language row with optional expand-for-commits
// ---------------------------------------------------------------------------

interface LanguageBranchNodeProps {
  branch: ResumeBranch;
  depth: number;
  selectedRef: string;
  onSelect: (ref: string) => void;
  onArchive: (branchId: string, isArchived: boolean) => void;
  showCommits: boolean;
  valueField: "name" | "id";
  mergedCommitIds?: Set<string> | undefined;
}

function LanguageBranchNode({
  branch,
  depth,
  selectedRef,
  onSelect,
  onArchive,
  showCommits,
  valueField,
  mergedCommitIds,
}: LanguageBranchNodeProps) {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const branchValue = getBranchValue(branch, valueField);
  const isSelected = selectedRef === branchValue;
  const isMerged = Boolean(branch.headCommitId && mergedCommitIds?.has(branch.headCommitId));
  const paddingLeft = depth * 3 + 4;

  const handleToggleExpand = (e: MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  const handleSelect = () => {
    if (branch.headCommitId) {
      onSelect(branchValue);
    }
  };

  const handleMenuOpen = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => setMenuAnchor(null);

  const handleArchive = () => {
    onArchive(branch.id, !branch.isArchived);
    handleMenuClose();
  };

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={handleSelect}
        disabled={!branch.headCommitId}
        sx={{ pl: paddingLeft }}
      >
        <ListItemIcon sx={{ minWidth: 28 }}>
          <LanguageIcon fontSize="small" sx={{ fontSize: 16, color: "text.secondary" }} />
        </ListItemIcon>
        <ListItemText
          primary={branch.language.toUpperCase()}
          secondary={branch.name !== branch.language ? branch.name : undefined}
          primaryTypographyProps={{ variant: "body2", fontWeight: isSelected ? 600 : 400 }}
          secondaryTypographyProps={{ variant: "caption", noWrap: true }}
        />
        {isMerged && (
          <Tooltip title={t("resume.compare.tree.merged")}>
            <CallMergeIcon fontSize="small" sx={{ fontSize: 16, color: "success.main", mr: 0.5 }} />
          </Tooltip>
        )}
        {branch.isArchived && (
          <Tooltip title={t("resume.compare.tree.archived")}>
            <ArchiveIcon fontSize="small" sx={{ fontSize: 16, color: "text.disabled", mr: 0.5 }} />
          </Tooltip>
        )}
        <Tooltip title={t("resume.compare.tree.branchActions")}>
          <IconButton size="small" onClick={handleMenuOpen} sx={{ p: 0.25 }}>
            <MoreVertIcon fontSize="small" sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        {showCommits && (
          <Tooltip
            title={expanded ? t("resume.compare.tree.collapse") : t("resume.compare.tree.expand")}
          >
            <IconButton size="small" onClick={handleToggleExpand} sx={{ p: 0.25 }}>
              {expanded ? (
                <ExpandMoreIcon fontSize="small" sx={{ fontSize: 16 }} />
              ) : (
                <ChevronRightIcon fontSize="small" sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </ListItemButton>

      {showCommits && (
        <Collapse in={expanded} unmountOnExit>
          <CommitList branchId={branch.id} selectedRef={selectedRef} onSelect={onSelect} />
        </Collapse>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={handleArchive}>
          {branch.isArchived ? (
            <>
              <UnarchiveIcon fontSize="small" sx={{ mr: 1 }} />
              {t("resume.compare.tree.unarchive")}
            </>
          ) : (
            <>
              <ArchiveIcon fontSize="small" sx={{ mr: 1 }} />
              {t("resume.compare.tree.archive")}
            </>
          )}
        </MenuItem>
      </Menu>
    </>
  );
}

// ---------------------------------------------------------------------------
// VariantBranchGroup — one variant with its language children
// ---------------------------------------------------------------------------

interface VariantBranchGroupProps {
  variant: ResumeBranch;
  /** Filtered translations to render in the expand panel. */
  translations: ResumeBranch[];
  /** All languages covered by this variant (own + all translations, for display). */
  allLanguages: string[];
  selectedRef: string;
  onSelect: (ref: string) => void;
  onArchive: (branchId: string, isArchived: boolean) => void;
  showArchived: boolean;
  showCommits: boolean;
  valueField: "name" | "id";
  mergedCommitIds?: Set<string> | undefined;
}

function VariantBranchGroup({
  variant,
  translations,
  allLanguages,
  selectedRef,
  onSelect,
  onArchive,
  showArchived,
  showCommits,
  valueField,
  mergedCommitIds,
}: VariantBranchGroupProps) {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const branchValue = getBranchValue(variant, valueField);
  const isSelected = selectedRef === branchValue;
  const isMerged = Boolean(variant.headCommitId && mergedCommitIds?.has(variant.headCommitId));
  const visibleTranslations = showArchived
    ? translations
    : translations.filter((b) => !b.isArchived);

  const handleToggleExpand = (e: MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  const handleSelect = () => {
    if (variant.headCommitId) {
      onSelect(branchValue);
    }
  };

  const handleMenuOpen = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => setMenuAnchor(null);

  const handleArchive = () => {
    onArchive(variant.id, !variant.isArchived);
    handleMenuClose();
  };

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={handleSelect}
        disabled={!variant.headCommitId}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <AccountTreeIcon fontSize="small" sx={{ fontSize: 18, color: "primary.main" }} />
        </ListItemIcon>
        <ListItemText
          primary={variant.name}
          secondary={allLanguages.map((l) => l.toUpperCase()).join(" / ")}
          primaryTypographyProps={{ variant: "body2", fontWeight: isSelected ? 600 : 500 }}
          secondaryTypographyProps={{ variant: "caption" }}
        />
        {variant.isMain && (
          <Chip
            label={t("resume.compare.tree.main")}
            size="small"
            color="primary"
            sx={{ mr: 0.5, height: 18, fontSize: 10 }}
          />
        )}
        {isMerged && !variant.isMain && (
          <Tooltip title={t("resume.compare.tree.merged")}>
            <CallMergeIcon fontSize="small" sx={{ fontSize: 16, color: "success.main", mr: 0.5 }} />
          </Tooltip>
        )}
        {variant.isArchived && (
          <Tooltip title={t("resume.compare.tree.archived")}>
            <ArchiveIcon fontSize="small" sx={{ fontSize: 16, color: "text.disabled", mr: 0.5 }} />
          </Tooltip>
        )}
        {!variant.isMain && (
          <Tooltip title={t("resume.compare.tree.branchActions")}>
            <IconButton size="small" onClick={handleMenuOpen} sx={{ p: 0.25 }}>
              <MoreVertIcon fontSize="small" sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        {visibleTranslations.length > 0 && (
          <Tooltip
            title={expanded ? t("resume.compare.tree.collapse") : t("resume.compare.tree.expand")}
          >
            <IconButton size="small" onClick={handleToggleExpand} sx={{ p: 0.25 }}>
              {expanded ? (
                <ExpandMoreIcon fontSize="small" sx={{ fontSize: 16 }} />
              ) : (
                <ChevronRightIcon fontSize="small" sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </ListItemButton>

      <Collapse in={expanded} unmountOnExit>
        <LanguageBranchNode
          branch={variant}
          depth={2}
          selectedRef={selectedRef}
          onSelect={onSelect}
          onArchive={onArchive}
          showCommits={showCommits}
          valueField={valueField}
          mergedCommitIds={mergedCommitIds}
        />
        {visibleTranslations.map((translation) => (
          <LanguageBranchNode
            key={translation.id}
            branch={translation}
            depth={2}
            selectedRef={selectedRef}
            onSelect={onSelect}
            onArchive={onArchive}
            showCommits={showCommits}
            valueField={valueField}
            mergedCommitIds={mergedCommitIds}
          />
        ))}
      </Collapse>

      {!variant.isMain && (
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
          <MenuItem onClick={handleArchive}>
            {variant.isArchived ? (
              <>
                <UnarchiveIcon fontSize="small" sx={{ mr: 1 }} />
                {t("resume.compare.tree.unarchive")}
              </>
            ) : (
              <>
                <ArchiveIcon fontSize="small" sx={{ mr: 1 }} />
                {t("resume.compare.tree.archive")}
              </>
            )}
          </MenuItem>
        </Menu>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// BranchTree — the tree content rendered inside the popover
// ---------------------------------------------------------------------------

interface BranchTreeProps {
  branches: ResumeBranch[];
  selectedRef: string;
  onSelect: (ref: string) => void;
  onArchive: (branchId: string, isArchived: boolean) => void;
  showCommits: boolean;
  valueField: "name" | "id";
  mergedCommitIds?: Set<string> | undefined;
}

function BranchTree({
  branches,
  selectedRef,
  onSelect,
  onArchive,
  showCommits,
  valueField,
  mergedCommitIds,
}: BranchTreeProps) {
  const { t } = useTranslation("common");
  const [showArchived, setShowArchived] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());
  const [activeLanguages, setActiveLanguages] = useState<Set<string>>(new Set());

  const allLanguages = useMemo(() => {
    const langs = new Set<string>();
    branches.forEach((b) => langs.add(b.language));
    return [...langs].sort();
  }, [branches]);

  const toggleFilter = (filter: FilterType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  const toggleLanguage = (lang: string) => {
    setActiveLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) {
        next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
  };

  const variantGroups = useMemo(() => {
    const typeFilter: BranchType[] =
      activeFilters.size === 0
        ? ["variant", "translation", "revision"]
        : (["variant", "translation", "revision"].filter((f) =>
            activeFilters.has(f as FilterType),
          ) as BranchType[]);

    const filterToTranslated = activeFilters.has("translation");

    // Pre-index all translations by sourceBranchId (unfiltered, for language computation)
    const allTranslationsByVariantId = new Map<string, ResumeBranch[]>();
    branches.forEach((b) => {
      if (b.branchType === "translation" && b.sourceBranchId) {
        const existing = allTranslationsByVariantId.get(b.sourceBranchId) ?? [];
        allTranslationsByVariantId.set(b.sourceBranchId, [...existing, b]);
      }
    });

    const variants = branches.filter(
      (b) => b.branchType === "variant" && (showArchived || !b.isArchived),
    );

    return variants
      .map((variant) => {
        const allTranslations = allTranslationsByVariantId.get(variant.id) ?? [];
        // All languages this variant covers: its own + all its translations
        const coveredLanguages = [
          ...new Set([variant.language, ...allTranslations.map((t) => t.language)]),
        ];

        // Language filter: keep variant if any covered language matches
        if (activeLanguages.size > 0 && !coveredLanguages.some((l) => activeLanguages.has(l))) {
          return null;
        }

        // Translation filter: only show variants that have at least one translation
        if (filterToTranslated && allTranslations.length === 0) {
          return null;
        }

        // Translations to render in the tree (respects type + language + archived filters)
        const visibleTranslations = allTranslations.filter(
          (t) =>
            typeFilter.includes("translation") &&
            (activeLanguages.size === 0 || activeLanguages.has(t.language)) &&
            (showArchived || !t.isArchived),
        );

        return {
          variant,
          translations: visibleTranslations,
          allLanguages: coveredLanguages,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [branches, showArchived, activeFilters, activeLanguages]);

  const revisionBranches = useMemo(
    () =>
      branches.filter(
        (b) =>
          b.branchType === "revision" &&
          (showArchived || !b.isArchived) &&
          (activeFilters.size === 0 || activeFilters.has("revision")) &&
          (activeLanguages.size === 0 || activeLanguages.has(b.language)),
      ),
    [branches, showArchived, activeFilters, activeLanguages],
  );

  const typeFilterChips: Array<{ key: FilterType; label: string }> = [
    { key: "variant", label: t("resume.compare.tree.filterVariant") },
    { key: "translation", label: t("resume.compare.tree.filterTranslation") },
    { key: "revision", label: t("resume.compare.tree.filterRevision") },
  ];

  return (
    <Box sx={{ width: 360, maxHeight: 520, display: "flex", flexDirection: "column" }}>
      {/* Filter bar */}
      <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
          <FilterListIcon fontSize="small" sx={{ color: "text.secondary", fontSize: 16 }} />
          <Typography variant="caption" color="text.secondary">
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

        {/* Language filter chips — only shown if there is more than one language */}
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

      {/* Tree list */}
      <List dense disablePadding sx={{ overflowY: "auto", flex: 1 }}>
        {variantGroups.map(({ variant, translations, allLanguages: variantLanguages }) => (
          <VariantBranchGroup
            key={variant.id}
            variant={variant}
            translations={translations}
            allLanguages={variantLanguages}
            selectedRef={selectedRef}
            onSelect={onSelect}
            onArchive={onArchive}
            showArchived={showArchived}
            showCommits={showCommits}
            valueField={valueField}
            mergedCommitIds={mergedCommitIds}
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
              <LanguageBranchNode
                key={branch.id}
                branch={branch}
                depth={1}
                selectedRef={selectedRef}
                onSelect={onSelect}
                onArchive={onArchive}
                showCommits={showCommits}
                valueField={valueField}
                mergedCommitIds={mergedCommitIds}
              />
            ))}
          </>
        )}

        {variantGroups.length === 0 && revisionBranches.length === 0 && (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {t("resume.compare.tree.noBranches")}
            </Typography>
          </Box>
        )}
      </List>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// BranchTreePicker — public component
// ---------------------------------------------------------------------------

export function BranchTreePicker({
  label,
  value,
  branches,
  allCommits = [],
  onSelect,
  onArchive,
  showCommits = true,
  valueField = "name",
  mergedCommitIds,
}: BranchTreePickerProps) {
  const { t } = useTranslation("common");
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  const buttonLabel = useMemo(() => {
    if (!value) return t("resume.compare.selectPlaceholder");

    const branch =
      valueField === "id"
        ? branches.find((b) => b.id === value)
        : branches.find((b) => b.name === value);

    if (branch) {
      return `${branch.name} (${branch.language.toUpperCase()})`;
    }

    const commit = allCommits.find((c) => c.id === value);
    if (commit) {
      return commit.title
        ? `${commit.title} (${formatCommitDate(commit.createdAt)})`
        : formatCommitDate(commit.createdAt);
    }

    return value;
  }, [value, branches, allCommits, valueField, t]);

  const handleSelect = (ref: string) => {
    onSelect(ref);
    setOpen(false);
  };

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Button
          ref={anchorRef}
          variant="outlined"
          size="small"
          onClick={() => setOpen(true)}
          endIcon={<ExpandMoreIcon />}
          sx={{
            minWidth: 260,
            justifyContent: "space-between",
            textTransform: "none",
            fontWeight: 400,
          }}
        >
          <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
            {buttonLabel}
          </Typography>
        </Button>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { elevation: 3 } }}
      >
        <Paper>
          <BranchTree
            branches={branches}
            selectedRef={value}
            onSelect={handleSelect}
            onArchive={onArchive}
            showCommits={showCommits}
            valueField={valueField}
            mergedCommitIds={mergedCommitIds}
          />
        </Paper>
      </Popover>
    </>
  );
}
