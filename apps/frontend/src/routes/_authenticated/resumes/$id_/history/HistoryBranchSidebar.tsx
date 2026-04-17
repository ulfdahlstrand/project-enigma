import { useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ArchiveIcon from "@mui/icons-material/Archive";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LanguageIcon from "@mui/icons-material/Language";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { CommitTagWithLinkedResume } from "@cv-tool/contracts";
import type { GraphBranch } from "./history-graph-utils";
import { LanguageLinkBadge } from "./LanguageLinkBadge";

interface HistoryBranchSidebarProps {
  /** Already-filtered branches. Grouping and rendering happens here; filtering does not. */
  branches: GraphBranch[];
  selectedBranchId: string;
  /** Map from commit id → tags involving that commit. Used to render language-link badges. */
  commitTags: Map<string, CommitTagWithLinkedResume[]>;
  /** ID of the resume being viewed — used by LanguageLinkBadge to pick the "other side" of a tag. */
  currentResumeId: string;
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
  /** Tags whose source or target commit equals this branch's head commit. */
  tagsOnHead?: CommitTagWithLinkedResume[] | undefined;
  currentResumeId?: string | undefined;
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
  tagsOnHead,
  currentResumeId,
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
        {tagsOnHead && currentResumeId && tagsOnHead.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0, mr: 0.25 }}>
            {tagsOnHead.map((tag) => (
              <LanguageLinkBadge key={tag.id} tag={tag} currentResumeId={currentResumeId} />
            ))}
          </Box>
        )}
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
  commitTags: Map<string, CommitTagWithLinkedResume[]>;
  currentResumeId: string;
  onSelect: (branchId: string) => void;
  onArchive: (branchId: string, isArchived: boolean) => void;
}

function VariantGroup({ variant, translations, selectedBranchId, commitTags, currentResumeId, onSelect, onArchive }: VariantGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const variantTags = variant.headCommitId ? commitTags.get(variant.headCommitId) : undefined;

  return (
    <>
      <BranchRow
        branch={variant}
        selectedBranchId={selectedBranchId}
        indent={0}
        icon={<AccountTreeIcon sx={{ fontSize: 16 }} />}
        primaryText={variant.name}
        tagsOnHead={variantTags}
        currentResumeId={currentResumeId}
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
              primaryText={tr.name}
              tagsOnHead={tr.headCommitId ? commitTags.get(tr.headCommitId) : undefined}
              currentResumeId={currentResumeId}
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
  commitTags,
  currentResumeId,
  onSelect,
  onArchive,
}: HistoryBranchSidebarProps) {
  const { t } = useTranslation("common");
  const listRef = useRef<HTMLDivElement | null>(null);

  const { variantGroups, revisionBranches } = useMemo(() => {
    const groups = branches
      .filter((b) => b.branchType === "variant")
      .map((variant) => ({ variant, translations: [] as GraphBranch[] }));

    const revisions = branches.filter((b) => b.branchType === "revision");

    return { variantGroups: groups, revisionBranches: revisions };
  }, [branches]);

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

  const isEmpty = variantGroups.length === 0 && revisionBranches.length === 0;

  return (
    <Paper
      variant="outlined"
      data-testid="history-branch-sidebar"
      sx={{ width: 220, flexShrink: 0, overflow: "hidden", maxHeight: "100%", display: "flex", flexDirection: "column" }}
    >
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
                commitTags={commitTags}
                currentResumeId={currentResumeId}
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
                    primaryText={branch.name}
                    tagsOnHead={branch.headCommitId ? commitTags.get(branch.headCommitId) : undefined}
                    currentResumeId={currentResumeId}
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
