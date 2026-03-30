/**
 * /resumes/$id route — resume detail rendered as A4 document pages.
 *
 * Page 1 — Cover: employee name, consultant title, presentation paragraphs,
 *   special-skills box (summary + top-5 highlighted assignments as bullets).
 * Page 2 — Assignments: full assignments table (only if data exists).
 *
 * Data fetching: TanStack Query useQuery + oRPC client.
 * Styling: MUI sx prop only — no .css/.scss files, no style={{ }} props.
 * i18n: all visible text via useTranslation("common").
 */
import { z } from "zod";
import { toQuarter, sortAssignments } from "@cv-tool/utils";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useLayoutEffect, useEffect } from "react";
import type { ReactNode, RefObject } from "react";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import AdjustIcon from "@mui/icons-material/Adjust";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Chip from "@mui/material/Chip";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import Grow from "@mui/material/Grow";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { orpc } from "../../../orpc-client";
import { useCloseAIConversation } from "../../../hooks/ai-assistant";
import {
  resumeBranchesKey,
  resumeBranchHistoryGraphKey,
  useFinaliseResumeBranch,
  useForkResumeBranch,
  useResumeCommits,
} from "../../../hooks/versioning";
import RouterButton from "../../../components/RouterButton";
import { PageHeader } from "../../../components/layout/PageHeader";
import { LoadingState, ErrorState } from "../../../components/feedback";
import { SaveVersionButton } from "../../../components/SaveVersionButton";
import { ResumeSaveSplitButton } from "../../../components/ResumeSaveSplitButton";
import { VariantSwitcher } from "../../../components/VariantSwitcher";
import { ImprovePresentationFab } from "../../../components/ai-assistant/ImprovePresentationFab";
import { AIAssistantChat } from "../../../components/ai-assistant/AIAssistantChat";
import { DiffReviewDialog } from "../../../components/ai-assistant/DiffReviewDialog";
import { FinalReview } from "../../../components/revision/FinalReview";
import {
  buildResumeRevisionActionPrompt,
  buildResumeRevisionKickoff,
  buildResumeRevisionPrompt,
} from "../../../components/ai-assistant/lib/build-resume-revision-prompt";
import { SkillsEditor } from "../../../components/SkillsEditor";
import { AssignmentEditor } from "../../../components/AssignmentEditor";
import {
  createResumeActionToolRegistry,
  createResumePlanningToolRegistry,
  type RevisionPlan,
  type RevisionWorkItems,
  type RevisionSuggestions,
} from "../../../lib/ai-tools/registries/resume-tools";
import { useAIAssistantContext } from "../../../lib/ai-assistant-context";
import type { AIToolContext, AIToolRegistry } from "../../../lib/ai-tools/types";

export const getResumeQueryKey = (id: string) => ["getResume", id] as const;


// A4 at 96 dpi
const PAGE_WIDTH = 794;
const PAGE_MIN_HEIGHT = 1123;
const PAGE_MX = "80px";
const PAGE_MY = "56px";
const HEADER_HEIGHT = 52;
const FOOTER_HEIGHT = 40;
const INLINE_REVISION_CHECKLIST_WIDTH = 300;
const INLINE_REVISION_CHAT_WIDTH = 360;
const INLINE_REVISION_BRANCH_PREFIX = "AI revision";
const INLINE_REVISION_BRANCH_NAME_MAX_LENGTH = 72;

type InlineRevisionStage = "planning" | "actions" | "finalize";

function normalizeInlineRevisionBranchLabel(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[.:;,[\]{}()]+/g, "")
    .trim();
}

function buildInlineRevisionBranchName(plan: RevisionPlan) {
  const planLead =
    normalizeInlineRevisionBranchLabel(plan.actions[0]?.title ?? "") ||
    normalizeInlineRevisionBranchLabel(plan.summary);

  if (!planLead) {
    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    return `${INLINE_REVISION_BRANCH_PREFIX} ${timestamp}`;
  }

  const branchName = `${INLINE_REVISION_BRANCH_PREFIX}: ${planLead}`;
  return branchName.length > INLINE_REVISION_BRANCH_NAME_MAX_LENGTH
    ? `${branchName.slice(0, INLINE_REVISION_BRANCH_NAME_MAX_LENGTH - 1).trimEnd()}…`
    : branchName;
}

function buildInlineRevisionSuggestionCommitMessage(suggestion: RevisionSuggestions["suggestions"][number]) {
  return `Apply AI suggestion: ${suggestion.title}`;
}

function buildInlineRevisionWorkItemAutomationMessage(workItems: RevisionWorkItems | null) {
  if (!workItems || workItems.items.length === 0) {
    return null;
  }

  const nextPendingItem = workItems.items.find((item) => item.status === "pending");
  if (!nextPendingItem) {
    return null;
  }

  return {
    key: `process-${nextPendingItem.id}`,
    message: [
      `Process only this work item now: ${nextPendingItem.id}.`,
      `Title: ${nextPendingItem.title}.`,
      `Description: ${nextPendingItem.description}.`,
      nextPendingItem.assignmentId
        ? `Inspect assignment ${nextPendingItem.assignmentId} and decide the outcome for this work item only.`
        : `Inspect the exact source text for section ${nextPendingItem.section} and decide the outcome for this work item only.`,
      "If changes are needed, create suggestions for this work item.",
      "If no changes are needed, mark this work item as no changes needed.",
      "Do not revisit completed work items.",
      "Return a tool call now.",
    ].join(" "),
  };
}

function buildInlineRevisionWorkItemsFromPlan(plan: RevisionPlan): RevisionWorkItems | null {
  if (plan.actions.length === 0) {
    return null;
  }

  return {
    summary: plan.summary,
    items: plan.actions.map((action, index) => ({
      id: action.id || `work-item-${index + 1}`,
      title: action.title,
      description: action.description,
      section: inferRevisionWorkItemSection(action),
      assignmentId: action.assignmentId,
      status: "pending" as const,
    })),
  };
}

function inferRevisionWorkItemSection(action: RevisionPlan["actions"][number]): string {
  if (action.assignmentId) {
    return "assignment";
  }

  const haystack = `${action.title} ${action.description}`.toLowerCase();

  if (haystack.includes("presentation") || haystack.includes("profil") || haystack.includes("intro")) {
    return "presentation";
  }

  if (haystack.includes("summary") || haystack.includes("sammanfatt")) {
    return "summary";
  }

  if (haystack.includes("consultant title") || haystack.includes("konsulttitel") || haystack.includes("title")) {
    return "consultantTitle";
  }

  if (haystack.includes("skill")) {
    return "skills";
  }

  return "presentation";
}

function appendUniqueRevisionSuggestions(
  existing: RevisionSuggestions | null,
  incoming: RevisionSuggestions,
): RevisionSuggestions {
  if (!existing) {
    return incoming;
  }

  const nextSuggestions = [...existing.suggestions];

  for (const suggestion of incoming.suggestions) {
    const existingIndex = nextSuggestions.findIndex((item) => item.id === suggestion.id);

    if (existingIndex >= 0) {
      nextSuggestions[existingIndex] = suggestion;
    } else {
      nextSuggestions.push(suggestion);
    }
  }

  return {
    summary: incoming.summary || existing.summary,
    suggestions: nextSuggestions,
  };
}

function markWorkItemsCompletedFromSuggestions(
  workItems: RevisionWorkItems | null,
  suggestions: RevisionSuggestions,
): RevisionWorkItems | null {
  if (!workItems) {
    return workItems;
  }

  const completedIds = new Set<string>();

  for (const suggestion of suggestions.suggestions) {
    const prefixedWorkItemId = suggestion.id.split(":")[0] ?? suggestion.id;
    if (workItems.items.some((item) => item.id === prefixedWorkItemId)) {
      completedIds.add(prefixedWorkItemId);
      continue;
    }

    const matchingItem = workItems.items.find((item) => {
      if (item.status === "completed" || item.status === "no_changes_needed") {
        return false;
      }

      if (suggestion.assignmentId && item.assignmentId) {
        return item.assignmentId === suggestion.assignmentId;
      }

      return item.section.trim().toLowerCase() === suggestion.section.trim().toLowerCase();
    });

    if (matchingItem) {
      completedIds.add(matchingItem.id);
    }
  }

  if (completedIds.size === 0) {
    return workItems;
  }

  return {
    ...workItems,
    items: workItems.items.map((item) =>
      completedIds.has(item.id) ? { ...item, status: "completed" } : item
    ),
  };
}

// How many assignments to show as bullets on the cover page
const COVER_HIGHLIGHT_COUNT = 5;
export const Route = createFileRoute("/_authenticated/resumes/$id")({
  validateSearch: z.object({
    branchId: z.string().optional(),
  }),
  component: ResumeDetailPage,
});

// ---------------------------------------------------------------------------
// DocumentPage shell — shared by all pages
// ---------------------------------------------------------------------------

interface DocumentPageProps {
  children: ReactNode;
  title: string;
  language?: string | undefined;
  page: number;
  totalPages: number;
  hideHeader?: boolean;
}

