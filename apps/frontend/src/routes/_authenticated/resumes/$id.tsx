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
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Chip from "@mui/material/Chip";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Drawer from "@mui/material/Drawer";
import Grow from "@mui/material/Grow";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
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
import { useInlineResumeRevision } from "../../../hooks/inline-resume-revision";
import { resumeBranchesKey, useForkResumeBranch, useResumeCommits } from "../../../hooks/versioning";
import RouterButton from "../../../components/RouterButton";
import { PageHeader } from "../../../components/layout/PageHeader";
import { LoadingState, ErrorState } from "../../../components/feedback";
import { ResumeSaveSplitButton } from "../../../components/ResumeSaveSplitButton";
import { VariantSwitcher } from "../../../components/VariantSwitcher";
import { ImprovePresentationFab } from "../../../components/ai-assistant/ImprovePresentationFab";
import { DiffReviewDialog } from "../../../components/ai-assistant/DiffReviewDialog";
import { FinalReview } from "../../../components/revision/FinalReview";
import { InlineRevisionChatPanel } from "../../../components/revision/InlineRevisionChatPanel";
import { InlineRevisionChecklist } from "../../../components/revision/InlineRevisionChecklist";
import { SkillsEditor } from "../../../components/SkillsEditor";
import { AssignmentEditor } from "../../../components/AssignmentEditor";
import { LIST_RESUMES_QUERY_KEY } from "./index";

export const getResumeQueryKey = (id: string) => ["getResume", id] as const;


// A4 at 96 dpi
const PAGE_WIDTH = 794;
const PAGE_MIN_HEIGHT = 1123;
const PAGE_MX = "80px";
const PAGE_MY = "56px";
const HEADER_HEIGHT = 52;
const FOOTER_HEIGHT = 40;

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
  highlightedItems: string[];
  presentationRef?: RefObject<HTMLDivElement | null>;
  isEditing?: boolean;
  draftTitle?: string;
  draftPresentation?: string;
  draftSummary?: string;
  draftHighlightedItems?: string;
  onDraftTitleChange?: (v: string) => void;
  onDraftPresentationChange?: (v: string) => void;
  onDraftSummaryChange?: (v: string) => void;
  onDraftHighlightedItemsChange?: (v: string) => void;
}

