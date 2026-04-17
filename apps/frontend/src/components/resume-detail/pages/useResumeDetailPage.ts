/**
 * useResumeDetailPage — bundles all queries, derived values, mutations, refs,
 * draft state, handlers and side-effects for the resume detail/edit page.
 *
 * Split out of $id.tsx as a pure relocation: the order of hooks, the inputs to
 * each downstream hook, and every effect dependency array are preserved exactly.
 */
import { sortAssignments } from "@cv-tool/utils";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAsBoolean, parseAsStringEnum, useQueryState } from "nuqs";
import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { useTranslation } from "react-i18next";

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
  useResumeBranchHistoryGraph,
} from "../../../hooks/versioning";
import { LIST_RESUMES_QUERY_KEY } from "../../../routes/_authenticated/resumes/index";
import { getReachableCommitIds } from "../../../routes/_authenticated/resumes/$id_/history/history-graph-utils";
import {
  buildEditableAssignments,
  resolveResumeContent,
} from "../derive-snapshot-content";

export const getResumeQueryKey = (
  id: string,
  branchId?: string | null,
  commitId?: string | null,
): readonly ["getResume", string, string | null, string | null] =>
  ["getResume", id, branchId ?? null, commitId ?? null] as const;

interface UseResumeDetailPageInput {
  id: string;
  isEditRoute: boolean;
  forcedBranchId: string | null;
  forcedCommitId: string | null;
}

type Branch = Awaited<ReturnType<typeof orpc.listResumeBranches>>[number];
type Resume = Awaited<ReturnType<typeof orpc.getResume>>;
type Employee = Awaited<ReturnType<typeof orpc.getEmployee>>;
type ResumeCommit = Awaited<ReturnType<typeof orpc.getResumeCommit>>;
type HistoryGraph = Awaited<ReturnType<ReturnType<typeof useResumeBranchHistoryGraph>["refetch"]>>["data"];

export interface ResumeDetailPageBundle {
  // Identity / route mode
  id: string;
  isEditRoute: boolean;
  isEditing: boolean;

  // Translation / navigation
  t: ReturnType<typeof useTranslation>["t"];
  navigate: ReturnType<typeof useNavigate>;

  // Query results
  branches: Branch[] | undefined;
  resume: Resume | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  employee: Employee | undefined;
  selectedCommit: ResumeCommit | undefined;
  isSelectedCommitError: boolean;
  historyGraph: HistoryGraph | undefined;
  mergedCommitIds: Set<string>;

  // Branch derivation
  activeBranchId: string | null;
  activeBranch: Branch | undefined;
  mainBranchId: string | null;
  activeBranchName: string;
  compareBaseRef: string | null;
  activeBranchType: Branch["branchType"] | null;
  variantBranchId: string | null;
  sourceBranch: Branch | null;
  isSnapshotMode: boolean;

  // Resolved content
  resolvedEducation: ReturnType<typeof resolveResumeContent>["resolvedEducation"];
  assignments: ReturnType<typeof resolveResumeContent>["assignments"];
  resumeTitle: string;
  language: string | null | undefined;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedItems: string[];
  editableAssignments: ReturnType<typeof buildEditableAssignments>;
  skills: Array<{
    id: string;
    groupId: string;
    name: string;
    category: string | null;
    sortOrder?: number;
  }>;
  skillGroups: Array<{
    id: string;
    resumeId: string;
    name: string;
    sortOrder: number;
  }>;
  hasSkills: boolean;
  showSkillsPage: boolean;
  hasAssignments: boolean;
  baseCommitId: string | null;
  totalPages: number;
  skillsPage: number | null;
  assignmentsPage: number | null;

  // Mutations / pending flags
  updateResumeIsPending: boolean;
  saveVersionIsPending: boolean;
  forkBranchIsPending: boolean;
  deleteResumeIsPending: boolean;
  deleteResumeIsError: boolean;
  createAssignmentIsPending: boolean;
  onDeleteResume: () => void;
  onCreateAssignment: () => void;
  canCreateAssignment: boolean;

  // Refs
  canvasRef: RefObject<HTMLDivElement | null>;
  coverSectionRef: RefObject<HTMLDivElement | null>;
  presentationRef: RefObject<HTMLDivElement | null>;
  skillsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentItemRefs: MutableRefObject<Record<string, HTMLElement | null>>;

