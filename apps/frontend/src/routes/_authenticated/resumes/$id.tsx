import { sortAssignments } from "@cv-tool/utils";
import { createFileRoute, Outlet, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { orpc } from "../../../orpc-client";
import { useInlineResumeRevision } from "../../../hooks/inline-resume-revision";
import { useResumeDocumentZoom } from "../../../hooks/useResumeDocumentZoom";
import { useResumeDraftState } from "../../../hooks/useResumeDraftState";
import { useResumeDetailHandlers } from "../../../hooks/useResumeDetailHandlers";
import {
  resumeBranchHistoryGraphKey,
  resumeBranchesKey,
  resumeCommitsKey,
  useForkResumeBranch,
  useResumeCommits,
} from "../../../hooks/versioning";
import { PageHeader } from "../../../components/layout/PageHeader";
import { BreadcrumbDropdown } from "../../../components/layout/BreadcrumbDropdown";
import { LanguageSwitcher } from "../../../components/LanguageSwitcher";
import { LoadingState, ErrorState } from "../../../components/feedback";
import { TranslationStaleBanner } from "../../../components/TranslationStaleBanner";
import { RevisionActionBanner } from "../../../components/RevisionActionBanner";
import { ResumeDetailActions } from "../../../components/resume-detail/ResumeDetailActions";
import {
  buildEditableAssignments,
  resolveResumeContent,
} from "../../../components/resume-detail/derive-snapshot-content";
import { ResumeHeaderChip } from "../../../components/resume-detail/ResumeHeaderChip";
import { ResumeRevisionReviewDialog } from "../../../components/resume-detail/ResumeRevisionReviewDialog";
import { ResumeEditWorkspace } from "../../../components/resume-detail/ResumeEditWorkspace";
import { ResumeStatusBar } from "../../../components/resume-detail/ResumeStatusBar";
import { ResumeViewWorkspace } from "../../../components/resume-detail/ResumeViewWorkspace";
import { ResumeHistoryDrawer } from "../../../components/resume-detail/ResumeHistoryDrawer";
import { ResumeLayoutContext } from "../../../contexts/ResumeLayoutContext";
import { LIST_RESUMES_QUERY_KEY } from "./index";

export const getResumeQueryKey = (
  id: string,
  branchId?: string | null,
  commitId?: string | null,
) => ["getResume", id, branchId ?? null, commitId ?? null] as const;

export const Route = createFileRoute("/_authenticated/resumes/$id")({
  component: ResumeDetailLayout,
});

function ResumeDetailLayout() {
  const { id, branchId: urlBranchId, commitId: urlCommitId } = useParams({ strict: false }) as {
    id: string;
    branchId?: string;
    commitId?: string;
  };

  const { data: branches } = useQuery({
    queryKey: resumeBranchesKey(id),
    queryFn: () => orpc.listResumeBranches({ resumeId: id }),
  });

  const mainBranchId = branches?.find((b) => b.isMain)?.id ?? null;
  const activeBranchId = urlBranchId ?? mainBranchId ?? null;
  const activeBranch = branches?.find((b) => b.id === activeBranchId);

  const { data: recentCommits = [] } = useResumeCommits(activeBranchId ?? mainBranchId ?? "");

  const [historyOpen, setHistoryOpen] = useState(false);
  const currentCommitId = urlCommitId ?? activeBranch?.headCommitId ?? null;

  return (
    <ResumeLayoutContext.Provider value={{ openHistory: () => setHistoryOpen(true) }}>
      <Outlet />
      <ResumeHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        resumeId={id}
        activeBranchId={activeBranchId}
        activeBranchName={activeBranch?.name ?? null}
        currentCommitId={currentCommitId}
        recentCommits={recentCommits}
        language={(activeBranch as { language?: string | null } | undefined)?.language ?? null}
      />
    </ResumeLayoutContext.Provider>
  );
}

export function ResumeDetailPage({
  routeMode = "detail",
  forcedBranchId = null,
  forcedCommitId = null,
}: {
  routeMode?: "detail" | "edit";
  forcedBranchId?: string | null;
  forcedCommitId?: string | null;
}) {
  const { t } = useTranslation("common");
  const { id: idParam } = useParams({ strict: false });
  const id = idParam!;
  const isEditRoute = routeMode === "edit";
  const { assistant: assistantMode, sourceBranchId: urlSourceBranchId } =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSearch({ strict: false }) as any as {
      assistant?: "true";
      sourceBranchId?: string;
    };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { zoom, setZoom, minZoom, maxZoom } = useResumeDocumentZoom();

  const { data: branches } = useQuery({
    queryKey: resumeBranchesKey(id),
    queryFn: () => orpc.listResumeBranches({ resumeId: id }),
  });

  const requestedBranchId = forcedBranchId ?? null;
  const activeBranchId = requestedBranchId ?? branches?.find((b) => b.isMain)?.id ?? null;
  const activeBranch = branches?.find((b) => b.id === activeBranchId);
  const shouldReadBranchState =
    !forcedCommitId && activeBranchId !== null && activeBranch?.isMain === false;
  const resolvedBranchCommitId =
    activeBranch?.headCommitId ?? activeBranch?.forkedFromCommitId ?? null;
  const requestedCommitId =
    forcedCommitId ??
    (requestedBranchId && !shouldReadBranchState ? resolvedBranchCommitId : null);

  const { data: resume, isLoading, isError, error } = useQuery({
    queryKey: getResumeQueryKey(
      id,
      shouldReadBranchState ? activeBranchId : null,
      requestedCommitId,
    ),
    queryFn: () => {
      if (shouldReadBranchState && activeBranchId) {
        return orpc.getResumeBranch({ resumeId: id, branchId: activeBranchId });
      }
      return orpc.getResume({ id, commitId: requestedCommitId ?? undefined });
    },
    retry: false,
  });

  const mainBranchId = branches?.find((b) => b.isMain)?.id ?? resume?.mainBranchId ?? null;
  const activeBranchName = activeBranch?.name ?? t("resume.variants.mainBadge");

  const activeBranchType = activeBranch?.branchType ?? null;
  const variantBranchId =
    activeBranchType === "variant"
      ? activeBranchId
      : activeBranchType === "translation"
        ? (activeBranch?.sourceBranchId ?? null)
        : null;
  const sourceBranch =
    activeBranchType === "revision" && activeBranch?.sourceBranchId
      ? (branches?.find((b) => b.id === activeBranch.sourceBranchId) ?? null)
      : null;
  const isSnapshotMode = forcedCommitId !== null;

  const { data: selectedCommit, isError: isSelectedCommitError } = useQuery({
    queryKey: ["getResumeCommit", requestedCommitId],
    queryFn: () => orpc.getResumeCommit({ commitId: requestedCommitId! }),
    enabled: isSnapshotMode,
  });

  const { data: employee } = useQuery({
    queryKey: ["getEmployee", resume?.employeeId],
    queryFn: () => orpc.getEmployee({ id: resume!.employeeId }),
    enabled: !!resume?.employeeId,
  });

  const { data: liveBranchAssignments = [] } = useQuery({
    queryKey: ["listBranchAssignmentsFull", activeBranchId],
    queryFn: () => orpc.listBranchAssignmentsFull({ branchId: activeBranchId! }),
    enabled: !isSnapshotMode && !shouldReadBranchState && !!activeBranchId,
  });
  const { data: education = [] } = useQuery({
    queryKey: ["listEducation", resume?.employeeId],
    queryFn: () => orpc.listEducation({ employeeId: resume!.employeeId }),
    enabled: !shouldReadBranchState && !!resume?.employeeId,
  });

  const isEditing = isEditRoute;

  const updateResume = useMutation({
    mutationFn: (patch: {
      presentation?: string[];
      consultantTitle?: string | null;
      summary?: string | null;
      highlightedItems?: string[];
    }) => orpc.updateResume({ id, ...patch }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getResumeQueryKey(id, requestedBranchId, requestedCommitId),
      });
    },
  });

  const deleteResume = useMutation({
    mutationFn: () => orpc.deleteResume({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_RESUMES_QUERY_KEY });
      await queryClient.invalidateQueries({
        queryKey: getResumeQueryKey(id, requestedBranchId, requestedCommitId),
      });
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(id) }),
        queryClient.invalidateQueries({ queryKey: ["getResume", id] }),
      ]);
    },
  });

  const saveVersion = useMutation({
    mutationFn: (input: Parameters<typeof orpc.saveResumeVersion>[0]) =>
      orpc.saveResumeVersion(input),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(id) }),
        queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(id) }),
        queryClient.invalidateQueries({ queryKey: resumeCommitsKey(variables.branchId) }),
      ]);
    },
  });
  const forkResumeBranch = useForkResumeBranch();

  const [showFullAssignments, setShowFullAssignments] = useState(true);
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const wasInlineRevisionOpenRef = useRef(false);
  const previousSuggestionCountRef = useRef(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const coverSectionRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const skillsSectionRef = useRef<HTMLDivElement>(null);
  const assignmentsSectionRef = useRef<HTMLDivElement>(null);
  const assignmentItemRefs = useRef<Record<string, HTMLElement | null>>({});

  const snapshotContent = isSnapshotMode ? selectedCommit?.content : null;
  const sortedLiveAssignmentsForFallback = sortAssignments(
    liveBranchAssignments,
    (a) => a.isCurrent,
    (a) => a.startDate,
  );
  const {
    resolvedEducation,
    assignments,
    resumeTitle,
    language,
    consultantTitle,
    presentation,
    summary,
    highlightedItems,
    snapshotSkillGroups,
    snapshotSkills,
  } = resolveResumeContent({
    resumeId: id,
    employeeId: resume?.employeeId ?? "",
    snapshotContent: snapshotContent ?? null,
    isSnapshotMode,
    shouldReadBranchState,
    branchResume: resume ?? null,
    liveBranchAssignments,
    fullEducation: education,
    activeBranchLanguage: activeBranch?.language ?? null,
    sortedAssignmentsForFallback: sortedLiveAssignmentsForFallback,
  });
  const presentationText = presentation.join("\n\n");
  const sortedAssignments = sortAssignments(
    assignments,
    (a) => a.isCurrent,
    (a) => a.startDate,
  );
  const editableAssignments = buildEditableAssignments(sortedAssignments);
  const highlightedItemsText = highlightedItems.join("\n");

  const {
    draftTitle,
    draftPresentation,
    draftSummary,
    draftHighlightedItems,
    draftTitleRef,
    draftPresentationRef,
    draftSummaryRef,
    draftHighlightedItemsRef,
    setDraftTitle,
    setDraftPresentation,
    setDraftSummary,
    setDraftHighlightedItems,
    buildDraftPatch,
    buildDraftPatchFromValues,
  } = useResumeDraftState({
    isEditing,
    activeBranchId,
    consultantTitle,
    presentationText,
    summary,
    highlightedItemsText,
  });

  const skills = isEditing ? (resume?.skills ?? []) : (snapshotSkills ?? (resume?.skills ?? []));
  const skillGroups = isEditing
    ? (resume?.skillGroups ?? [])
    : (snapshotSkillGroups ?? (resume?.skillGroups ?? []));
  const hasSkills = skills.length > 0;
  const showSkillsPage = hasSkills || isEditing;
  const hasAssignments = assignments.length > 0;
  const baseCommitId = activeBranch?.headCommitId ?? null;

  const resumeInspectionSnapshot = {
    resumeId: id,
    employeeName: employee?.name ?? "",
    title: resumeTitle,
    consultantTitle,
    language,
    presentation,
    summary,
    skillGroups: skillGroups.map((group) => ({
      name: group.name,
      sortOrder: group.sortOrder,
    })),
    skills: skills.map((skill) => ({
      groupId: skill.groupId,
      name: skill.name,
      category: skill.category ?? null,
      sortOrder: skill.sortOrder ?? 0,
    })),
    assignments: sortedAssignments.map((assignment) => ({
      id: assignment.assignmentId ?? assignment.id,
      clientName: assignment.clientName,
      role: assignment.role,
      description: assignment.description,
      technologies: assignment.technologies,
      isCurrent: assignment.isCurrent,
      startDate:
        assignment.startDate instanceof Date
          ? assignment.startDate.toISOString()
          : (assignment.startDate ?? null),
      endDate:
        assignment.endDate instanceof Date
          ? assignment.endDate.toISOString()
          : (assignment.endDate ?? null),
    })),
  };

  const totalPages = 1 + (showSkillsPage ? 1 : 0) + (hasAssignments ? 1 : 0);
  const skillsPage = showSkillsPage ? 2 : null;
  const assignmentsPage = hasAssignments ? (hasSkills ? 3 : 2) : null;

  const inlineRevision = useInlineResumeRevision({
    resumeId: id,
    isEditRoute,
    activeBranchId,
    activeBranchName,
    mainBranchId,
    resumeTitle,
    consultantTitle,
    presentation,
    summary,
    highlightedItems,
    skillGroups: skillGroups.map((group) => ({
      name: group.name,
      sortOrder: group.sortOrder,
    })),
    skills: skills.map((skill) => ({
      groupId: skill.groupId,
      name: skill.name,
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

  const currentViewedCommitId = requestedCommitId ?? baseCommitId;

  const {
    handleSave,
    handleSaveAsNewVersion,
    handleCreateBranchFromCommit,
    handleExitEditing,
    handleToggleAssistant,
    handleToggleSuggestions,
  } = useResumeDetailHandlers({
    id,
    isEditRoute,
    activeBranchId,
    mainBranchId,
    baseCommitId,
    currentViewedCommitId,
    navigate,
    inlineRevision,
    showSuggestionsPanel,
    showChatPanel,
    setShowSuggestionsPanel,
    setShowChatPanel,
    onSaveVersion: (input) => saveVersion.mutateAsync(input),
    onForkBranch: (input) => forkResumeBranch.mutateAsync(input),
    onUpdateResume: (patch) => updateResume.mutate(patch),
    buildDraftPatch,
  });

  useEffect(() => {
    if (!isEditRoute || assistantMode !== "true" || inlineRevision.isOpen) return;
    if (urlSourceBranchId) return;

    setShowSuggestionsPanel(true);
    setShowChatPanel(true);
    inlineRevision.open();
  }, [assistantMode, inlineRevision, isEditRoute, mainBranchId, urlSourceBranchId]);

  useEffect(() => {
    if (wasInlineRevisionOpenRef.current && !inlineRevision.isOpen) {
      setShowSuggestionsPanel(false);
      setShowChatPanel(false);
    }
    wasInlineRevisionOpenRef.current = inlineRevision.isOpen;
  }, [inlineRevision.isOpen]);

  useEffect(() => {
    const nextSuggestionCount = inlineRevision.suggestions.length;
    const previousSuggestionCount = previousSuggestionCountRef.current;

    if (
      isEditRoute &&
      inlineRevision.isOpen &&
      !showSuggestionsPanel &&
      nextSuggestionCount > previousSuggestionCount
    ) {
      setShowSuggestionsPanel(true);
    }

    previousSuggestionCountRef.current = nextSuggestionCount;
  }, [inlineRevision.isOpen, inlineRevision.suggestions.length, isEditRoute, showSuggestionsPanel]);

  if (isLoading) return <LoadingState label={t("resume.detail.loading")} />;

  if (isError) {
    const isNotFound =
      error != null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "NOT_FOUND";

    return (
      <ErrorState
        message={isNotFound ? t("resume.detail.notFound") : t("resume.detail.error")}
      />
    );
  }

  if (isSnapshotMode && isSelectedCommitError) {
    return <ErrorState message={t("resume.detail.error")} />;
  }

  const toolbarActions = (
    <ResumeDetailActions
      resumeId={id}
      resumeTitle={resumeTitle}
      activeBranchId={activeBranchId}
      currentCommitId={currentViewedCommitId}
      isEditRoute={isEditRoute}
      isSnapshotMode={isSnapshotMode}
      isEditing={isEditing}
      baseCommitId={baseCommitId}
      isSaving={updateResume.isPending || saveVersion.isPending || forkResumeBranch.isPending}
      canSaveAsNewVersion={baseCommitId !== null}
      onSaveCurrent={() => void handleSave()}
      onSaveAsNewVersion={handleSaveAsNewVersion}
      onCreateBranchFromCommit={handleCreateBranchFromCommit}
      onEdit={() => {
        if (activeBranchId && activeBranchId !== mainBranchId) {
          void navigate({
            to: "/resumes/$id/edit/branch/$branchId",
            params: { id, branchId: activeBranchId },
          });
          return;
        }
        void navigate({ to: "/resumes/$id/edit", params: { id } });
      }}
      onExitEdit={handleExitEditing}
      onDeleteResume={() => deleteResume.mutate()}
      isDeletePending={deleteResume.isPending}
      isDeleteError={deleteResume.isError}
    />
  );

  return (
    <Box
      sx={{
        height: inlineRevision.isOpen ? "100vh" : undefined,
        display: inlineRevision.isOpen ? "flex" : "block",
        flexDirection: inlineRevision.isOpen ? "column" : undefined,
        overflow: inlineRevision.isOpen ? "hidden" : undefined,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "clip",
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
          {
            node: (
              <Typography variant="caption" color="text.primary">
                {resumeTitle}
              </Typography>
            ),
            key: "resume-title",
          },
          ...(variantBranchId !== null && branches
            ? (() => {
                const variantOptions = branches
                  .filter((b) => b.branchType === "variant")
                  .map((b) => ({ id: b.id, label: b.name }));
                const variantBranch = branches.find((b) => b.id === variantBranchId);
                return [
                  {
                    key: "branch",
                    node: (
                      <BreadcrumbDropdown
                        label={variantBranch?.name ?? activeBranchName}
                        options={variantOptions}
                        onSelect={(branchId) =>
                          void navigate({
                            to: "/resumes/$id/branch/$branchId",
                            params: { id, branchId },
                          })
                        }
                        isCurrentPage
                      />
                    ),
                  },
                  {
                    key: "language",
                    node: (
                      <LanguageSwitcher
                        resumeId={id}
                        currentBranchId={activeBranchId}
                        variantBranchId={variantBranchId}
                        ghost
                      />
                    ),
                  },
                ];
              })()
            : []),
        ]}
        hideTitleBreadcrumb
        chip={<ResumeHeaderChip revisionModeLabel={t("revision.inline.modeChip")} />}
        actions={toolbarActions}
      />
      {activeBranchType === "translation" && activeBranch?.isStale && activeBranchId ? (
        <TranslationStaleBanner resumeId={id} branchId={activeBranchId} />
      ) : null}
      {activeBranchType === "revision" && activeBranchId ? (
        <RevisionActionBanner
          resumeId={id}
          branchId={activeBranchId}
          sourceName={sourceBranch?.name ?? ""}
        />
      ) : null}
      {isEditRoute ? (
        <ResumeEditWorkspace
          inlineRevision={inlineRevision}
          activeBranchId={activeBranchId}
          activeBranchName={activeBranchName}
          resumeId={id}
          resumeTitle={resumeTitle}
          language={language ?? null}
          totalPages={totalPages}
          employeeName={employee?.name ?? ""}
          profileImageDataUrl={employee?.profileImageDataUrl ?? null}
          consultantTitle={consultantTitle}
          presentation={presentation}
          summary={summary}
          highlightedItems={highlightedItems}
          draftTitle={draftTitle}
          draftPresentation={draftPresentation}
          draftSummary={draftSummary}
          draftHighlightedItems={draftHighlightedItems}
          onDraftTitleChange={setDraftTitle}
          onDraftPresentationChange={setDraftPresentation}
          onDraftSummaryChange={setDraftSummary}
          onDraftHighlightedItemsChange={setDraftHighlightedItems}
          showSkillsPage={showSkillsPage}
          skillsPage={skillsPage}
          skillGroups={skillGroups}
          skills={skills}
          degrees={resolvedEducation.filter((e) => e.type === "degree").map((e) => e.value)}
          certifications={resolvedEducation
            .filter((e) => e.type === "certification")
            .map((e) => e.value)}
          languages={resolvedEducation.filter((e) => e.type === "language").map((e) => e.value)}
          isSnapshotMode={isSnapshotMode}
          getResumeQueryKey={getResumeQueryKey}
          hasAssignments={hasAssignments}
          assignmentsPage={assignmentsPage}
          assignments={editableAssignments}
          showFullAssignments={showFullAssignments}
          onToggleShowFullAssignments={() => setShowFullAssignments((v) => !v)}
          canvasRef={canvasRef}
          newAssignmentId={newAssignmentId}
          onAutoEditConsumed={() => setNewAssignmentId(null)}
          onCreateAssignment={() => void createAssignment.mutate()}
          createAssignmentPending={createAssignment.isPending}
          canCreateAssignment={!!activeBranchId && !!resume?.employeeId}
          presentationRef={presentationRef}
          coverSectionRef={coverSectionRef}
          skillsSectionRef={skillsSectionRef}
          assignmentsSectionRef={assignmentsSectionRef}
          assignmentItemRefs={assignmentItemRefs}
          zoom={zoom}
          showSuggestionsPanel={showSuggestionsPanel}
          showChatPanel={showChatPanel}
        />
      ) : (
        <ResumeViewWorkspace
          resumeId={id}
          resumeTitle={resumeTitle}
          language={language ?? null}
          totalPages={totalPages}
          employeeName={employee?.name ?? ""}
          profileImageDataUrl={employee?.profileImageDataUrl ?? null}
          consultantTitle={consultantTitle}
          presentation={presentation}
          summary={summary}
          highlightedItems={highlightedItems}
          showSkillsPage={showSkillsPage}
          skillsPage={skillsPage}
          skillGroups={skillGroups}
          skills={skills}
          degrees={resolvedEducation.filter((e) => e.type === "degree").map((e) => e.value)}
          certifications={resolvedEducation
            .filter((e) => e.type === "certification")
            .map((e) => e.value)}
          languages={resolvedEducation.filter((e) => e.type === "language").map((e) => e.value)}
          isSnapshotMode={isSnapshotMode}
          getResumeQueryKey={getResumeQueryKey}
          hasAssignments={hasAssignments}
          assignmentsPage={assignmentsPage}
          assignments={editableAssignments}
          showFullAssignments={showFullAssignments}
          onToggleShowFullAssignments={() => setShowFullAssignments((v) => !v)}
          canvasRef={canvasRef}
          presentationRef={presentationRef}
          coverSectionRef={coverSectionRef}
          skillsSectionRef={skillsSectionRef}
          assignmentsSectionRef={assignmentsSectionRef}
          assignmentItemRefs={assignmentItemRefs}
          activeBranchId={activeBranchId}
          zoom={zoom}
        />
      )}
      <ResumeStatusBar
        isEditing={isEditRoute}
        resumeId={id}
        activeBranchType={activeBranchType}
        variantBranchId={variantBranchId}
        zoom={zoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        onZoomChange={setZoom}
        isSuggestionsOpen={inlineRevision.isOpen && showSuggestionsPanel}
        onToggleSuggestions={handleToggleSuggestions}
        isAiOpen={inlineRevision.isOpen && showChatPanel && inlineRevision.stage !== "finalize"}
        onToggleAi={handleToggleAssistant}
      />
      <ResumeRevisionReviewDialog reviewDialog={inlineRevision.reviewDialog} />
    </Box>
  );
}
