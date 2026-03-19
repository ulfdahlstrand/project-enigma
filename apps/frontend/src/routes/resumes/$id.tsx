import Button from "@mui/material/Button";
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
import { createFileRoute, redirect, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useLayoutEffect, useEffect } from "react";
import type { ReactNode, RefObject } from "react";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Box from "@mui/material/Box";
import ButtonGroup from "@mui/material/ButtonGroup";
import Chip from "@mui/material/Chip";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Divider from "@mui/material/Divider";
import Grow from "@mui/material/Grow";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import CircularProgress from "@mui/material/CircularProgress";
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
import { orpc } from "../../orpc-client";
import { resumeBranchesKey } from "../../hooks/versioning";
import RouterButton from "../../components/RouterButton";
import { PageHeader } from "../../components/layout/PageHeader";
import { SaveVersionButton } from "../../components/SaveVersionButton";
import { VariantSwitcher } from "../../components/VariantSwitcher";
import { ImprovePresentationFab } from "../../components/ai-assistant/ImprovePresentationFab";

export const getResumeQueryKey = (id: string) => ["getResume", id] as const;

const TOKEN_KEY = "cv-tool:id-token";

// A4 at 96 dpi
const PAGE_WIDTH = 794;
const PAGE_MIN_HEIGHT = 1123;
const PAGE_MX = "80px";
const PAGE_MY = "56px";
const HEADER_HEIGHT = 52;
const FOOTER_HEIGHT = 40;

// How many assignments to show as bullets on the cover page
const COVER_HIGHLIGHT_COUNT = 5;

