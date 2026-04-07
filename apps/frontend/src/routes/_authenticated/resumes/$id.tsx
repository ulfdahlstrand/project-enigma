import { z } from "zod";
import { sortAssignments } from "@cv-tool/utils";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import { orpc } from "../../../orpc-client";
import { useInlineResumeRevision } from "../../../hooks/inline-resume-revision";
import { useResumeDocumentZoom } from "../../../hooks/useResumeDocumentZoom";
import {
  resumeBranchHistoryGraphKey,
  resumeBranchesKey,
  resumeCommitsKey,
  useForkResumeBranch,
  useResumeCommits,
} from "../../../hooks/versioning";
import { PageHeader } from "../../../components/layout/PageHeader";
import { LoadingState, ErrorState } from "../../../components/feedback";
import { VariantSwitcher } from "../../../components/VariantSwitcher";
import type { AssignmentRow as EditorAssignmentRow } from "../../../components/AssignmentEditor";
import { ResumeDetailActions } from "../../../components/resume-detail/ResumeDetailActions";
import { ResumeHeaderChip } from "../../../components/resume-detail/ResumeHeaderChip";
import { ResumeRevisionReviewDialog } from "../../../components/resume-detail/ResumeRevisionReviewDialog";
import { ResumeEditWorkspace } from "../../../components/resume-detail/ResumeEditWorkspace";
import { ResumeStatusBar } from "../../../components/resume-detail/ResumeStatusBar";
import { ResumeViewWorkspace } from "../../../components/resume-detail/ResumeViewWorkspace";
import { LIST_RESUMES_QUERY_KEY } from "./index";

export const getResumeQueryKey = (id: string, branchId?: string | null) =>
  ["getResume", id, branchId ?? null] as const;
const COVER_HIGHLIGHT_COUNT = 5;
export const Route = createFileRoute("/_authenticated/resumes/$id")({
  validateSearch: z.object({
    branchId: z.string().optional(),
  }),
  component: () => <ResumeDetailPage routeMode="detail" />,
});