  // UI state
  showFullAssignments: boolean;
  onToggleShowFullAssignments: () => void;
  aiPanel: "suggestions" | "chat" | "both" | null;
  showSuggestionsPanel: boolean;
  showChatPanel: boolean;
  createVariantDialogOpen: boolean;
  setCreateVariantDialogOpen: (open: boolean) => void;
  newVariantName: string;
  setNewVariantName: (name: string) => void;
  createVariantError: string | null;
  setCreateVariantError: (msg: string | null) => void;
  newAssignmentId: string | null;
  onAutoEditConsumed: () => void;

  // Inline revision
  inlineRevision: ReturnType<typeof useInlineResumeRevision>;

  // Derived text used for draft comparison
  presentationText: string;
  highlightedItemsText: string;

  // Draft state (raw + setters)
  draftTitle: string;
  draftPresentation: string;
  draftSummary: string;
  draftHighlightedItems: string;
  setDraftTitle: (v: string) => void;
  setDraftPresentation: (v: string) => void;
  setDraftSummary: (v: string) => void;
  setDraftHighlightedItems: (v: string) => void;

  // Handlers
  handleSave: () => Promise<void>;
  handleCreateBranchFromCommit: (name: string) => Promise<void>;
  handleExitEditing: () => void;
  handleToggleAssistant: () => void;
  handleToggleSuggestions: () => void;
  handleCreateVariant: () => Promise<void>;
  onEdit: () => void;

  // Zoom
  zoom: number;
  minZoom: number;
  maxZoom: number;
  setZoom: (zoom: number) => void;

  // Other passthroughs
  currentViewedCommitId: string | null;
}