function DocumentPage({ children, title, language, page, totalPages, hideHeader = false }: DocumentPageProps) {
  return (
    <Paper
      elevation={2}
      sx={{
        width: PAGE_WIDTH,
        maxWidth: "100%",
        minHeight: PAGE_MIN_HEIGHT,
        border: "none",
        borderRadius: "2px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      {!hideHeader && (
        <Box
          sx={{
            height: HEADER_HEIGHT,
            flexShrink: 0,
            borderBottom: "1px solid transparent",
            px: PAGE_MX,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {title}
          </Typography>
          {language && (
            <Chip label={language.toUpperCase()} size="small" sx={{ fontSize: "0.7rem", height: 20 }} />
          )}
        </Box>
      )}

      {/* Body */}
      <Box sx={{ flexGrow: 1, px: PAGE_MX, py: PAGE_MY, display: "flex", flexDirection: "column" }}>
        {children}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          height: FOOTER_HEIGHT,
          flexShrink: 0,
          borderTop: "1px solid transparent",
          px: PAGE_MX,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
          sthlm tech
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {page} / {totalPages}
        </Typography>
      </Box>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Cover page content
// ---------------------------------------------------------------------------

interface CoverPageContentProps {
  employeeName: string;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedAssignments: Array<{ role: string; clientName: string }>;
  presentationRef?: RefObject<HTMLDivElement | null>;
  isEditing?: boolean;
  draftTitle?: string;
  draftPresentation?: string;
  draftSummary?: string;
  onDraftTitleChange?: (v: string) => void;
  onDraftPresentationChange?: (v: string) => void;
  onDraftSummaryChange?: (v: string) => void;
}

function CoverPageContent({
  employeeName,
  consultantTitle,
  presentation,
  summary,
  highlightedAssignments,
  presentationRef,
  isEditing = false,
  draftTitle = "",
  draftPresentation = "",
  draftSummary = "",
  onDraftTitleChange,
  onDraftPresentationChange,
  onDraftSummaryChange,
}: CoverPageContentProps) {
  const { t } = useTranslation("common");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100%", pt: "200px" }}>
      <Box>
      {/* Name + title block */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h1"
          component="h1"
          sx={{ fontWeight: 700, lineHeight: 1.1, color: "text.primary" }}
        >
          {employeeName}
        </Typography>
        {isEditing ? (
          <TextField
            value={draftTitle}
            onChange={(e) => onDraftTitleChange?.(e.target.value)}
            variant="standard"
            fullWidth
            sx={{ mt: 0.5, "& input": { fontWeight: 700, fontSize: "1.25rem" } }}
          />
        ) : consultantTitle ? (
          <Typography
            variant="h3"
            component="p"
            sx={{ fontWeight: 700, color: "text.primary", mt: 0.5 }}
          >
            {consultantTitle}
          </Typography>
        ) : null}
      </Box>

      {/* Presentation paragraphs */}
      {isEditing ? (
        <TextField
          value={draftPresentation}
          onChange={(e) => onDraftPresentationChange?.(e.target.value)}
          multiline
          minRows={4}
          fullWidth
          variant="outlined"
          sx={{ mb: 3 }}
          {...(presentationRef && { inputRef: presentationRef })}
        />
      ) : presentation.length > 0 ? (
        <Box {...(presentationRef && { ref: presentationRef })} sx={{ mb: 3 }}>
          {presentation.map((para, i) => (
            <Typography key={i} variant="body1" sx={{ mb: 1, textAlign: "justify" }}>
              {para}
            </Typography>
          ))}
        </Box>
      ) : null}

      {/* Special skills + highlighted experience box */}
      {(isEditing || summary || highlightedAssignments.length > 0) && (
        <Box
          sx={{
            bgcolor: "action.hover",
            border: "none",
            borderRadius: 0,
            px: 3,
            py: 2.5,
          }}
        >
          {(isEditing || summary) && (
            <Box sx={{ mb: highlightedAssignments.length > 0 ? 2.5 : 0 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, letterSpacing: "0.08em", display: "block", mb: 0.75 }}
              >
                {t("resume.detail.specialSkillsHeading").toUpperCase()}
              </Typography>
              {isEditing ? (
                <TextField
                  value={draftSummary}
                  onChange={(e) => onDraftSummaryChange?.(e.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {summary}
                </Typography>
              )}
            </Box>
          )}

          {highlightedAssignments.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, letterSpacing: "0.08em", display: "block", mb: 0.75 }}
              >
                {t("resume.detail.highlightedExperienceHeading").toUpperCase()}
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {highlightedAssignments.map((a, i) => (
                  <Typography
                    key={i}
                    component="li"
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.25 }}
                  >
                    {a.role} hos {a.clientName}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Skills page content
// ---------------------------------------------------------------------------

interface SkillsPageContentProps {
  employeeName: string;
  skills: Array<{ id: string; name: string; category: string | null; sortOrder?: number }>;
  degrees: string[];
  certifications: string[];
  languages: string[];
}

function SkillsPageContent({
  employeeName,
  skills,
  degrees,
  certifications,
  languages,
}: SkillsPageContentProps) {
  const { t } = useTranslation("common");

  // Group skills by category; null/empty category → key ""
  // Track min sortOrder per category to preserve user-defined ordering
  const grouped = skills.reduce<Record<string, { names: string[]; minSortOrder: number }>>((acc, skill) => {
    const key = skill.category?.trim() || "";
    const so = skill.sortOrder ?? 0;
    const existing = acc[key];
    return {
      ...acc,
      [key]: {
        names: [...(existing?.names ?? []), skill.name],
        minSortOrder: existing ? Math.min(existing.minSortOrder, so) : so,
      },
    };
  }, {});

  const categories = Object.entries(grouped)
    .sort(([a, aData], [b, bData]) => {
      if (a === "") return 1;   // uncategorised to the end
      if (b === "") return -1;
      const diff = aData.minSortOrder - bData.minSortOrder;
      return diff !== 0 ? diff : a.localeCompare(b);
    })
    .map(([label, { names }]) => [label, names] as [string, string[]]);

  // Split categories across two columns (~half each)
  const mid = Math.ceil(categories.length / 2);
  const leftCategories = categories.slice(0, mid);
  const rightCategories = categories.slice(mid);

  const hasOther = degrees.length > 0 || certifications.length > 0 || languages.length > 0;

  const CategoryBlock = ({ label, skillNames }: { label: string; skillNames: string[] }) => (
    <Box sx={{ mb: 2.5 }}>
      <Box
        sx={{
          bgcolor: "action.hover",
          px: 1.5,
          py: 0.75,
          mb: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: "0.06em", display: "block" }}
        >
          {label.toUpperCase()}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, fontSize: "0.75rem" }}>
        {skillNames.join(", ")}
      </Typography>
    </Box>
  );

  return (
    <Box>
      {/* Name + "Konsultprofil" label */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h2" component="p" sx={{ fontWeight: 700, color: "text.primary", lineHeight: 1.1 }}>
          {employeeName}
        </Typography>
        <Typography variant="h3" color="text.primary">
          {t("resume.detail.consultantProfileLabel")}
        </Typography>
      </Box>

      {/* Two-column skill categories */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, alignItems: "start" }}>
        {/* Left column */}
        <Box>
          {leftCategories.map(([cat, names]) => (
            <CategoryBlock
              key={cat}
              label={cat || t("resume.detail.skillsHeading")}
              skillNames={names}
            />
          ))}
        </Box>

        {/* Right column: remaining categories + Övrigt */}
        <Box>
          {rightCategories.map(([cat, names]) => (
            <CategoryBlock
              key={cat}
              label={cat || t("resume.detail.skillsHeading")}
              skillNames={names}
            />
          ))}

          {hasOther && (
            <Box sx={{ mt: rightCategories.length > 0 ? 1 : 0 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1.5 }}>
                {t("resume.detail.otherHeading")}
              </Typography>

              {degrees.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {t("employee.detail.educationDegrees")}
                  </Typography>
                  {degrees.map((d, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">
                      {d}
                    </Typography>
                  ))}
                </Box>
              )}

              {certifications.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {t("employee.detail.educationCertifications")}
                  </Typography>
                  {certifications.map((c, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">
                      {c}
                    </Typography>
                  ))}
                </Box>
              )}

              {languages.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {t("employee.detail.educationLanguages")}
                  </Typography>
                  {languages.map((l, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">
                      {l}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Export split button
// ---------------------------------------------------------------------------

type ExportFormat = "pdf" | "docx" | "markdown";
const EXPORT_OPTIONS: ExportFormat[] = ["pdf", "docx", "markdown"];

async function triggerDownload(format: ExportFormat, resumeId: string): Promise<void> {
  if (format === "pdf") {
    const result = await orpc.exportResumePdf({ resumeId });
    const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  } else if (format === "docx") {
    const result = await orpc.exportResumeDocx({ resumeId });
    const bytes = Uint8Array.from(atob(result.docx), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const result = await orpc.exportResumeMarkdown({ resumeId });
    const blob = new Blob([result.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function ExportSplitButton({ resumeId }: { resumeId: string }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExportFormat>("pdf");
  const anchorRef = useState<HTMLDivElement | null>(null);

  const mutation = useMutation({ mutationFn: () => triggerDownload(selected, resumeId) });

  return (
    <>
      <ButtonGroup
        variant="outlined"
        ref={(el) => { anchorRef[1](el); }}
        disabled={mutation.isPending}
      >
        <Button onClick={() => mutation.mutate()}>
          {mutation.isPending
            ? t("resume.detail.export.exporting")
            : t(`resume.detail.export.${selected}`)}
        </Button>
        <Button
          size="small"
          onClick={() => setOpen((p) => !p)}
          aria-label={t("resume.detail.export.selectFormat")}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Popper open={open} anchorEl={anchorRef[0]} placement="bottom-end" transition disablePortal>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper>
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <MenuList autoFocusItem>
                  {EXPORT_OPTIONS.map((fmt) => (
                    <MenuItem
                      key={fmt}
                      selected={fmt === selected}
                      onClick={() => {
                        setSelected(fmt);
                        setOpen(false);
                        void triggerDownload(fmt, resumeId);
                      }}
                    >
                      {t(`resume.detail.export.${fmt}`)}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}

// ---------------------------------------------------------------------------
// Edit split button — primary: edit CV, secondary: revise with AI
// ---------------------------------------------------------------------------

function EditSplitButton({
  onEdit,
  onReviseWithAi,
}: {
  onEdit: () => void;
  onReviseWithAi: () => void;
}) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const anchorRef = useState<HTMLDivElement | null>(null);

  return (
    <>
      <ButtonGroup variant="contained" ref={(el) => { anchorRef[1](el); }}>
        <Button startIcon={<EditIcon />} onClick={onEdit}>
          {t("resume.detail.editButton")}
        </Button>
        <Button
          size="small"
          onClick={() => setOpen((p) => !p)}
          aria-label={t("resume.detail.editMenuLabel")}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Popper open={open} anchorEl={anchorRef[0]} placement="bottom-end" transition disablePortal sx={{ zIndex: 1300 }}>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper>
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <MenuList autoFocusItem>
                  <MenuItem
                    onClick={() => {
                      setOpen(false);
                      onReviseWithAi();
                    }}
                  >
                    {t("revision.reviseButton")}
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}

function InlineRevisionChecklist({
  stage,
  sourceBranchName,
  branchName,
  plan,
  workItems,
  suggestions,
  selectedSuggestionId,
  onSelectSuggestion,
  onReviewSuggestion,
  onMoveToActions,
  isMovingToActions,
  onMoveToFinalize,
  isReadyToFinalize,
  isPreparingFinalize,
  onBackToActions,
}: {
  stage: InlineRevisionStage;
  sourceBranchName: string;
  branchName: string;
  plan: RevisionPlan | null;
  workItems: RevisionWorkItems | null;
  suggestions: RevisionSuggestions["suggestions"];
  selectedSuggestionId: string | null;
  onSelectSuggestion: (suggestionId: string) => void;
  onReviewSuggestion: (suggestionId: string) => void;
  onMoveToActions: () => void;
  isMovingToActions: boolean;
  onMoveToFinalize: () => void;
  isReadyToFinalize: boolean;
  isPreparingFinalize: boolean;
  onBackToActions: () => void;
}) {
  const { t } = useTranslation("common");
  const reviewedSuggestions = suggestions.filter((suggestion) => suggestion.status !== "pending");
  const acceptedSuggestions = suggestions.filter((suggestion) => suggestion.status === "accepted");
  const completedWorkItems = workItems?.items.filter((item) => item.status !== "pending" && item.status !== "in_progress") ?? [];
  const planDoneCount = plan?.actions.filter((action) => action.status === "done").length ?? 0;
  const suggestionHandledCount = suggestions.filter((suggestion) => suggestion.status !== "pending").length;
  const progressCount = stage === "actions"
    ? (workItems?.items.length ? completedWorkItems.length : suggestionHandledCount)
    : planDoneCount;
  const progressTotal =
    stage === "actions"
      ? (workItems?.items.length ?? suggestions.length)
      : plan?.actions.length ?? 0;
  const progressWidth = progressTotal > 0 ? (progressCount / progressTotal) * 100 : 0;
  const getPlanStatusKey = (status: RevisionPlan["actions"][number]["status"]) => {
    if (status === "pending" && stage !== "planning") {
      return "planned";
    }

    return status;
  };
  const getPlanStatusColor = (status: RevisionPlan["actions"][number]["status"]) => {
    if (status === "done") {
      return "success" as const;
    }
    if (status === "pending" && stage !== "planning") {
      return "primary" as const;
    }

    return "default" as const;
  };
  const renderStatusIcon = (status: "pending" | "done" | "accepted" | "dismissed", isSelected = false) => {
    if (status === "done" || status === "accepted") {
      return <CheckCircleIcon fontSize="small" sx={{ color: "success.main" }} />;
    }
    if (status === "dismissed") {
      return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "text.disabled" }} />;
    }
    if (isSelected) {
      return <AdjustIcon fontSize="small" sx={{ color: "primary.main" }} />;
    }
    return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "text.disabled" }} />;
  };

  return (
    <Paper
      sx={{
        width: "100%",
        flexShrink: 0,
        borderRadius: 0,
        boxShadow: 0,
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
          {stage === "actions"
            ? `${reviewedSuggestions.length}/${suggestions.length} ${t("revision.inline.suggestionsTitle").toLowerCase()}`
            : `${planDoneCount}/${plan?.actions.length ?? 0} ${t("revision.inline.checklistTitle").toLowerCase()}`
          }
        </Typography>
        <Box sx={{ height: 4, bgcolor: "divider", borderRadius: 2, overflow: "hidden" }}>
          <Box
            sx={{
              height: "100%",
              width: `${progressWidth}%`,
              bgcolor: stage === "actions" ? "primary.main" : "success.main",
              borderRadius: 2,
              transition: "width 0.2s ease",
            }}
          />
        </Box>
        <Box sx={{ mt: 1.25, display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <Typography variant="subtitle2">{t("revision.inline.checklistTitle")}</Typography>
          <Chip
            size="small"
            color="primary"
            variant={stage === "planning" ? "filled" : "outlined"}
            label={t(`revision.inline.stage.${stage}`)}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
          {stage === "planning"
            ? sourceBranchName
            : `${sourceBranchName} -> ${branchName}`}
        </Typography>
      </Box>
      <Divider />
      {stage === "finalize" ? (
        <>
          <Box sx={{ p: 1.5 }}>
            <Typography variant="subtitle2">{t("revision.inline.finalizeTitle")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t("revision.inline.finalizeDescription", {
                accepted: acceptedSuggestions.length,
                reviewed: reviewedSuggestions.length,
                total: suggestions.length,
              })}
            </Typography>
          </Box>
          {plan ? (
            <>
              <Divider />
              <Box sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("revision.inline.planSummaryTitle")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {plan.summary}
                </Typography>
              </Box>
            </>
          ) : null}
          <Divider />
          <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
            <Button variant="contained" size="small" onClick={onBackToActions}>
              {t("revision.inline.backToActionsButton")}
            </Button>
          </Box>
        </>
      ) : plan ? (
        <>
          <Box sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {t("revision.inline.planSummaryTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {plan.summary}
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ display: "flex", flexDirection: "column", p: 0.5 }}>
            {plan.actions.map((action, index) => (
              <Box
                key={action.id}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1,
                  px: 1,
                  py: 0.85,
                  borderBottom: index < plan.actions.length - 1 ? "1px solid" : "none",
                  borderColor: "divider",
                }}
              >
                <Box sx={{ mt: 0.1, display: "flex", alignItems: "center" }}>
                  {renderStatusIcon(action.status === "done" ? "done" : "pending")}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                    {action.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
                    {action.description}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      mt: 0.4,
                      color: getPlanStatusKey(action.status) === "done" ? "success.main" : "text.disabled",
                    }}
                  >
                    {t(`revision.inline.planStatus.${getPlanStatusKey(action.status)}`)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
          {stage === "planning" && (
            <>
              <Divider />
              <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                <Button variant="contained" size="small" disabled={isMovingToActions} onClick={onMoveToActions}>
                  {isMovingToActions
                    ? t("revision.inline.preparingActionsButton")
                    : t("revision.inline.toActionsButton")}
                </Button>
              </Box>
            </>
          )}
          {stage === "actions" && (
            <>
              {workItems?.items.length ? (
                <>
                  <Divider />
                  <Box sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t("revision.inline.workItemsTitle")}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", p: 0.5 }}>
                    {workItems.items.map((item, index) => (
                      <Box
                        key={item.id}
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1,
                          px: 1,
                          py: 0.85,
                          borderBottom: index < workItems.items.length - 1 ? "1px solid" : "none",
                          borderColor: "divider",
                        }}
                      >
                        <Box sx={{ mt: 0.1, display: "flex", alignItems: "center" }}>
                          {renderStatusIcon(
                            item.status === "completed"
                              ? "accepted"
                              : item.status === "no_changes_needed"
                                ? "done"
                                : "pending",
                          )}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
                            {item.description}
                          </Typography>
                          {item.note ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
                              {item.note}
                            </Typography>
                          ) : null}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </>
              ) : null}
              <Divider />
              <Box sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("revision.inline.suggestionsTitle")}
                </Typography>
              </Box>
              {suggestions.length > 0 ? (
                <Box sx={{ display: "flex", flexDirection: "column", p: 0.5 }}>
                  {suggestions.map((suggestion, index) => (
                    <Box
                      key={suggestion.id}
                      sx={{
                        display: "block",
                        px: 1,
                        py: 0.85,
                        borderLeft: "2px solid",
                        borderBottom: index < suggestions.length - 1 ? "1px solid" : "none",
                        borderBottomColor: "divider",
                        borderLeftColor:
                          selectedSuggestionId === suggestion.id
                            ? "primary.main"
                            : suggestion.status === "accepted"
                              ? "success.main"
                              : "transparent",
                        bgcolor:
                          selectedSuggestionId === suggestion.id
                            ? "action.selected"
                            : "transparent",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                        <Button
                          fullWidth
                          variant="text"
                          onClick={() => onSelectSuggestion(suggestion.id)}
                          sx={{
                            justifyContent: "flex-start",
                            alignItems: "center",
                            textAlign: "left",
                            minWidth: 0,
                            px: 0,
                            py: 0.35,
                            textTransform: "none",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, width: "100%" }}>
                            <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                              {renderStatusIcon(
                                suggestion.status === "accepted"
                                  ? "accepted"
                                  : suggestion.status === "dismissed"
                                    ? "dismissed"
                                    : "pending",
                                selectedSuggestionId === suggestion.id,
                              )}
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{
                                minWidth: 0,
                                fontWeight: selectedSuggestionId === suggestion.id ? 700 : 600,
                                color: selectedSuggestionId === suggestion.id ? "primary.main" : "text.primary",
                                lineHeight: 1.35,
                              }}
                            >
                              {suggestion.title}
                            </Typography>
                          </Box>
                        </Button>
                        <Button
                          size="small"
                          variant={selectedSuggestionId === suggestion.id ? "contained" : "text"}
                          onClick={() => onReviewSuggestion(suggestion.id)}
                          sx={{ flexShrink: 0, minWidth: 0 }}
                        >
                          {t("revision.inline.reviewSuggestion")}
                        </Button>
                      </Box>
                      {selectedSuggestionId === suggestion.id ? (
                        <Box sx={{ mt: 0.75, pl: 4 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", whiteSpace: "normal" }}
                          >
                            {suggestion.section}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mt: 0.5, whiteSpace: "normal" }}
                          >
                            {suggestion.description}
                          </Typography>
                        </Box>
                      ) : null}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ px: 2, pb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("revision.inline.suggestionsWaitingDescription")}
                  </Typography>
                </Box>
              )}
              <Divider />
              <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!isReadyToFinalize || isPreparingFinalize}
                  onClick={onMoveToFinalize}
                >
                  {isPreparingFinalize
                    ? t("revision.inline.preparingFinalizeButton")
                    : t("revision.inline.toFinalizeButton")}
                </Button>
              </Box>
            </>
          )}
        </>
      ) : (
        <List disablePadding>
          <ListItem>
            <ListItemText
              primary={t("revision.inline.checklistWaitingTitle")}
              secondary={t("revision.inline.checklistWaitingDescription")}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={t("revision.inline.intentStatusTitle")}
              secondary={t("revision.inline.intentStatusDescription")}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={t("revision.inline.branchStatusTitle")}
              secondary={t("revision.inline.branchStatusDescription")}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={t("revision.inline.diffStatusTitle")}
              secondary={t("revision.inline.diffStatusDescription")}
            />
          </ListItem>
        </List>
      )}
    </Paper>
  );
}

function InlineRevisionChatPanel({
  stage,
  sourceBranchName,
  branchName,
  onClose,
  toolCount,
  toolRegistry,
  toolContext,
  autoStartMessage,
  automation,
  guardrail,
}: {
  stage: InlineRevisionStage;
  sourceBranchName: string;
  branchName: string;
  onClose: () => void;
  toolCount: number;
  toolRegistry: AIToolRegistry;
  toolContext: AIToolContext;
  autoStartMessage?: string | null;
  automation?: {
    key: string;
    message: string;
  } | null;
  guardrail: {
    isSatisfied: boolean;
    reminderMessage: string;
  };
}) {
  const { t } = useTranslation("common");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 2, display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6">{t("revision.inline.chatTitle")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("revision.inline.chatDescription")}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {stage === "planning"
              ? t("revision.inline.chatPlanningContext", { sourceBranchName })
              : t("revision.inline.chatActionContext", {
                  sourceBranchName,
                  branchName,
                })}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {t("revision.inline.toolsReady", { count: toolCount })}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label={t("revision.inline.closeButton")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <AIAssistantChat
          toolRegistry={toolRegistry}
          toolContext={toolContext}
          autoStartMessage={autoStartMessage}
          automation={automation}
          guardrail={guardrail}
        />
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function ResumeDetailPage() {
  const { t, i18n } = useTranslation("common");
  const { id: idParam } = useParams({ strict: false });
  const id = idParam!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { branchId: selectedBranchId } = useSearch({ strict: false }) as any as { branchId?: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    openAssistant,
    hideDrawer,
    closeAssistant,
    activeConversationId: assistantConversationId,
    entityType: assistantEntityType,
    entityId: assistantEntityId,
    toolContext: assistantToolContext,
  } = useAIAssistantContext();

  const { data: resume, isLoading, isError, error } = useQuery({
    queryKey: getResumeQueryKey(id),
    queryFn: () => orpc.getResume({ id }),
    retry: false,
  });

  const { data: branches } = useQuery({
    queryKey: resumeBranchesKey(id),
    queryFn: () => orpc.listResumeBranches({ resumeId: id }),
    enabled: !!resume,
  });

  const mainBranchId = branches?.find((b) => b.isMain)?.id ?? resume?.mainBranchId ?? null;
  const activeBranchId = selectedBranchId ?? mainBranchId ?? null;
  const activeBranch = branches?.find((b) => b.id === activeBranchId);
  const activeBranchName = activeBranch?.name ?? t("resume.variants.mainBadge");

  // When a non-main branch is active, load its head commit snapshot
  const isSnapshotMode = activeBranchId !== null && activeBranchId !== mainBranchId && activeBranch?.headCommitId != null;

  const { data: branchCommit, isError: isBranchCommitError } = useQuery({
    queryKey: ["getResumeCommit", activeBranch?.headCommitId],
    queryFn: () => orpc.getResumeCommit({ commitId: activeBranch!.headCommitId! }),
    enabled: isSnapshotMode,
  });

  const { data: employee } = useQuery({
    queryKey: ["getEmployee", resume?.employeeId],
    queryFn: () => orpc.getEmployee({ id: resume!.employeeId }),
    enabled: !!resume?.employeeId,
  });

  const { data: liveAssignments = [] } = useQuery({
    queryKey: ["listBranchAssignmentsFull", activeBranchId],
    queryFn: () => orpc.listBranchAssignmentsFull({ branchId: activeBranchId! }),
    enabled: !!activeBranchId,
  });

  const { data: education = [] } = useQuery({
    queryKey: ["listEducation", resume?.employeeId],
    queryFn: () => orpc.listEducation({ employeeId: resume!.employeeId }),
    enabled: !!resume?.employeeId,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isInlineRevisionOpen, setIsInlineRevisionOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPresentation, setDraftPresentation] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const draftTitleRef = useRef("");
  const draftPresentationRef = useRef("");
  const draftSummaryRef = useRef("");
  const [inlineRevisionStage, setInlineRevisionStage] = useState<InlineRevisionStage>("planning");
  const [inlineRevisionPlan, setInlineRevisionPlan] = useState<RevisionPlan | null>(null);
  const [inlineRevisionWorkItems, setInlineRevisionWorkItems] = useState<RevisionWorkItems | null>(null);
  const [inlineRevisionSuggestions, setInlineRevisionSuggestions] = useState<RevisionSuggestions | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [reviewSuggestionId, setReviewSuggestionId] = useState<string | null>(null);
  const [isSuggestionReviewOpen, setIsSuggestionReviewOpen] = useState(false);
  const [pendingInlineRevisionActionBranchId, setPendingInlineRevisionActionBranchId] = useState<string | null>(null);
  const [inlineRevisionSourceBranchName, setInlineRevisionSourceBranchName] = useState<string | null>(null);
  const [inlineRevisionSourceBranchId, setInlineRevisionSourceBranchId] = useState<string | null>(null);
  const [inlineRevisionPlanningSessionId, setInlineRevisionPlanningSessionId] = useState<string | null>(null);
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null);
  const [isPreparingInlineRevisionFinalize, setIsPreparingInlineRevisionFinalize] = useState(false);
  const lastInlineRevisionBranchIdRef = useRef<string | null>(null);

  const updateResume = useMutation({
    mutationFn: (patch: { presentation?: string[]; consultantTitle?: string | null; summary?: string | null }) =>
      orpc.updateResume({ id, ...patch }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getResumeQueryKey(id) });
    },
  });

  const saveVersion = useMutation({
    mutationFn: (input: Parameters<typeof orpc.saveResumeVersion>[0]) => orpc.saveResumeVersion(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resumeBranchesKey(id) });
      if (activeBranch?.headCommitId) {
        await queryClient.invalidateQueries({ queryKey: ["getResumeCommit", activeBranch.headCommitId] });
      }
    },
  });
  const updateBranchAssignment = useMutation({
    mutationFn: (input: Parameters<typeof orpc.updateBranchAssignment>[0]) => orpc.updateBranchAssignment(input),
    onSuccess: async () => {
      if (activeBranchId) {
        await queryClient.invalidateQueries({ queryKey: ["listBranchAssignmentsFull", activeBranchId] });
      }
    },
  });
  const closeInlineConversation = useCloseAIConversation("resume", id);
  const forkResumeBranch = useForkResumeBranch();
  const finaliseInlineRevision = useFinaliseResumeBranch();

  const historyBranchId = activeBranchId ?? mainBranchId ?? "";
  const { data: recentCommits = [] } = useResumeCommits(historyBranchId);

  const [showFullAssignments, setShowFullAssignments] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const coverSectionRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const skillsSectionRef = useRef<HTMLDivElement>(null);
  const assignmentsSectionRef = useRef<HTMLDivElement>(null);
  const assignmentItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [fabTop, setFabTop] = useState(0);
  const [assignmentsFabTop, setAssignmentsFabTop] = useState(0);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    if (presentationRef.current) {
      setFabTop(presentationRef.current.getBoundingClientRect().top - canvasRect.top);
    }
    if (assignmentsSectionRef.current) {
      setAssignmentsFabTop(assignmentsSectionRef.current.getBoundingClientRect().top - canvasRect.top);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, resume, branchCommit, isEditing, liveAssignments]);

  useEffect(() => {
    if (isEditing) {
      const nextTitle = consultantTitle ?? "";
      const nextPresentation = presentation.join("\n\n");
      const nextSummary = summary ?? "";
      draftTitleRef.current = nextTitle;
      draftPresentationRef.current = nextPresentation;
      draftSummaryRef.current = nextSummary;
      setDraftTitle(nextTitle);
      setDraftPresentation(nextPresentation);
      setDraftSummary(nextSummary);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  useEffect(() => {
    draftTitleRef.current = draftTitle;
    draftPresentationRef.current = draftPresentation;
    draftSummaryRef.current = draftSummary;
  }, [draftPresentation, draftSummary, draftTitle]);

  useEffect(() => {
    if (!isEditing) {
      setIsInlineRevisionOpen(false);
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isInlineRevisionOpen) {
      lastInlineRevisionBranchIdRef.current = activeBranchId;
      return;
    }

    if (inlineRevisionStage === "planning") {
      lastInlineRevisionBranchIdRef.current = activeBranchId;
      return;
    }

    if (
      lastInlineRevisionBranchIdRef.current !== null &&
      activeBranchId !== lastInlineRevisionBranchIdRef.current
    ) {
      closeAssistant();
    }

    lastInlineRevisionBranchIdRef.current = activeBranchId;
  }, [
    activeBranchId,
    closeAssistant,
    inlineRevisionStage,
    isInlineRevisionOpen,
  ]);

  // Assignments always come from the live branch_assignments join — same source for all branches
  const assignments = liveAssignments;

  // Use snapshot fields when a non-main branch is active, otherwise live resume fields
  const snapshotContent = isSnapshotMode ? branchCommit?.content : null;
  const resumeTitle = snapshotContent?.title ?? resume?.title ?? "";
  const language = snapshotContent?.language ?? resume?.language;
  const consultantTitle = snapshotContent?.consultantTitle ?? resume?.consultantTitle ?? null;
  const presentation = snapshotContent?.presentation ?? resume?.presentation ?? [];
  const summary = snapshotContent?.summary ?? resume?.summary ?? null;
  const sortedAssignments = sortAssignments(assignments, (a) => a.isCurrent, (a) => a.startDate);

  const highlighted = sortedAssignments.slice(0, COVER_HIGHLIGHT_COUNT);
  const skills = snapshotContent?.skills
    ? snapshotContent.skills.map((s) => ({ id: s.name, name: s.name, category: s.category ?? null, level: null as string | null, sortOrder: 0 }))
    : (resume?.skills ?? []);
  const hasSkills = skills.length > 0;
  const showSkillsPage = hasSkills || (isEditing && !isSnapshotMode);
  const hasAssignments = assignments.length > 0;
  const resumeInspectionSnapshot = {
    resumeId: id,
    employeeName: employee?.name ?? "",
    title: resumeTitle,
    consultantTitle,
    language,
    presentation,
    summary,
    skills: skills.map((skill) => ({
      name: skill.name,
      category: skill.category ?? null,
      sortOrder: skill.sortOrder ?? 0,
    })),
    assignments: sortedAssignments.map((assignment) => ({
      id: "assignmentId" in assignment && typeof assignment.assignmentId === "string"
        ? assignment.assignmentId
        : assignment.id,
      clientName: assignment.clientName,
      role: assignment.role,
      description: "description" in assignment && typeof assignment.description === "string"
        ? assignment.description
        : "",
      technologies: "technologies" in assignment && Array.isArray(assignment.technologies)
        ? assignment.technologies
        : [],
      isCurrent: assignment.isCurrent,
      startDate: typeof assignment.startDate === "string"
        ? assignment.startDate
        : assignment.startDate instanceof Date
          ? assignment.startDate.toISOString()
          : null,
      endDate: typeof assignment.endDate === "string"
        ? assignment.endDate
        : assignment.endDate instanceof Date
          ? assignment.endDate.toISOString()
          : null,
    })),
  };
  const inlineRevisionPlanningToolRegistry = createResumePlanningToolRegistry({
    getResumeSnapshot: () => resumeInspectionSnapshot,
    setRevisionPlan: setInlineRevisionPlan,
  });
  const inlineRevisionActionToolRegistry = createResumeActionToolRegistry({
    getResumeSnapshot: () => resumeInspectionSnapshot,
    setRevisionWorkItems: setInlineRevisionWorkItems,
    markRevisionWorkItemNoChangesNeeded: ({ workItemId, note }) => {
      setInlineRevisionWorkItems((prev) => {
        if (!prev) return prev;

        const target = prev.items.find((item) => item.id === workItemId);
        if (!target || target.status === "completed" || target.status === "no_changes_needed") {
          return prev;
        }

        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === workItemId ? { ...item, status: "no_changes_needed", note } : item
          ),
        };
      });
    },
    appendRevisionSuggestions: (incoming) => {
      setInlineRevisionWorkItems((prev) => markWorkItemsCompletedFromSuggestions(prev, incoming));
      setInlineRevisionSuggestions((prev) => {
        const activeItems = (inlineRevisionWorkItems?.items ?? [])
          .filter((item) => item.status !== "completed" && item.status !== "no_changes_needed");
        const allowedIds = new Set(activeItems.map((item) => item.id));
        const filteredIncoming = {
          ...incoming,
          suggestions: incoming.suggestions.filter((suggestion) => {
            const workItemId = suggestion.id.split(":")[0] ?? suggestion.id;
            if (allowedIds.size === 0 || allowedIds.has(workItemId)) {
              return true;
            }

            return activeItems.some((item) => {
              if (suggestion.assignmentId && item.assignmentId) {
                return item.assignmentId === suggestion.assignmentId;
              }

              return item.section.trim().toLowerCase() === suggestion.section.trim().toLowerCase();
            });
          }),
        };

        if (filteredIncoming.suggestions.length === 0) {
          return prev;
        }

        return appendUniqueRevisionSuggestions(prev, filteredIncoming);
      });
    },
    setRevisionSuggestions: (incoming) => {
      setInlineRevisionWorkItems((prev) => markWorkItemsCompletedFromSuggestions(prev, incoming));
      setInlineRevisionSuggestions((prev) => appendUniqueRevisionSuggestions(prev, incoming));
    },
  });
  const inlineRevisionPlanningToolContext: AIToolContext = {
    route: "/_authenticated/resumes/$id/planning",
    entityType: "resume",
    entityId: id,
  };
  const inlineRevisionActionToolContext: AIToolContext = {
    route: "/_authenticated/resumes/$id/actions",
    entityType: "resume",
    entityId: id,
  };
  const baseCommitId = activeBranch?.headCommitId ?? null;
  const totalPages = 1 + (showSkillsPage ? 1 : 0) + (hasAssignments ? 1 : 0);
  const skillsPage = showSkillsPage ? 2 : null;
  const assignmentsPage = hasAssignments ? (hasSkills ? 3 : 2) : null;
  const inlineRevisionGuardrail =
    inlineRevisionStage === "actions"
      ? {
          isSatisfied:
            (inlineRevisionWorkItems?.items.length ?? 0) > 0 &&
            (inlineRevisionWorkItems?.items.every(
              (item) => item.status === "completed" || item.status === "no_changes_needed",
            ) ?? false),
          reminderMessage: [
            "You must use the available tools for this stage.",
            "Use the approved plan that was already provided in the kickoff context.",
            "The approved work items already define the allowed scope for this action step.",
            "Do not create extra work items or inspect assignments outside the approved plan.",
            "After inspecting the source text for a work item, your next response must be a terminal tool call for that same work item.",
            "Use set_assignment_suggestions or set_revision_suggestions if changes are needed, or mark_revision_work_item_no_changes_needed if none are needed.",
            "Do not respond with plain text between inspect_assignment or inspect_resume_section and that terminal tool call.",
            "Use inspect_assignment or inspect_resume_section to read exact source text for each work item.",
            "For each work item, either create concrete suggestions or mark it as no changes needed.",
            "Do not claim that changes are applied or complete until every work item has been handled.",
            "Return a tool call now.",
          ].join(" "),
        }
      : {
          isSatisfied: inlineRevisionPlan !== null,
          reminderMessage: [
            "You must use the available tools for this stage.",
            "Inspect the resume if needed and then create the agreed revision plan with set_revision_plan.",
            "If the user's goal is broad, such as proofreading the whole CV, the plan must include multiple section-based actions and must not collapse to a single typo or a single section.",
            "Do not continue with free-text execution updates until the plan has been created.",
            "Return a tool call now.",
        ].join(" "),
        };
  const inlineRevisionActionAutomation =
    inlineRevisionStage === "actions"
      ? buildInlineRevisionWorkItemAutomationMessage(inlineRevisionWorkItems)
      : null;

  useEffect(() => {
    if (!pendingInlineRevisionActionBranchId || !inlineRevisionPlan) {
      return;
    }

    if (activeBranchId !== pendingInlineRevisionActionBranchId) {
      return;
    }

    const planActionLines = inlineRevisionPlan.actions.map((action) => `${action.title}: ${action.description}`);
    setInlineRevisionStage("actions");
    setPendingInlineRevisionActionBranchId(null);
    setInlineRevisionWorkItems(buildInlineRevisionWorkItemsFromPlan(inlineRevisionPlan));
    setInlineRevisionSuggestions(null);

    if (
      assistantEntityType !== "resume-revision-actions" ||
      assistantEntityId !== activeBranchId ||
      assistantToolContext?.route !== inlineRevisionActionToolContext.route
    ) {
      openAssistant({
        entityType: "resume-revision-actions",
        entityId: activeBranchId,
        title: t("revision.inline.actionsConversationTitle"),
        systemPrompt: buildResumeRevisionActionPrompt(i18n.resolvedLanguage ?? i18n.language),
        originalContent: [
          resumeTitle,
          consultantTitle ?? "",
          presentation.join("\n\n"),
          summary ?? "",
        ].filter(Boolean).join("\n\n"),
        toolRegistry: inlineRevisionActionToolRegistry,
        toolContext: inlineRevisionActionToolContext,
        onAccept: () => {},
      });
    }
    hideDrawer();
  }, [
    activeBranchId,
    assistantEntityId,
    assistantEntityType,
    assistantToolContext?.route,
    consultantTitle,
    hideDrawer,
    i18n.language,
    i18n.resolvedLanguage,
    id,
    inlineRevisionActionToolContext,
    inlineRevisionActionToolRegistry,
    inlineRevisionPlan,
    openAssistant,
    pendingInlineRevisionActionBranchId,
    presentation,
    resumeTitle,
    summary,
    t,
  ]);

  if (isLoading) return <LoadingState label={t("resume.detail.loading")} />;

  if (isError) {
    const isNotFound =
      error != null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "NOT_FOUND";

    return <ErrorState message={isNotFound ? t("resume.detail.notFound") : t("resume.detail.error")} />;
  }

  if (isSnapshotMode && isBranchCommitError) {
    return <ErrorState message={t("resume.detail.error")} />;
  }

  const buildDraftPatch = () => {
    return {
      consultantTitle: draftTitle.trim() || null,
      presentation: draftPresentation.split(/\n\n+/).map((p) => p.trim()).filter(Boolean),
      summary: draftSummary.trim() || null,
    };
  };

  const buildDraftPatchFromValues = (title: string, presentationValue: string, summaryValue: string) => ({
    consultantTitle: title.trim() || null,
    presentation: presentationValue.split(/\n\n+/).map((p) => p.trim()).filter(Boolean),
    summary: summaryValue.trim() || null,
  });

  const getSuggestionOriginalText = (suggestion: RevisionSuggestions["suggestions"][number]) => {
    const section = suggestion.section.trim().toLowerCase();

    if (suggestion.assignmentId) {
      const matchingAssignment = sortedAssignments.find((assignment) => {
        const assignmentIdentityId =
          "assignmentId" in assignment && typeof assignment.assignmentId === "string"
            ? assignment.assignmentId
            : assignment.id;
        return assignmentIdentityId === suggestion.assignmentId;
      });

      if (
        matchingAssignment &&
        "description" in matchingAssignment &&
        typeof matchingAssignment.description === "string"
      ) {
        return matchingAssignment.description;
      }
    }

    if (
      section.includes("title") ||
      section.includes("titel") ||
      section.includes("consultant")
    ) {
      return consultantTitle ?? "";
    }

    if (
      section.includes("presentation") ||
      section.includes("profil") ||
      section.includes("intro")
    ) {
      return presentation.join("\n\n");
    }

    if (
      section.includes("summary") ||
      section.includes("sammanfatt")
    ) {
      return summary ?? "";
    }

    if (
      section.includes("assignment") ||
      section.includes("uppdrag") ||
      section.includes("experience")
    ) {
      const matchingAssignment = sortedAssignments.find((assignment) => {
        const client = assignment.clientName.toLowerCase();
        const role = assignment.role.toLowerCase();
        return section.includes(client) || section.includes(role);
      });

      if (matchingAssignment && "description" in matchingAssignment && typeof matchingAssignment.description === "string") {
        return matchingAssignment.description;
      }
    }

    return "";
  };

  const applySuggestionTextToDraft = (suggestion: RevisionSuggestions["suggestions"][number]) => {
    const section = suggestion.section.trim().toLowerCase();
    const suggestedText = suggestion.suggestedText.trim();
    let nextTitle = draftTitleRef.current;
    let nextPresentation = draftPresentationRef.current;
    let nextSummary = draftSummaryRef.current;

    if (
      section.includes("title") ||
      section.includes("titel") ||
      section.includes("consultant")
    ) {
      nextTitle = suggestedText;
    } else if (
      section.includes("presentation") ||
      section.includes("profil") ||
      section.includes("intro")
    ) {
      nextPresentation = suggestedText;
    } else if (
      section.includes("summary") ||
      section.includes("sammanfatt")
    ) {
      nextSummary = suggestedText;
    } else {
      return null;
    }

    draftTitleRef.current = nextTitle;
    draftPresentationRef.current = nextPresentation;
    draftSummaryRef.current = nextSummary;
    setDraftTitle(nextTitle);
    setDraftPresentation(nextPresentation);
    setDraftSummary(nextSummary);
    return buildDraftPatchFromValues(nextTitle, nextPresentation, nextSummary);
  };

  const applySuggestionToAssignment = async (suggestion: RevisionSuggestions["suggestions"][number]) => {
    if (!suggestion.assignmentId || !activeBranchId) {
      return false;
    }

    const targetAssignment = sortedAssignments.find((assignment) => {
      const assignmentIdentityId =
        "assignmentId" in assignment && typeof assignment.assignmentId === "string"
          ? assignment.assignmentId
          : assignment.id;
      return assignmentIdentityId === suggestion.assignmentId;
    });

    if (!targetAssignment) {
      return false;
    }

    const branchAssignmentId = targetAssignment.id;
    const nextDescription = suggestion.suggestedText.trim();
    const assignmentsQueryKey = ["listBranchAssignmentsFull", activeBranchId] as const;
    const previousAssignments = queryClient.getQueryData<typeof liveAssignments>(assignmentsQueryKey);

    queryClient.setQueryData<typeof liveAssignments>(assignmentsQueryKey, (prev) =>
      (prev ?? []).map((assignment) =>
        assignment.id === branchAssignmentId
          ? { ...assignment, description: nextDescription }
          : assignment
      ),
    );

    try {
      await updateBranchAssignment.mutateAsync({
        id: branchAssignmentId,
        description: nextDescription,
      });
      await saveVersion.mutateAsync({
        branchId: activeBranchId,
        message: buildInlineRevisionSuggestionCommitMessage(suggestion),
      });
      return true;
    } catch (error) {
      queryClient.setQueryData(assignmentsQueryKey, previousAssignments);
      throw error;
    }
  };

  const approveInlineSuggestion = async (suggestionId: string) => {
    const suggestion = inlineRevisionSuggestions?.suggestions.find((item) => item.id === suggestionId);
    if (suggestion) {
      const nextPatch = applySuggestionTextToDraft(suggestion);
      if (nextPatch && activeBranchId) {
        setApplyingSuggestionId(suggestionId);
        try {
          await saveVersion.mutateAsync({
            branchId: activeBranchId,
            message: buildInlineRevisionSuggestionCommitMessage(suggestion),
            ...nextPatch,
          });
        } finally {
          setApplyingSuggestionId(null);
        }
      } else if (suggestion.assignmentId && activeBranchId) {
        setApplyingSuggestionId(suggestionId);
        try {
          await applySuggestionToAssignment(suggestion);
        } finally {
          setApplyingSuggestionId(null);
        }
      }
    }

    setSelectedSuggestionId(suggestionId);
    setInlineRevisionSuggestions((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        suggestions: prev.suggestions.map((item) =>
          item.id === suggestionId ? { ...item, status: "accepted" } : item
        ),
      };
    });
  };

  const openSuggestionReview = (suggestionId: string) => {
    setSelectedSuggestionId(suggestionId);
    setReviewSuggestionId(suggestionId);
    setIsSuggestionReviewOpen(true);
  };

  const dismissInlineSuggestion = (suggestionId: string) => {
    setSelectedSuggestionId(suggestionId);
    setInlineRevisionSuggestions((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        suggestions: prev.suggestions.map((item) =>
          item.id === suggestionId ? { ...item, status: "dismissed" } : item
        ),
      };
    });
  };

  const scrollSuggestionIntoView = (suggestionId: string) => {
    const suggestion = inlineRevisionSuggestions?.suggestions.find((item) => item.id === suggestionId);
    if (!suggestion) return;

    const section = suggestion.section.trim().toLowerCase();
    let target: HTMLElement | null = null;

    if (suggestion.assignmentId) {
      const assignmentTarget = assignmentItemRefs.current[suggestion.assignmentId];
      if (assignmentTarget) {
        setSelectedSuggestionId(suggestionId);
        assignmentTarget.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    if (section.includes("skills") || section.includes("kompetens")) {
      target = skillsSectionRef.current;
    } else if (
      section.includes("assignment") ||
      section.includes("uppdrag") ||
      section.includes("experience")
    ) {
      target = assignmentsSectionRef.current;
    } else if (
      section.includes("presentation") ||
      section.includes("profil") ||
      section.includes("summary") ||
      section.includes("sammanfatt") ||
      section.includes("title") ||
      section.includes("titel")
    ) {
      target = presentationRef.current ?? coverSectionRef.current;
    } else {
      target = coverSectionRef.current;
    }

    setSelectedSuggestionId(suggestionId);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSave = () => {
    const patch = buildDraftPatch();

    if (isSnapshotMode && activeBranchId) {
      // Branch edit: create a new commit with the overridden content — does NOT touch the live resume
      saveVersion.mutate(
        { branchId: activeBranchId, ...patch },
        { onSuccess: () => setIsEditing(false) }
      );
    } else {
      updateResume.mutate(patch, { onSuccess: () => setIsEditing(false) });
    }
  };

  const handleSaveAsNewVersion = async (name: string) => {
    if (!baseCommitId) {
      throw new Error("Missing base commit");
    }

    const patch = buildDraftPatch();
    const newBranch = await forkResumeBranch.mutateAsync({
      fromCommitId: baseCommitId,
      name,
      resumeId: id,
    });

    await saveVersion.mutateAsync({
      branchId: newBranch.id,
      ...patch,
    });

    setIsEditing(false);
    await navigate({
      to: "/resumes/$id",
      params: { id },
      search: { branchId: newBranch.id },
    });
  };

  const openInlineRevisionPlanning = () => {
    const planningSessionId = inlineRevisionPlanningSessionId ?? crypto.randomUUID();
    if (!inlineRevisionPlanningSessionId) {
      setInlineRevisionPlanningSessionId(planningSessionId);
    }

    setInlineRevisionStage("planning");
    if (
      assistantEntityType !== "resume-revision-planning" ||
      assistantEntityId !== planningSessionId ||
      assistantToolContext?.route !== inlineRevisionPlanningToolContext.route
    ) {
      openAssistant({
        entityType: "resume-revision-planning",
        entityId: planningSessionId,
        title: t("revision.inline.conversationTitle"),
        systemPrompt: buildResumeRevisionPrompt(i18n.resolvedLanguage ?? i18n.language),
        kickoffMessage: buildResumeRevisionKickoff(),
        originalContent: [
          resumeTitle,
          consultantTitle ?? "",
          presentation.join("\n\n"),
          summary ?? "",
        ].filter(Boolean).join("\n\n"),
        toolRegistry: inlineRevisionPlanningToolRegistry,
        toolContext: inlineRevisionPlanningToolContext,
        onAccept: () => {},
      });
    }
    hideDrawer();
  };

  const openInlineRevisionActions = async () => {
    if (!inlineRevisionPlan) {
      return;
    }

    if (assistantConversationId) {
      await closeInlineConversation.mutateAsync({ conversationId: assistantConversationId });
    }

    if (!baseCommitId) {
      return;
    }

    const newBranch = await forkResumeBranch.mutateAsync({
      fromCommitId: baseCommitId,
      name: buildInlineRevisionBranchName(inlineRevisionPlan),
      resumeId: id,
    });

    setPendingInlineRevisionActionBranchId(newBranch.id);
    await navigate({
      to: "/resumes/$id",
      params: { id },
      search: { branchId: newBranch.id },
      replace: true,
    });
  };

  const handleOpenInlineRevision = () => {
    setIsEditing(true);
    setIsInlineRevisionOpen(true);
    setInlineRevisionSourceBranchName(activeBranchName);
    setInlineRevisionSourceBranchId(activeBranchId);
    setInlineRevisionPlanningSessionId(crypto.randomUUID());
    setInlineRevisionPlan(null);
    setInlineRevisionWorkItems(null);
    setInlineRevisionSuggestions(null);
    setSelectedSuggestionId(null);
    setPendingInlineRevisionActionBranchId(null);
    openInlineRevisionPlanning();
  };

  const resetInlineRevisionState = () => {
    setIsInlineRevisionOpen(false);
    setIsEditing(false);
    setInlineRevisionStage("planning");
    setInlineRevisionPlan(null);
    setInlineRevisionWorkItems(null);
    setInlineRevisionSuggestions(null);
    setSelectedSuggestionId(null);
    setReviewSuggestionId(null);
    setIsSuggestionReviewOpen(false);
    setInlineRevisionSourceBranchName(null);
    setInlineRevisionSourceBranchId(null);
    setInlineRevisionPlanningSessionId(null);
    setInlineRevisionWorkItems(null);
    setPendingInlineRevisionActionBranchId(null);
    closeAssistant();
  };

  const handleCloseInlineRevision = () => {
    setIsInlineRevisionOpen(false);
    hideDrawer();
  };

  const handleExitEditing = () => {
    resetInlineRevisionState();
  };

  const hasInlineRevisionUnsavedChanges =
    draftTitle !== (consultantTitle ?? "") ||
    draftPresentation !== presentation.join("\n\n") ||
    draftSummary !== (summary ?? "");

  const isReadyToFinalize =
    (inlineRevisionWorkItems?.items.length ?? 0) > 0 &&
    (inlineRevisionWorkItems?.items.every(
      (item) => item.status === "completed" || item.status === "no_changes_needed",
    ) ?? false) &&
    (inlineRevisionSuggestions?.suggestions.every((suggestion) => suggestion.status !== "pending") ?? true);

  const handlePrepareInlineRevisionFinalize = async () => {
    if (!activeBranchId) {
      return;
    }

    setIsPreparingInlineRevisionFinalize(true);
    try {
      if (hasInlineRevisionUnsavedChanges) {
        await saveVersion.mutateAsync({
          branchId: activeBranchId,
          message: t("revision.inline.finalizeCommitMessage"),
          ...buildDraftPatch(),
        });
      }
      setInlineRevisionStage("finalize");
      hideDrawer();
    } finally {
      setIsPreparingInlineRevisionFinalize(false);
    }
  };

  const handleKeepInlineRevisionBranch = () => {
    if (!activeBranchId || !inlineRevisionSourceBranchId) {
      return;
    }

    finaliseInlineRevision.mutate(
      {
        sourceBranchId: inlineRevisionSourceBranchId,
        revisionBranchId: activeBranchId,
        action: "keep",
      },
      {
        onSuccess: async (data) => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getResumeQueryKey(id) }),
            queryClient.invalidateQueries({ queryKey: resumeBranchesKey(id) }),
            queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(id) }),
            queryClient.invalidateQueries({
              queryKey: ["listBranchAssignmentsFull", inlineRevisionSourceBranchId],
            }),
            queryClient.invalidateQueries({
              queryKey: ["listBranchAssignmentsFull", data.resultBranchId],
            }),
          ]);

          resetInlineRevisionState();
          void navigate({
            to: "/resumes/$id",
            params: { id },
            search: { branchId: data.resultBranchId },
            replace: true,
          });
        },
      }
    );
  };

  const handleMergeInlineRevisionBranch = () => {
    if (!activeBranchId || !inlineRevisionSourceBranchId) {
      return;
    }

    finaliseInlineRevision.mutate(
      {
        sourceBranchId: inlineRevisionSourceBranchId,
        revisionBranchId: activeBranchId,
        action: "merge",
      },
      {
        onSuccess: async (data) => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getResumeQueryKey(id) }),
            queryClient.invalidateQueries({ queryKey: resumeBranchesKey(id) }),
            queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(id) }),
            queryClient.invalidateQueries({
              queryKey: ["listBranchAssignmentsFull", inlineRevisionSourceBranchId],
            }),
            queryClient.invalidateQueries({
              queryKey: ["listBranchAssignmentsFull", data.resultBranchId],
            }),
          ]);

          resetInlineRevisionState();
          void navigate({
            to: "/resumes/$id",
            params: { id },
            search: data.resultBranchId === mainBranchId ? {} : { branchId: data.resultBranchId },
            replace: true,
          });
        },
      }
    );
  };

  const handleOpenHistoryPage = () => {
    void navigate({
      to: "/resumes/$id/history",
      params: { id },
      search: activeBranchId ? { branchId: activeBranchId } : {},
    });
  };

  const handleOpenComparePage = () => {
    void navigate({
      to: "/resumes/$id/compare",
      params: { id },
    });
  };

  const headerChip = isInlineRevisionOpen ? (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
      <Chip size="small" color="primary" label={t("revision.inline.modeChip")} />
      <Chip size="small" variant="outlined" label={activeBranchName} />
      {language ? <Chip label={language.toUpperCase()} size="small" /> : null}
    </Box>
  ) : (
    language ? <Chip label={language.toUpperCase()} size="small" /> : undefined
  );

  const toolbarActions = isInlineRevisionOpen ? (
    <>
      <Button variant="outlined" startIcon={<HistoryIcon />} onClick={handleOpenHistoryPage}>
        {t("revision.inline.historyButton")}
      </Button>
      <Button variant="outlined" onClick={handleOpenComparePage}>
        {t("revision.inline.compareButton")}
      </Button>
      <ResumeSaveSplitButton
        onSaveCurrent={handleSave}
        onSaveAsNewVersion={handleSaveAsNewVersion}
        canSaveAsNewVersion={baseCommitId !== null}
        isPending={
          updateResume.isPending ||
          saveVersion.isPending ||
          forkResumeBranch.isPending
        }
      />
      <Button variant="outlined" onClick={handleCloseInlineRevision}>
        {t("revision.inline.closeButton")}
      </Button>
    </>
  ) : (
    <>
      <VariantSwitcher resumeId={id} currentBranchId={activeBranchId} />
      {isEditing ? (
        <>
          <ResumeSaveSplitButton
            onSaveCurrent={handleSave}
            onSaveAsNewVersion={handleSaveAsNewVersion}
            canSaveAsNewVersion={baseCommitId !== null}
            isPending={
              updateResume.isPending ||
              saveVersion.isPending ||
              forkResumeBranch.isPending
            }
          />
          <Button variant="outlined" onClick={handleExitEditing}>
            {t("resume.edit.backButton")}
          </Button>
        </>
      ) : (
        <>
          <EditSplitButton
            onEdit={() => setIsEditing(true)}
            onReviseWithAi={handleOpenInlineRevision}
          />
          <Tooltip title={t("resume.history.pageTitle")}>
            <IconButton onClick={() => setHistoryOpen(true)} size="small" aria-label={t("resume.history.pageTitle")}>
              <HistoryIcon />
            </IconButton>
          </Tooltip>
        </>
      )}
      {!isEditing && mainBranchId && <SaveVersionButton branchId={activeBranchId ?? mainBranchId} />}
      {!isEditing && <ExportSplitButton resumeId={id} />}
    </>
  );

  return (
    <Box>
      <PageHeader
        title={resumeTitle}
        breadcrumbs={[
          { label: t("nav.employees"), to: "/employees" },
          ...(resume?.employeeId
            ? [
                { label: employee?.name ?? "…", to: `/employees/${resume.employeeId}` },
                { label: t("nav.resumes"), to: `/resumes?employeeId=${resume.employeeId}` },
              ]
            : []),
        ]}
        chip={headerChip}
        actions={toolbarActions}
      />
      <Box
        sx={{
          bgcolor: "background.default",
          minHeight: "calc(100vh - 56px)",
          height: isInlineRevisionOpen ? "calc(100vh - 56px)" : undefined,
          py: isInlineRevisionOpen ? 0 : 4,
          px: isInlineRevisionOpen ? 0 : { xs: 2, md: 3 },
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            width: "100%",
            flex: isInlineRevisionOpen ? 1 : "0 0 auto",
            minHeight: isInlineRevisionOpen ? 0 : undefined,
            display: "flex",
            flexDirection: { xs: "column", lg: "row" },
            alignItems: "stretch",
            justifyContent: "center",
            gap: isInlineRevisionOpen ? 0 : 3,
            overflow: isInlineRevisionOpen ? "hidden" : "visible",
          }}
        >
          {isInlineRevisionOpen && (
            <Box
              sx={{
                width: { xs: "100%", lg: INLINE_REVISION_CHECKLIST_WIDTH },
                order: { xs: 0, lg: 0 },
                flexShrink: 0,
                overflow: "auto",
                borderRight: { xs: "none", lg: "1px solid" },
                borderBottom: { xs: "1px solid", lg: "none" },
                borderColor: "divider",
                bgcolor: "background.paper",
                maxHeight: { xs: 320, lg: "none" },
              }}
            >
              <InlineRevisionChecklist
                stage={inlineRevisionStage}
                sourceBranchName={inlineRevisionSourceBranchName ?? activeBranchName}
                branchName={activeBranchName}
                plan={inlineRevisionPlan}
                workItems={inlineRevisionWorkItems}
                suggestions={inlineRevisionSuggestions?.suggestions ?? []}
                selectedSuggestionId={selectedSuggestionId}
                onSelectSuggestion={scrollSuggestionIntoView}
                onReviewSuggestion={openSuggestionReview}
                onMoveToActions={openInlineRevisionActions}
                isMovingToActions={
                  pendingInlineRevisionActionBranchId !== null ||
                  forkResumeBranch.isPending ||
                  closeInlineConversation.isPending
                }
                onMoveToFinalize={() => void handlePrepareInlineRevisionFinalize()}
                isReadyToFinalize={isReadyToFinalize}
                isPreparingFinalize={isPreparingInlineRevisionFinalize}
                onBackToActions={() => setInlineRevisionStage("actions")}
              />
            </Box>
          )}

          <Box
            sx={{
              flex: "1 1 auto",
              order: { xs: 2, lg: 1 },
              minWidth: 0,
              minHeight: isInlineRevisionOpen ? 0 : undefined,
              overflow: isInlineRevisionOpen ? "auto" : "hidden",
              p: isInlineRevisionOpen ? 2 : 0,
            }}
          >
            {isInlineRevisionOpen && inlineRevisionStage !== "finalize" && (
              <Paper
                variant="outlined"
                sx={{
                  mb: 2,
                  px: 2,
                  py: 1.5,
                  borderRadius: 0,
                  bgcolor: "background.paper",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Chip size="small" color="primary" label={t("revision.inline.documentBadge")} />
                  <Typography variant="subtitle2">
                    {t(`revision.inline.documentTitle.${inlineRevisionStage}`)}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {t(`revision.inline.documentDescription.${inlineRevisionStage}`)}
                </Typography>
              </Paper>
            )}

            {/* Gray canvas */}
            {inlineRevisionStage === "finalize" ? (
              <FinalReview
                workflowId={activeBranchId ?? "inline-revision"}
                onMerge={handleMergeInlineRevisionBranch}
                onKeep={handleKeepInlineRevisionBranch}
                isMerging={finaliseInlineRevision.isPending && finaliseInlineRevision.variables?.action === "merge"}
                isKeeping={finaliseInlineRevision.isPending && finaliseInlineRevision.variables?.action === "keep"}
              />
            ) : (
            <Box
              ref={canvasRef}
              sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
            {/* Page 1 — Cover */}
            <Box ref={coverSectionRef} sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <DocumentPage
              title={resumeTitle}
              language={language}
              page={1}
              totalPages={totalPages}
              hideHeader
            >
              <CoverPageContent
                employeeName={employee?.name ?? ""}
                consultantTitle={consultantTitle}
                presentation={presentation}
                summary={summary}
                highlightedAssignments={highlighted}
                presentationRef={presentationRef}
                isEditing={isEditing}
                draftTitle={draftTitle}
                draftPresentation={draftPresentation}
                draftSummary={draftSummary}
                onDraftTitleChange={setDraftTitle}
                onDraftPresentationChange={setDraftPresentation}
                onDraftSummaryChange={setDraftSummary}
              />
            </DocumentPage>
            </Box>

            {/* Page 2 — Skills */}
            {showSkillsPage && skillsPage !== null && (
              <Box ref={skillsSectionRef} sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <DocumentPage
                title={resumeTitle}
                language={language}
                page={skillsPage}
                totalPages={totalPages}
              >
                {isEditing && !isSnapshotMode ? (
                  <SkillsEditor
                    resumeId={id}
                    skills={resume?.skills ?? []}
                    queryKey={getResumeQueryKey(id)}
                  />
                ) : (
                  <SkillsPageContent
                    employeeName={employee?.name ?? ""}
                    skills={skills}
                    degrees={education.filter((e) => e.type === "degree").map((e) => e.value)}
                    certifications={education.filter((e) => e.type === "certification").map((e) => e.value)}
                    languages={education.filter((e) => e.type === "language").map((e) => e.value)}
                  />
                )}
              </DocumentPage>
              </Box>
            )}

            {/* AI improvement FAB — sits to the right of the document at presentation height, only while editing */}
            {isEditing && !isInlineRevisionOpen && !isSnapshotMode && presentation.length > 0 && (
              <ImprovePresentationFab
                resumeId={id}
                presentation={presentation}
                consultantTitle={consultantTitle}
                employeeName={employee?.name}
                top={fabTop}
                onAccept={(improved) => {
                  const paragraphs = improved
                    .split(/\n\n+/)
                    .map((p) => p.trim())
                    .filter(Boolean);
                  updateResume.mutate({ presentation: paragraphs });
                }}
              />
            )}

            {/* Page 3 — Assignments (compact table or full card view) */}
            {hasAssignments && assignmentsPage !== null && (
              <Box ref={assignmentsSectionRef} sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
                <DocumentPage
                  title={resumeTitle}
                  language={language}
                  page={assignmentsPage}
                  totalPages={totalPages}
                >
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    {t("resume.detail.assignmentsHeading")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  {isEditing && !isSnapshotMode ? (
                    <AssignmentEditor
                      assignments={sortedAssignments}
                      queryKey={["listBranchAssignmentsFull", activeBranchId]}
                      canvasEl={canvasRef.current}
                    />
                  ) : showFullAssignments ? (
                    /* Full document-style view */
                    (<Box sx={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {sortedAssignments.map((a) => {
                        const startQ = a.startDate ? toQuarter(a.startDate) : "";
                        const endQ = a.isCurrent
                          ? t("resume.detail.assignmentPresent")
                          : a.endDate
                          ? toQuarter(a.endDate)
                          : "—";
                        const technologies = ("technologies" in a && Array.isArray(a.technologies))
                          ? a.technologies as string[]
                          : [];
                        const keywords = ("keywords" in a && typeof a.keywords === "string" && a.keywords)
                          ? a.keywords
                          : "";
                        const description = ("description" in a && typeof a.description === "string")
                          ? a.description
                          : "";
                        const paragraphs = description.split(/\n+/).filter(Boolean);

                        return (
                          <Box
                            key={a.id}
                            ref={(el) => {
                              const assignmentIdentityId =
                                "assignmentId" in a && typeof a.assignmentId === "string"
                                  ? a.assignmentId
                                  : a.id;
                              assignmentItemRefs.current[assignmentIdentityId] = el as HTMLElement | null;
                            }}
                          >
                            {/* Role heading */}
                            <Typography
                              variant="h6"
                              component="h3"
                              sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", mb: 0.5 }}
                            >
                              {a.role}
                            </Typography>

                            {/* Client + period subtitle */}
                            <Typography variant="subtitle1" sx={{ fontWeight: 400, mb: 1.5 }}>
                              {a.clientName} {startQ} – {endQ}
                            </Typography>

                            {/* Description paragraphs */}
                            {paragraphs.length > 0 ? (
                              <Box sx={{ mb: 2 }}>
                                {paragraphs.map((para, i) => (
                                  <Typography
                                    key={i}
                                    variant="body2"
                                    sx={{ textAlign: "justify", mb: i < paragraphs.length - 1 ? 1.5 : 0 }}
                                  >
                                    {para}
                                  </Typography>
                                ))}
                              </Box>
                            ) : null}

                            {/* Technologies + keywords box */}
                            {(technologies.length > 0 || keywords) && (
                              <Box
                                sx={{
                                  bgcolor: "action.hover",
                                  border: "none",
                                  borderRadius: 0,
                                  px: 1.5,
                                  py: 1,
                                  mt: 2,
                                }}
                              >
                                {technologies.length > 0 && (
                                  <Typography variant="body2" sx={{ mb: keywords ? 0.5 : 0 }}>
                                    <Box component="span" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em" }}>
                                      {t("resume.detail.assignmentTechnologies")}:{" "}
                                    </Box>
                                    {technologies.join(", ")}
                                  </Typography>
                                )}
                                {keywords && (
                                  <Typography variant="body2">
                                    <Box component="span" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em" }}>
                                      {t("assignment.new.keywordsLabel")}:{" "}
                                    </Box>
                                    {keywords}
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>)
                  ) : (
                    /* Compact table view */
                    (<TableContainer>
                      <Table size="small" aria-label={t("resume.detail.assignmentsHeading")}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("assignment.tableHeaderClient")}</TableCell>
                        <TableCell>{t("assignment.tableHeaderRole")}</TableCell>
                        <TableCell>{t("assignment.tableHeaderStart")}</TableCell>
                        <TableCell>{t("assignment.tableHeaderCurrent")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedAssignments.map((a) => (
                        <TableRow
                          key={a.id}
                          ref={(el) => {
                            const assignmentIdentityId =
                              "assignmentId" in a && typeof a.assignmentId === "string"
                                ? a.assignmentId
                                : a.id;
                            assignmentItemRefs.current[assignmentIdentityId] = el as HTMLElement | null;
                          }}
                          hover
                        >
                          <TableCell>{a.clientName}</TableCell>
                          <TableCell>{a.role}</TableCell>
                          <TableCell>
                            {typeof a.startDate === "string" ? a.startDate.slice(0, 10) : ""}
                          </TableCell>
                          <TableCell>
                            {a.isCurrent ? (
                              <Chip label={t("resume.detail.assignmentPresent")} color="success" size="small" />
                            ) : typeof a.endDate === "string" ? (
                              a.endDate.slice(0, 10)
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                      </Table>
                    </TableContainer>)
                  )}
                </DocumentPage>

              </Box>
            )}

            {/* Assignments view toggle FAB — sits to the right of the assignments section */}
            {hasAssignments && !isEditing && !isInlineRevisionOpen && (
              <Tooltip
                title={showFullAssignments
                  ? t("resume.detail.assignmentToggleSummary")
                  : t("resume.detail.assignmentToggleFull")}
                placement="left"
              >
                <Fab
                  size="small"
                  aria-label={showFullAssignments
                    ? t("resume.detail.assignmentToggleSummary")
                    : t("resume.detail.assignmentToggleFull")}
                  onClick={() => setShowFullAssignments((v) => !v)}
                  sx={{
                    position: "absolute",
                    left: `calc(50% + ${PAGE_WIDTH / 2}px + 16px)`,
                    top: (theme) => `calc(${assignmentsFabTop}px + ${theme.spacing(2)})`,
                    zIndex: 10,
                    bgcolor: "transparent",
                    color: "action.active",
                    boxShadow: 0,
                    opacity: 0.5,
                    transition: "opacity 0.2s, box-shadow 0.2s, background-color 0.2s",
                    "&:hover": { bgcolor: "action.selected", boxShadow: 1, opacity: 1 },
                  }}
                >
                  {showFullAssignments
                    ? <FormatListBulletedIcon fontSize="small" />
                    : <ViewAgendaIcon fontSize="small" />}
                </Fab>
              </Tooltip>
            )}

            {/* Add assignment FAB — visible only while editing, below the toggle FAB position */}
            {hasAssignments && isEditing && !isInlineRevisionOpen && !isSnapshotMode && (
              <Tooltip title={t("resume.detail.addAssignment")} placement="left">
                <Fab
                  size="small"
                  aria-label={t("resume.detail.addAssignment")}
                  onClick={() => void navigate({
                    to: "/assignments/new",
                    search: {
                      resumeId: id,
                      employeeId: resume?.employeeId,
                      ...(activeBranchId ? { branchId: activeBranchId } : {}),
                    },
                  })}
                  sx={{
                    position: "absolute",
                    left: `calc(50% + ${PAGE_WIDTH / 2}px + 16px)`,
                    top: (theme) => `calc(${assignmentsFabTop}px + ${theme.spacing(2)})`,
                    zIndex: 10,
                    bgcolor: "transparent",
                    color: "action.active",
                    boxShadow: 0,
                    opacity: 0.5,
                    transition: "opacity 0.2s, box-shadow 0.2s, background-color 0.2s",
                    "&:hover": { bgcolor: "action.selected", boxShadow: 1, opacity: 1 },
                  }}
                >
                  <AddIcon fontSize="small" />
                </Fab>
              </Tooltip>
            )}
            </Box>
            )}
          </Box>

          {isInlineRevisionOpen && inlineRevisionStage !== "finalize" && (
            <Box
              sx={{
                width: { xs: "100%", lg: INLINE_REVISION_CHAT_WIDTH },
                order: { xs: 1, lg: 2 },
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderLeft: { xs: "none", lg: "1px solid" },
                borderBottom: { xs: "1px solid", lg: "none" },
                borderColor: "divider",
                bgcolor: "background.paper",
                minHeight: 0,
                maxHeight: { xs: 320, lg: "none" },
              }}
            >
              <InlineRevisionChatPanel
                  branchName={activeBranchName}
                  sourceBranchName={inlineRevisionSourceBranchName ?? activeBranchName}
                  stage={inlineRevisionStage}
                  onClose={handleCloseInlineRevision}
                toolCount={
                  inlineRevisionStage === "actions"
                    ? inlineRevisionActionToolRegistry.tools.length
                    : inlineRevisionPlanningToolRegistry.tools.length
                }
                toolRegistry={
                  inlineRevisionStage === "actions"
                    ? inlineRevisionActionToolRegistry
                    : inlineRevisionPlanningToolRegistry
                }
                toolContext={
                  inlineRevisionStage === "actions"
                    ? inlineRevisionActionToolContext
                    : inlineRevisionPlanningToolContext
                }
                autoStartMessage={null}
                automation={inlineRevisionActionAutomation}
                guardrail={inlineRevisionGuardrail}
              />
            </Box>
          )}
        </Box>
      </Box>

      {/* Version history drawer */}
      <Drawer
        anchor="right"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        slotProps={{ paper: { sx: { width: 320 } } }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {t("resume.detail.historyDrawer.title")}
          </Typography>
          <RouterButton
            variant="text"
            size="small"
            to="/resumes/$id/history"
            params={{ id }}
            {...(activeBranchId ? { search: { branchId: activeBranchId } } : {})}
            sx={{ mt: 0.5, px: 0 }}
            onClick={() => setHistoryOpen(false)}
          >
            {t("resume.detail.historyDrawer.viewAll")}
          </RouterButton>
        </Box>
        <List dense disablePadding>
          {recentCommits.length === 0 ? (
            <ListItem>
              <ListItemText
                primary={t("resume.detail.historyDrawer.noCommits")}
                slotProps={{ primary: { color: "text.secondary", variant: "body2" } }}
              />
            </ListItem>
          ) : (
            recentCommits.slice(0, 20).map((commit) => (
              <ListItem key={commit.id} divider>
                <ListItemText
                  primary={commit.message || t("resume.detail.historyDrawer.defaultMessage")}
                  secondary={
                    commit.createdAt
                      ? new Date(commit.createdAt).toLocaleDateString(language === "sv" ? "sv-SE" : "en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : undefined
                  }
                  slotProps={{
                    primary: { variant: "body2" },
                    secondary: { variant: "caption" },
                  }}
                />
              </ListItem>
            ))
          )}
        </List>
      </Drawer>
      {reviewSuggestionId && (
        <DiffReviewDialog
          open={isSuggestionReviewOpen}
          original={
            getSuggestionOriginalText(
              inlineRevisionSuggestions?.suggestions.find((item) => item.id === reviewSuggestionId)!,
            )
          }
          suggested={
            inlineRevisionSuggestions?.suggestions.find((item) => item.id === reviewSuggestionId)?.suggestedText ?? ""
          }
          onApply={async () => {
            await approveInlineSuggestion(reviewSuggestionId);
            setIsSuggestionReviewOpen(false);
            setReviewSuggestionId(null);
          }}
          onKeepEditing={() => {
            setIsSuggestionReviewOpen(false);
            setReviewSuggestionId(null);
          }}
          onDiscard={() => {
            dismissInlineSuggestion(reviewSuggestionId);
            setIsSuggestionReviewOpen(false);
            setReviewSuggestionId(null);
          }}
          title={t("revision.inline.reviewDialogTitle")}
          applyLabel={t("revision.inline.approveSuggestion")}
          keepEditingLabel={t("revision.inline.reviewLater")}
          discardLabel={t("revision.inline.dismissSuggestion")}
        />
      )}
    </Box>
  )
}