export function ResumeDetailPage({
  routeMode = "detail",
}: {
  routeMode?: "detail" | "edit";
}) {
  const { t } = useTranslation("common");
  const { id: idParam } = useParams({ strict: false });
  const id = idParam!;
  const isEditRoute = routeMode === "edit";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { branchId: selectedBranchId, assistant: assistantMode, sourceBranchId: urlSourceBranchId } =
    useSearch({ strict: false }) as any as {
      branchId?: string;
      assistant?: "true";
      sourceBranchId?: string;
    };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { zoom, setZoom, minZoom, maxZoom } = useResumeDocumentZoom();
  const requestedBranchId = selectedBranchId ?? null;

  const { data: resume, isLoading, isError, error } = useQuery({
    queryKey: getResumeQueryKey(id, requestedBranchId),
    queryFn: () => orpc.getResume({ id, branchId: requestedBranchId ?? undefined }),
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

  const isEditing = isEditRoute;
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPresentation, setDraftPresentation] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftHighlightedItems, setDraftHighlightedItems] = useState("");
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
      await queryClient.invalidateQueries({ queryKey: getResumeQueryKey(id, requestedBranchId) });
    },
  });

  const deleteResume = useMutation({
    mutationFn: () => orpc.deleteResume({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_RESUMES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: getResumeQueryKey(id, requestedBranchId) });
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
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(id) }),
        queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(id) }),
        queryClient.invalidateQueries({ queryKey: resumeCommitsKey(variables.branchId) }),
      ]);
    },
  });
  const forkResumeBranch = useForkResumeBranch();

  const { data: recentCommits = [] } = useResumeCommits(activeBranchId ?? mainBranchId ?? "");

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

  const assignments = liveAssignments;
  const snapshotContent = isSnapshotMode ? branchCommit?.content : null;
  const resumeTitle = snapshotContent?.title ?? resume?.title ?? "";
  const language = snapshotContent?.language ?? resume?.language;
  const consultantTitle = snapshotContent?.consultantTitle ?? resume?.consultantTitle ?? null;
  const presentation = snapshotContent?.presentation ?? resume?.presentation ?? [];
  const summary = snapshotContent?.summary ?? resume?.summary ?? null;
  const presentationText = presentation.join("\n\n");
  const sortedAssignments = sortAssignments(assignments, (a) => a.isCurrent, (a) => a.startDate);
  const editableAssignments = sortedAssignments.map((assignment) => ({
    ...assignment,
    assignmentId: assignment.assignmentId ?? assignment.id,
  })) as EditorAssignmentRow[];
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

  const snapshotSkillGroupDefs = snapshotContent
    ? (() => {
        const explicitGroups = snapshotContent.skillGroups.map((group, index) => ({
          key: group.name.trim() || `__other__${index}`,
          name: group.name.trim(),
          sortOrder: group.sortOrder,
        }));
        const seen = new Set(explicitGroups.map((group) => group.key));
        const fallbackGroups = snapshotContent.skills.reduce<Array<{ key: string; name: string; sortOrder: number }>>((acc, skill, index) => {
          const name = skill.category?.trim() || "";
          const key = name || "__other__";
          if (seen.has(key)) {
            return acc;
          }
          seen.add(key);
          return [...acc, {
            key,
            name,
            sortOrder: explicitGroups.length + index,
          }];
        }, []);

        return [...explicitGroups, ...fallbackGroups];
      })()
    : null;

  const snapshotSkillGroups = snapshotSkillGroupDefs?.map((group) => ({
    id: `snapshot-group-${group.key}`,
    resumeId: id,
    name: group.name,
    sortOrder: group.sortOrder,
  })) ?? null;

  const snapshotGroupIdByName = new Map(
    (snapshotSkillGroupDefs ?? []).map((group) => [group.name, `snapshot-group-${group.key}`]),
  );

  const snapshotSkills = snapshotContent?.skills
    ? snapshotContent.skills.map((skill, index) => ({
        id: `snapshot-skill-${index}-${skill.name}`,
        groupId: snapshotGroupIdByName.get(skill.category?.trim() || "") ?? "snapshot-group-__other__",
        name: skill.name,
        category: skill.category ?? null,
        sortOrder: skill.sortOrder ?? index,
      }))
    : null;
  const skills = isEditing ? (resume?.skills ?? []) : (snapshotSkills ?? (resume?.skills ?? []));
  const skillGroups = isEditing ? (resume?.skillGroups ?? []) : (snapshotSkillGroups ?? (resume?.skillGroups ?? []));
  const hasSkills = skills.length > 0;
  const showSkillsPage = hasSkills || isEditing;
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
    isEditRoute,
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

  useEffect(() => {
    if (!isEditRoute || assistantMode !== "true" || inlineRevision.isOpen) {
      return;
    }

    // Session restoration from URL params is handled inside useInlineResumeRevision.
    // Only call open() for a fresh start when there is no sourceBranchId in the URL.
    if (urlSourceBranchId) {
      return;
    }

    setShowSuggestionsPanel(true);
    setShowChatPanel(true);
    inlineRevision.open();
  }, [assistantMode, inlineRevision, isEditRoute, mainBranchId, selectedBranchId, urlSourceBranchId]);

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

    return <ErrorState message={isNotFound ? t("resume.detail.notFound") : t("resume.detail.error")} />;
  }

  if (isSnapshotMode && isBranchCommitError) {
    return <ErrorState message={t("resume.detail.error")} />;
  }

  const handleSave = async () => {
    const patch = buildDraftPatch();

    if (isSnapshotMode && activeBranchId) {
      // Branch edit: create a new commit with the overridden content — does NOT touch the live resume
      await saveVersion.mutateAsync({ branchId: activeBranchId, ...patch });
    } else {
      if (!mainBranchId) {
        updateResume.mutate(patch);
        return;
      }

      // Main save must update the live resume and create a visible branch commit.
      await updateResume.mutateAsync(patch);
      await saveVersion.mutateAsync({ branchId: mainBranchId, ...patch });
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

    await navigate({
      to: isEditRoute ? "/resumes/$id/edit" : "/resumes/$id",
      params: { id },
      search: { branchId: newBranch.id },
    });
  };

  const handleExitEditing = () => {
    if (isEditRoute) {
      void navigate({
        to: "/resumes/$id",
        params: { id },
        search: activeBranchId ? { branchId: activeBranchId } : {},
      });
      return;
    }

    inlineRevision.reset();
  };

  const handleToggleAssistant = () => {
    if (!isEditRoute) {
      void navigate({
        to: "/resumes/$id/edit",
        params: { id },
        search: {
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          assistant: "true",
        },
      });
      return;
    }

    if (!inlineRevision.isOpen) {
      setShowSuggestionsPanel(false);
      setShowChatPanel(true);
      void inlineRevision.open();
      return;
    }

    if (showSuggestionsPanel) {
      setShowChatPanel((current) => !current);
      return;
    }

    setShowChatPanel((current) => {
      const next = !current;
      if (!next) {
        inlineRevision.close();
      }
      return next;
    });
  };

  const handleToggleSuggestions = () => {
    if (!isEditRoute) {
      void navigate({
        to: "/resumes/$id/edit",
        params: { id },
        search: {
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          assistant: "true",
        },
      });
      return;
    }

    if (!inlineRevision.isOpen) {
      setShowSuggestionsPanel(true);
      setShowChatPanel(false);
      void inlineRevision.open();
      return;
    }

    if (showChatPanel) {
      setShowSuggestionsPanel((current) => !current);
      return;
    }

    setShowSuggestionsPanel((current) => {
      const next = !current;
      if (!next) {
        inlineRevision.close();
      }
      return next;
    });
  };

  const handleCloseRevision = () => {
    if (isEditRoute) {
      void navigate({
        to: "/resumes/$id/edit",
        params: { id },
        search: activeBranchId ? { branchId: activeBranchId } : {},
      });
    }

    setShowSuggestionsPanel(false);
    setShowChatPanel(false);
    inlineRevision.close();
  };

  const toolbarActions = (
    <ResumeDetailActions
      resumeId={id}
      resumeTitle={resumeTitle}
      activeBranchId={activeBranchId}
      isEditRoute={isEditRoute}
      isSnapshotMode={isSnapshotMode}
      isEditing={isEditing}
      baseCommitId={baseCommitId}
      isSaving={updateResume.isPending || saveVersion.isPending || forkResumeBranch.isPending}
      canSaveAsNewVersion={baseCommitId !== null}
      onSaveCurrent={() => {
        void handleSave();
      }}
      onSaveAsNewVersion={handleSaveAsNewVersion}
      onEdit={() => {
        void navigate({
          to: "/resumes/$id/edit",
          params: { id },
          search: activeBranchId ? { branchId: activeBranchId } : {},
        });
      }}
      onExitEdit={handleExitEditing}
      onDeleteResume={() => deleteResume.mutate()}
      isDeletePending={deleteResume.isPending}
      isDeleteError={deleteResume.isError}
      recentCommits={recentCommits}
      language={language ?? null}
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
        ]}
        chip={(
          <ResumeHeaderChip
            revisionModeLabel={t("revision.inline.modeChip")}
          />
        )}
        actions={toolbarActions}
      />
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
          degrees={education.filter((e) => e.type === "degree").map((e) => e.value)}
          certifications={education.filter((e) => e.type === "certification").map((e) => e.value)}
          languages={education.filter((e) => e.type === "language").map((e) => e.value)}
          isSnapshotMode={isSnapshotMode}
          getResumeQueryKey={getResumeQueryKey}
          fabTop={fabTop}
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
          assignmentsFabTop={assignmentsFabTop}
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
          consultantTitle={consultantTitle}
          presentation={presentation}
          summary={summary}
          highlightedItems={highlightedItems}
          showSkillsPage={showSkillsPage}
          skillsPage={skillsPage}
          skillGroups={skillGroups}
          skills={skills}
          degrees={education.filter((e) => e.type === "degree").map((e) => e.value)}
          certifications={education.filter((e) => e.type === "certification").map((e) => e.value)}
          languages={education.filter((e) => e.type === "language").map((e) => e.value)}
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
        activeBranchId={activeBranchId}
        language={language ?? null}
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