export const Route = createFileRoute("/resumes/$id")({
  validateSearch: z.object({
    branchId: z.string().optional(),
  }),
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
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
  skills: Array<{ id: string; name: string; category: string | null }>;
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
  const grouped = skills.reduce<Record<string, string[]>>((acc, skill) => {
    const key = skill.category?.trim() || "";
    return { ...acc, [key]: [...(acc[key] ?? []), skill.name] };
  }, {});

  const categories = Object.entries(grouped).sort(([a], [b]) => {
    if (a === "") return 1;   // uncategorised to the end
    if (b === "") return -1;
    return a.localeCompare(b);
  });

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
// Page component
// ---------------------------------------------------------------------------

function ResumeDetailPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ from: Route.fullPath });
  const { branchId: selectedBranchId } = useSearch({ from: Route.fullPath });
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

  // When a non-main branch is active, load its head commit snapshot
  const isSnapshotMode = activeBranchId !== null && activeBranchId !== mainBranchId && activeBranch?.headCommitId != null;

  const { data: branchCommit } = useQuery({
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
    queryKey: ["listAssignments", "resume", id],
    queryFn: () => orpc.listAssignments({ resumeId: id }),
    enabled: !!resume && !isSnapshotMode,
  });

  const { data: education = [] } = useQuery({
    queryKey: ["listEducation", resume?.employeeId],
    queryFn: () => orpc.listEducation({ employeeId: resume!.employeeId }),
    enabled: !!resume?.employeeId,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPresentation, setDraftPresentation] = useState("");
  const [draftSummary, setDraftSummary] = useState("");

  const updateResume = useMutation({
    mutationFn: (patch: { presentation?: string[]; consultantTitle?: string | null; summary?: string | null }) =>
      orpc.updateResume({ id, ...patch }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getResumeQueryKey(id) });
    },
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const [fabTop, setFabTop] = useState(0);

  useLayoutEffect(() => {
    if (!presentationRef.current || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const presRect = presentationRef.current.getBoundingClientRect();
    setFabTop(presRect.top - canvasRect.top);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, resume, branchCommit, isEditing]);

  useEffect(() => {
    if (isEditing) {
      setDraftTitle(consultantTitle ?? "");
      setDraftPresentation(presentation.join("\n\n"));
      setDraftSummary(summary ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Assignments: use snapshot when non-main branch, otherwise live
  const assignments = isSnapshotMode && branchCommit
    ? branchCommit.content.assignments.map((a) => ({
        id: a.assignmentId,
        clientName: a.clientName,
        role: a.role,
        startDate: a.startDate,
        endDate: a.endDate ?? null,
        isCurrent: a.endDate == null,
      }))
    : liveAssignments;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("resume.detail.loading")} />
      </Box>
    );
  }

  if (isError) {
    const isNotFound =
      error != null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "NOT_FOUND";

    return (
      <Box sx={{ mt: 2, px: 3 }}>
        {isNotFound ? (
          <Typography variant="body1">{t("resume.detail.notFound")}</Typography>
        ) : (
          <Alert severity="error">{t("resume.detail.error")}</Alert>
        )}
      </Box>
    );
  }

  // Use snapshot fields when a non-main branch is active, otherwise live resume fields
  const snapshotContent = isSnapshotMode ? branchCommit?.content : null;
  const resumeTitle = snapshotContent?.title ?? resume?.title ?? "";
  const language = snapshotContent?.language ?? resume?.language;
  const consultantTitle = snapshotContent?.consultantTitle ?? resume?.consultantTitle ?? null;
  const presentation = snapshotContent?.presentation ?? resume?.presentation ?? [];
  const summary = snapshotContent?.summary ?? resume?.summary ?? null;

  // Sort: current assignments first, then by start date descending
  const sortedAssignments = [...assignments].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return (b.startDate ?? "").toString().localeCompare((a.startDate ?? "").toString());
  });

  const highlighted = sortedAssignments.slice(0, COVER_HIGHLIGHT_COUNT);
  const skills = snapshotContent?.skills
    ? snapshotContent.skills.map((s) => ({ id: s.name, name: s.name, category: s.category ?? null }))
    : (resume?.skills ?? []);
  const hasSkills = skills.length > 0;
  const hasAssignments = assignments.length > 0;
  const totalPages = 1 + (hasSkills ? 1 : 0) + (hasAssignments ? 1 : 0);
  const skillsPage = hasSkills ? 2 : null;
  const assignmentsPage = hasAssignments ? (hasSkills ? 3 : 2) : null;

  const saveVersion = useMutation({
    mutationFn: (input: Parameters<typeof orpc.saveResumeVersion>[0]) => orpc.saveResumeVersion(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resumeBranchesKey(id) });
      if (activeBranch?.headCommitId) {
        await queryClient.invalidateQueries({ queryKey: ["getResumeCommit", activeBranch.headCommitId] });
      }
      setIsEditing(false);
    },
  });

  const handleSave = () => {
    const patch = {
      consultantTitle: draftTitle.trim() || null,
      presentation: draftPresentation.split(/\n\n+/).map((p) => p.trim()).filter(Boolean),
      summary: draftSummary.trim() || null,
    };
    if (isSnapshotMode && activeBranchId) {
      // Branch edit: create a new commit with the overridden content — does NOT touch the live resume
      saveVersion.mutate({ branchId: activeBranchId, ...patch });
    } else {
      updateResume.mutate(patch, { onSuccess: () => setIsEditing(false) });
    }
  };

  const toolbarActions = (
    <>
      <RouterButton variant="text" to="/resumes">
        {t("resume.detail.backButton")}
      </RouterButton>
      <VariantSwitcher resumeId={id} currentBranchId={activeBranchId} />
      {isEditing ? (
        <>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={updateResume.isPending || saveVersion.isPending}
          >
            {updateResume.isPending || saveVersion.isPending ? t("resume.edit.saving") : t("resume.edit.saveButton")}
          </Button>
          <Button variant="outlined" onClick={() => setIsEditing(false)}>
            {t("resume.edit.backButton")}
          </Button>
        </>
      ) : (
        <>
          <Button variant="outlined" onClick={() => setIsEditing(true)}>
            {t("resume.detail.editButton")}
          </Button>
          {!isSnapshotMode && (
            <RouterButton
              variant="outlined"
              to="/assignments/new"
              search={{ resumeId: id, employeeId: resume?.employeeId }}
            >
              {t("resume.detail.addAssignment")}
            </RouterButton>
          )}
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
        chip={language ? <Chip label={language.toUpperCase()} size="small" /> : undefined}
        actions={toolbarActions}
      />

      {/* Gray canvas */}
      <Box
        ref={canvasRef}
        sx={{
          position: "relative",
          bgcolor: "background.default",
          minHeight: "calc(100vh - 56px)",
          py: 4,
          px: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
        }}
      >
        {/* Page 1 — Cover */}
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

        {/* Page 2 — Skills */}
        {hasSkills && skillsPage !== null && (
          <DocumentPage
            title={resumeTitle}
            language={language}
            page={skillsPage}
            totalPages={totalPages}
          >
            <SkillsPageContent
              employeeName={employee?.name ?? ""}
              skills={skills}
              degrees={education.filter((e) => e.type === "degree").map((e) => e.value)}
              certifications={education.filter((e) => e.type === "certification").map((e) => e.value)}
              languages={education.filter((e) => e.type === "language").map((e) => e.value)}
            />
          </DocumentPage>
        )}

        {/* AI improvement FAB — sits to the right of the document at presentation height */}
        {!isEditing && presentation.length > 0 && (
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

        {/* Page 3 — Full assignments table */}
        {hasAssignments && assignmentsPage !== null && (
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

            <TableContainer>
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
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() =>
                        void navigate({ to: "/assignments/$id", params: { id: a.id } })
                      }
                    >
                      <TableCell>{a.clientName}</TableCell>
                      <TableCell>{a.role}</TableCell>
                      <TableCell>
                        {typeof a.startDate === "string" ? a.startDate.slice(0, 10) : ""}
                      </TableCell>
                      <TableCell>
                        {a.isCurrent ? (
                          <Chip
                            label={t("resume.detail.assignmentPresent")}
                            color="success"
                            size="small"
                          />
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
            </TableContainer>
          </DocumentPage>
        )}
      </Box>
    </Box>
  );
}