export function useResumeDetailPage({
  id,
  isEditRoute,
  forcedBranchId,
  forcedCommitId,
}: UseResumeDetailPageInput): ResumeDetailPageBundle {
  const { t } = useTranslation("common");
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

  const { data: historyGraph } = useResumeBranchHistoryGraph(id);
  const mergedCommitIds = getReachableCommitIds(
    historyGraph?.branches.find((b) => b.isMain)?.headCommitId ?? null,
    historyGraph?.edges ?? [],
  );

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

  // Compute the "from" ref for the quick compare shortcut.
  // Goal: diff the current branch against the main branch.
  //   1. If on main branch itself → no meaningful base, fall back to empty compare page.
  //   2. Otherwise → use main branch name as base.
  const compareBaseRef = (() => {
    const mainBranch = branches?.find((b) => b.isMain);
    if (!mainBranch || !activeBranch || activeBranch.id === mainBranch.id) return null;
    return mainBranch.name;
  })();

  const activeBranchType = activeBranch?.branchType ?? null;
  const variantBranchId = activeBranchType === "variant" ? activeBranchId : null;
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
        queryClient.invalidateQueries({ queryKey: ["getResume", id] }),
        queryClient.invalidateQueries({ queryKey: ["getTranslationStatus"] }),
      ]);
    },
  });
  const forkResumeBranch = useForkResumeBranch();

  const [showFullAssignments, setShowFullAssignments] = useQueryState(
    "showFull",
    parseAsBoolean.withDefault(true),
  );
  const [aiPanel, setAiPanel] = useQueryState(
    "aiPanel",
    parseAsStringEnum<"suggestions" | "chat" | "both">([
      "suggestions",
      "chat",
      "both",
    ]),
  );
  const showSuggestionsPanel = aiPanel === "suggestions" || aiPanel === "both";
  const showChatPanel = aiPanel === "chat" || aiPanel === "both";
  const [createVariantDialogOpen, setCreateVariantDialogOpen] = useState(false);
  const [newVariantName, setNewVariantName] = useState("");
  const [createVariantError, setCreateVariantError] = useState<string | null>(null);
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
    handleCreateBranchFromCommit,
    handleExitEditing,
    handleToggleAssistant,
    handleToggleSuggestions,
  } = useResumeDetailHandlers({
    id,
    isEditRoute,
    activeBranchId,
    mainBranchId,
    currentViewedCommitId,
    navigate,
    inlineRevision,
    aiPanel,
    setAiPanel,
    onSaveVersion: (input) => saveVersion.mutateAsync(input),
    onForkBranch: (input) => forkResumeBranch.mutateAsync(input),
    onUpdateResume: (patch) => updateResume.mutate(patch),
    buildDraftPatch,
  });

  async function handleCreateVariant(): Promise<void> {
    const name = newVariantName.trim();
    const fromCommitId = branches?.find((b) => b.isMain)?.headCommitId ?? null;
    if (!name || !fromCommitId || forkResumeBranch.isPending) return;
    setCreateVariantError(null);
    try {
      const newBranch = await forkResumeBranch.mutateAsync({ fromCommitId, name, resumeId: id });
      setCreateVariantDialogOpen(false);
      setNewVariantName("");
      await navigate({
        to: "/resumes/$id/branch/$branchId",
        params: { id, branchId: newBranch.id },
      });
    } catch {
      setCreateVariantError(t("resume.variants.createDialog.error"));
    }
  }

  useEffect(() => {
    if (!isEditRoute || assistantMode !== "true" || inlineRevision.isOpen) return;
    if (urlSourceBranchId) return;

    void setAiPanel("both");
    inlineRevision.open();
  }, [assistantMode, inlineRevision, isEditRoute, mainBranchId, urlSourceBranchId, setAiPanel]);

  useEffect(() => {
    if (wasInlineRevisionOpenRef.current && !inlineRevision.isOpen) {
      void setAiPanel(null);
    }
    wasInlineRevisionOpenRef.current = inlineRevision.isOpen;
  }, [inlineRevision.isOpen, setAiPanel]);

  useEffect(() => {
    const nextSuggestionCount = inlineRevision.suggestions.length;
    const previousSuggestionCount = previousSuggestionCountRef.current;

    if (
      isEditRoute &&
      inlineRevision.isOpen &&
      !showSuggestionsPanel &&
      nextSuggestionCount > previousSuggestionCount
    ) {
      // "chat" → "both", null → "suggestions"
      void setAiPanel((current) => (current === "chat" ? "both" : "suggestions"));
    }

    previousSuggestionCountRef.current = nextSuggestionCount;
  }, [inlineRevision.isOpen, inlineRevision.suggestions.length, isEditRoute, showSuggestionsPanel, setAiPanel]);

  const onEdit = (): void => {
    if (activeBranchId && activeBranchId !== mainBranchId) {
      void navigate({
        to: "/resumes/$id/edit/branch/$branchId",
        params: { id, branchId: activeBranchId },
      });
      return;
    }
    void navigate({ to: "/resumes/$id/edit", params: { id } });
  };

  return {
    id,
    isEditRoute,
    isEditing,
    t,
    navigate,
    branches,
    resume,
    isLoading,
    isError,
    error,
    employee,
    selectedCommit,
    isSelectedCommitError,
    historyGraph,
    mergedCommitIds,
    activeBranchId,
    activeBranch,
    mainBranchId,
    activeBranchName,
    compareBaseRef,
    activeBranchType,
    variantBranchId,
    sourceBranch,
    isSnapshotMode,
    resolvedEducation,
    assignments,
    resumeTitle,
    language,
    consultantTitle,
    presentation,
    summary,
    highlightedItems,
    editableAssignments,
    skills,
    skillGroups,
    hasSkills,
    showSkillsPage,
    hasAssignments,
    baseCommitId,
    totalPages,
    skillsPage,
    assignmentsPage,
    updateResumeIsPending: updateResume.isPending,
    saveVersionIsPending: saveVersion.isPending,
    forkBranchIsPending: forkResumeBranch.isPending,
    deleteResumeIsPending: deleteResume.isPending,
    deleteResumeIsError: deleteResume.isError,
    createAssignmentIsPending: createAssignment.isPending,
    onDeleteResume: () => deleteResume.mutate(),
    onCreateAssignment: () => void createAssignment.mutate(),
    canCreateAssignment: !!activeBranchId && !!resume?.employeeId,
    canvasRef,
    coverSectionRef,
    presentationRef,
    skillsSectionRef,
    assignmentsSectionRef,
    assignmentItemRefs,
    showFullAssignments,
    onToggleShowFullAssignments: () => setShowFullAssignments((v) => !v),
    aiPanel,
    showSuggestionsPanel,
    showChatPanel,
    createVariantDialogOpen,
    setCreateVariantDialogOpen,
    newVariantName,
    setNewVariantName,
    createVariantError,
    setCreateVariantError,
    newAssignmentId,
    onAutoEditConsumed: () => setNewAssignmentId(null),
    inlineRevision,
    presentationText,
    highlightedItemsText,
    draftTitle,
    draftPresentation,
    draftSummary,
    draftHighlightedItems,
    setDraftTitle,
    setDraftPresentation,
    setDraftSummary,
    setDraftHighlightedItems,
    handleSave,
    handleCreateBranchFromCommit,
    handleExitEditing,
    handleToggleAssistant,
    handleToggleSuggestions,
    handleCreateVariant,
    onEdit,
    zoom,
    minZoom,
    maxZoom,
    setZoom,
    currentViewedCommitId,
  };
}