function CoverPageContent({
  employeeName,
  consultantTitle,
  presentation,
  summary,
  highlightedItems,
  presentationRef,
  isEditing = false,
  draftTitle = "",
  draftPresentation = "",
  draftSummary = "",
  draftHighlightedItems = "",
  onDraftTitleChange,
  onDraftPresentationChange,
  onDraftSummaryChange,
  onDraftHighlightedItemsChange,
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
            label={t("resume.edit.consultantTitleLabel")}
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
          label={t("resume.edit.presentationLabel")}
          helperText={t("resume.edit.presentationHelper")}
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
      {(isEditing || summary || highlightedItems.length > 0) && (
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
            <Box sx={{ mb: highlightedItems.length > 0 || isEditing ? 2.5 : 0 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, letterSpacing: "0.08em", display: "block", mb: 0.75 }}
              >
                {t("resume.detail.specialSkillsHeading").toUpperCase()}
              </Typography>
              {isEditing ? (
                <TextField
                  label={t("resume.edit.summaryLabel")}
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

          {(isEditing || highlightedItems.length > 0) && (
            <Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, letterSpacing: "0.08em", display: "block", mb: 0.75 }}
              >
                {t("resume.detail.highlightedExperienceHeading").toUpperCase()}
              </Typography>
              {isEditing ? (
                <TextField
                  label={t("resume.edit.highlightedExperienceLabel")}
                  helperText={t("resume.edit.highlightedExperienceHelper")}
                  value={draftHighlightedItems}
                  onChange={(e) => onDraftHighlightedItemsChange?.(e.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {highlightedItems.map((item, i) => (
                    <Typography
                      key={i}
                      component="li"
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.25 }}
                    >
                      {item}
                    </Typography>
                  ))}
                </Box>
              )}
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
      <Popper open={open} anchorEl={anchorRef[0]} placement="bottom-end" transition disablePortal sx={{ zIndex: 1300 }}>
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

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function ResumeDetailPage() {
  const { t } = useTranslation("common");
  const { id: idParam } = useParams({ strict: false });
  const id = idParam!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { branchId: selectedBranchId } = useSearch({ strict: false }) as any as { branchId?: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPresentation, setDraftPresentation] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftHighlightedItems, setDraftHighlightedItems] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moreActionsAnchorEl, setMoreActionsAnchorEl] = useState<HTMLElement | null>(null);
  const draftTitleRef = useRef("");
  const draftPresentationRef = useRef("");
  const draftSummaryRef = useRef("");
  const draftHighlightedItemsRef = useRef("");

  const updateResume = useMutation({
    mutationFn: (patch: {
      presentation?: string[];
      consultantTitle?: string | null;
      summary?: string | null;
      highlightedItems?: string[];
    }) =>
      orpc.updateResume({ id, ...patch }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getResumeQueryKey(id) });
    },
  });

  const deleteResume = useMutation({
    mutationFn: () => orpc.deleteResume({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_RESUMES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: getResumeQueryKey(id) });
      void navigate({
        to: "/resumes",
        search: resume?.employeeId ? { employeeId: resume.employeeId } : {},
      });
    },
  });

  const [newAssignmentId, setNewAssignmentId] = useState<string | null>(null);

  const createAssignment = useMutation({
    mutationFn: () =>
      orpc.createAssignment({
        employeeId: resume!.employeeId,
        branchId: activeBranchId!,
        clientName: t("resume.detail.newAssignmentClientPlaceholder"),
        role: t("resume.detail.newAssignmentRolePlaceholder"),
        startDate: new Date().toISOString().slice(0, 10),
        isCurrent: true,
      }),
    onSuccess: async (result) => {
      setNewAssignmentId(result.id);
      await queryClient.invalidateQueries({ queryKey: ["listBranchAssignmentsFull", activeBranchId] });
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
  const forkResumeBranch = useForkResumeBranch();

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
    draftTitleRef.current = draftTitle;
    draftPresentationRef.current = draftPresentation;
    draftSummaryRef.current = draftSummary;
    draftHighlightedItemsRef.current = draftHighlightedItems;
  }, [draftHighlightedItems, draftPresentation, draftSummary, draftTitle]);

  // Assignments always come from the live branch_assignments join — same source for all branches
  const assignments = liveAssignments;

  // Use snapshot fields when a non-main branch is active, otherwise live resume fields
  const snapshotContent = isSnapshotMode ? branchCommit?.content : null;
  const resumeTitle = snapshotContent?.title ?? resume?.title ?? "";
  const language = snapshotContent?.language ?? resume?.language;
  const consultantTitle = snapshotContent?.consultantTitle ?? resume?.consultantTitle ?? null;
  const presentation = snapshotContent?.presentation ?? resume?.presentation ?? [];
  const summary = snapshotContent?.summary ?? resume?.summary ?? null;
  const presentationText = presentation.join("\n\n");
  const sortedAssignments = sortAssignments(assignments, (a) => a.isCurrent, (a) => a.startDate);
  const fallbackHighlightedItems = sortedAssignments
    .slice(0, COVER_HIGHLIGHT_COUNT)
    .map((assignment) => `${assignment.role} hos ${assignment.clientName}`);
  const highlightedItems =
    snapshotContent?.highlightedItems ??
    (resume?.highlightedItems && resume.highlightedItems.length > 0
      ? resume.highlightedItems
      : fallbackHighlightedItems);
  const highlightedItemsText = highlightedItems.join("\n");

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const nextTitle = consultantTitle ?? "";
    const nextPresentation = presentationText;
    const nextSummary = summary ?? "";
    const nextHighlightedItems = highlightedItemsText;
    draftTitleRef.current = nextTitle;
    draftPresentationRef.current = nextPresentation;
    draftSummaryRef.current = nextSummary;
    draftHighlightedItemsRef.current = nextHighlightedItems;
    setDraftTitle(nextTitle);
    setDraftPresentation(nextPresentation);
    setDraftSummary(nextSummary);
    setDraftHighlightedItems(nextHighlightedItems);
  }, [activeBranchId, consultantTitle, highlightedItemsText, isEditing, presentationText, summary]);

  const skills = snapshotContent?.skills
    ? snapshotContent.skills.map((s) => ({ id: s.name, name: s.name, category: s.category ?? null, level: null as string | null, sortOrder: 0 }))
    : (resume?.skills ?? []);
  const hasSkills = skills.length > 0;
  const showSkillsPage = hasSkills || (isEditing && !isSnapshotMode);
  const hasAssignments = assignments.length > 0;
  const baseCommitId = activeBranch?.headCommitId ?? null;
  const buildDraftPatch = () => {
    return {
      consultantTitle: draftTitleRef.current.trim() || null,
      presentation: draftPresentationRef.current.split(/\n\n+/).map((p) => p.trim()).filter(Boolean),
      summary: draftSummaryRef.current.trim() || null,
      highlightedItems: draftHighlightedItemsRef.current.split(/\n+/).map((item) => item.trim()).filter(Boolean),
    };
  };

  const buildDraftPatchFromValues = (title: string, presentationValue: string, summaryValue: string) => ({
    consultantTitle: title.trim() || null,
    presentation: presentationValue.split(/\n\n+/).map((p) => p.trim()).filter(Boolean),
    summary: summaryValue.trim() || null,
    highlightedItems: draftHighlightedItemsRef.current.split(/\n+/).map((item) => item.trim()).filter(Boolean),
  });

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
      level: skill.level ?? null,
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
  const totalPages = 1 + (showSkillsPage ? 1 : 0) + (hasAssignments ? 1 : 0);
  const skillsPage = showSkillsPage ? 2 : null;
  const assignmentsPage = hasAssignments ? (hasSkills ? 3 : 2) : null;
  const inlineRevision = useInlineResumeRevision({
    resumeId: id,
    isEditing,
    setIsEditing,
    activeBranchId,
    activeBranchName,
    activeBranchHeadCommitId: activeBranch?.headCommitId ?? null,
    mainBranchId,
    baseCommitId,
    resumeTitle,
    consultantTitle,
    presentation,
    summary,
    highlightedItems,
    skills: skills.map((skill) => ({
      name: skill.name,
      level: skill.level ?? null,
      category: skill.category ?? null,
      sortOrder: skill.sortOrder ?? 0,
    })),
    sortedAssignments,
    resumeInspectionSnapshot,
    sectionRefs: {
      coverSectionRef,
      presentationRef,
      skillsSectionRef,
      assignmentsSectionRef,
      assignmentItemRefs,
    },
    draftState: {
      title: draftTitle,
      presentation: draftPresentation,
      summary: draftSummary,
      titleRef: draftTitleRef,
      presentationRef: draftPresentationRef,
      summaryRef: draftSummaryRef,
      highlightedItems: draftHighlightedItems,
      highlightedItemsRef: draftHighlightedItemsRef,
      setTitle: setDraftTitle,
      setPresentation: setDraftPresentation,
      setSummary: setDraftSummary,
      setHighlightedItems: setDraftHighlightedItems,
    },
    buildDraftPatch,
    buildDraftPatchFromValues,
  });

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

  const handleExitEditing = () => {
    inlineRevision.reset();
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

  const headerChip = inlineRevision.isOpen ? (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
      <Chip size="small" color="primary" label={t("revision.inline.modeChip")} />
      <Chip size="small" variant="outlined" label={activeBranchName} />
      {language ? <Chip label={language.toUpperCase()} size="small" /> : null}
    </Box>
  ) : (
    language ? <Chip label={language.toUpperCase()} size="small" /> : undefined
  );

  const headerCenterContent = (
    <VariantSwitcher resumeId={id} currentBranchId={activeBranchId} />
  );

  const toolbarActions = inlineRevision.isOpen ? (
    <>
      <ResumeSaveSplitButton
        onSaveCurrent={handleSave}
        onSaveAsNewVersion={handleSaveAsNewVersion}
        canSaveAsNewVersion={baseCommitId !== null}
        isPending={updateResume.isPending || saveVersion.isPending || forkResumeBranch.isPending}
      />
      <Button variant="outlined" onClick={inlineRevision.close}>
        {t("revision.inline.closeButton")}
      </Button>
      <IconButton
        aria-label={t("resume.detail.moreActionsLabel")}
        onClick={(event) => setMoreActionsAnchorEl(event.currentTarget)}
      >
        <MoreVertIcon />
      </IconButton>
    </>
  ) : (
    <>
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
          <ExportSplitButton resumeId={id} />
          <EditSplitButton
            onEdit={() => setIsEditing(true)}
            onReviseWithAi={inlineRevision.open}
          />
        </>
      )}
      <IconButton
        aria-label={t("resume.detail.moreActionsLabel")}
        onClick={(event) => setMoreActionsAnchorEl(event.currentTarget)}
      >
        <MoreVertIcon />
      </IconButton>
    </>
  );

  return (
    <Box
      sx={{
        height: inlineRevision.isOpen ? "100vh" : undefined,
        display: inlineRevision.isOpen ? "flex" : "block",
        flexDirection: inlineRevision.isOpen ? "column" : undefined,
        overflow: inlineRevision.isOpen ? "hidden" : undefined,
      }}
    >
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
        centerContent={headerCenterContent}
        actions={toolbarActions}
      />
      <Box
        sx={{
          bgcolor: "background.default",
          minHeight: inlineRevision.isOpen ? 0 : "calc(100vh - 56px)",
          height: inlineRevision.isOpen ? "auto" : undefined,
          flex: inlineRevision.isOpen ? 1 : undefined,
          py: inlineRevision.isOpen ? 0 : 4,
          px: inlineRevision.isOpen ? 0 : { xs: 2, md: 3 },
          display: "flex",
          flexDirection: "column",
          overflow: inlineRevision.isOpen ? "hidden" : undefined,
        }}
      >
        <Box
          sx={{
            width: "100%",
            flex: inlineRevision.isOpen ? 1 : "0 0 auto",
            minHeight: inlineRevision.isOpen ? 0 : undefined,
            display: "flex",
            flexDirection: { xs: "column", lg: "row" },
            alignItems: "stretch",
            justifyContent: "center",
            gap: inlineRevision.isOpen ? 0 : 3,
            overflow: inlineRevision.isOpen ? "hidden" : "visible",
          }}
        >
          {inlineRevision.isOpen && (
            <Box
              sx={{
                width: { xs: "100%", lg: inlineRevision.checklistWidth },
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
                stage={inlineRevision.stage}
                sourceBranchName={inlineRevision.sourceBranchName}
                branchName={activeBranchName}
                plan={inlineRevision.plan}
                workItems={inlineRevision.workItems}
                suggestions={inlineRevision.suggestions}
                selectedSuggestionId={inlineRevision.selectedSuggestionId}
                onSelectSuggestion={inlineRevision.selectSuggestion}
                onReviewSuggestion={inlineRevision.openSuggestionReview}
                onMoveToActions={() => void inlineRevision.openActions()}
                isMovingToActions={inlineRevision.isMovingToActions}
                onMoveToFinalize={() => void inlineRevision.prepareFinalize()}
                isReadyToFinalize={inlineRevision.isReadyToFinalize}
                isPreparingFinalize={inlineRevision.isPreparingFinalize}
                onBackToActions={inlineRevision.backToActions}
              />
            </Box>
          )}

          <Box
            sx={{
              flex: "1 1 auto",
              order: { xs: 2, lg: 1 },
              minWidth: 0,
              minHeight: inlineRevision.isOpen ? 0 : undefined,
              overflow: inlineRevision.isOpen ? "auto" : "hidden",
              p: inlineRevision.isOpen ? 2 : 0,
            }}
          >
            {/* Gray canvas */}
            {inlineRevision.stage === "finalize" ? (
              <FinalReview
                workflowId={activeBranchId ?? "inline-revision"}
                onMerge={inlineRevision.mergeBranch}
                onKeep={inlineRevision.keepBranch}
                isMerging={inlineRevision.isMerging}
                isKeeping={inlineRevision.isKeeping}
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
                highlightedItems={highlightedItems}
                presentationRef={presentationRef}
                isEditing={isEditing}
                draftTitle={draftTitle}
                draftPresentation={draftPresentation}
                draftSummary={draftSummary}
                draftHighlightedItems={draftHighlightedItems}
                onDraftTitleChange={setDraftTitle}
                onDraftPresentationChange={setDraftPresentation}
                onDraftSummaryChange={setDraftSummary}
                onDraftHighlightedItemsChange={setDraftHighlightedItems}
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
            {isEditing && !inlineRevision.isOpen && !isSnapshotMode && presentation.length > 0 && (
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

                  {isEditing ? (
                    <AssignmentEditor
                      assignments={sortedAssignments}
                      queryKey={["listBranchAssignmentsFull", activeBranchId]}
                      canvasEl={canvasRef.current}
                      autoEditId={newAssignmentId}
                      onAutoEditConsumed={() => setNewAssignmentId(null)}
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
            {hasAssignments && !isEditing && !inlineRevision.isOpen && (
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

            {/* Add assignment FAB — visible while editing, including during AI revision */}
            {hasAssignments && isEditing && !isSnapshotMode && (
              <Tooltip title={t("resume.detail.addAssignment")} placement="left">
                <Fab
                  size="small"
                  aria-label={t("resume.detail.addAssignment")}
                  disabled={createAssignment.isPending || !activeBranchId || !resume?.employeeId}
                  onClick={() => void createAssignment.mutate()}
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

          {inlineRevision.isOpen && inlineRevision.stage !== "finalize" && (
            <Box
              sx={{
                width: { xs: "100%", lg: inlineRevision.chatWidth },
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
                stage={inlineRevision.stage}
                toolRegistry={
                  inlineRevision.stage === "actions"
                    ? inlineRevision.actionToolRegistry
                    : inlineRevision.planningToolRegistry
                }
                toolContext={
                  inlineRevision.stage === "actions"
                    ? inlineRevision.actionToolContext
                    : inlineRevision.planningToolContext
                }
                autoStartMessage={null}
                automation={inlineRevision.automation}
                guardrail={inlineRevision.guardrail}
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
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("resume.detail.deleteDialog.title")}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: deleteResume.isError ? 2 : 0 }}>
            {t("resume.detail.deleteDialog.message", { title: resumeTitle })}
          </Typography>
          {deleteResume.isError && (
            <Alert severity="error">{t("resume.detail.deleteDialog.error")}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteResume.isPending}>
            {t("resume.detail.deleteDialog.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteResume.mutate()}
            disabled={deleteResume.isPending}
          >
            {deleteResume.isPending
              ? t("resume.detail.deleteDialog.deleting")
              : t("resume.detail.deleteDialog.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
      <Menu
        anchorEl={moreActionsAnchorEl}
        open={Boolean(moreActionsAnchorEl)}
        onClose={() => setMoreActionsAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setMoreActionsAnchorEl(null);
            setHistoryOpen(true);
          }}
        >
          <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
          {t("resume.history.pageTitle")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMoreActionsAnchorEl(null);
            handleOpenComparePage();
          }}
        >
          <ViewAgendaIcon fontSize="small" sx={{ mr: 1 }} />
          {t("revision.inline.compareButton")}
        </MenuItem>
        {!isSnapshotMode && (
          <MenuItem
            onClick={() => {
              setMoreActionsAnchorEl(null);
              setDeleteDialogOpen(true);
            }}
          >
            <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
            {t("resume.detail.deleteButton")}
          </MenuItem>
        )}
      </Menu>
      {/* Both branches render identically — the kind discriminant exists to satisfy
          TypeScript's generic constraint that value/renderReview/formatResult share TValue. */}
      {inlineRevision.reviewDialog && (
        inlineRevision.reviewDialog.kind === "skills" ? (
          <DiffReviewDialog
            open={inlineRevision.reviewDialog.isOpen}
            value={inlineRevision.reviewDialog.value}
            renderReview={inlineRevision.reviewDialog.renderReview}
            formatResult={inlineRevision.reviewDialog.formatResult}
            onApply={inlineRevision.reviewDialog.onApply}
            onKeepEditing={inlineRevision.reviewDialog.onKeepEditing}
            onDiscard={inlineRevision.reviewDialog.onDiscard}
            title={t("revision.inline.reviewDialogTitle")}
            applyLabel={t("revision.inline.approveSuggestion")}
            keepEditingLabel={t("revision.inline.reviewLater")}
            discardLabel={t("revision.inline.dismissSuggestion")}
          />
        ) : (
          <DiffReviewDialog
            open={inlineRevision.reviewDialog.isOpen}
            value={inlineRevision.reviewDialog.value}
            renderReview={inlineRevision.reviewDialog.renderReview}
            formatResult={inlineRevision.reviewDialog.formatResult}
            onApply={inlineRevision.reviewDialog.onApply}
            onKeepEditing={inlineRevision.reviewDialog.onKeepEditing}
            onDiscard={inlineRevision.reviewDialog.onDiscard}
            title={t("revision.inline.reviewDialogTitle")}
            applyLabel={t("revision.inline.approveSuggestion")}
            keepEditingLabel={t("revision.inline.reviewLater")}
            discardLabel={t("revision.inline.dismissSuggestion")}
          />
        )
      )}
    </Box>
  )
}
