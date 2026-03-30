import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useCloseAIConversation } from "./ai-assistant";
import {
  resumeBranchesKey,
  resumeBranchHistoryGraphKey,
  useFinaliseResumeBranch,
  useForkResumeBranch,
} from "./versioning";
import { orpc } from "../orpc-client";
import {
  buildResumeRevisionActionPrompt,
  buildResumeRevisionKickoff,
  buildResumeRevisionPrompt,
} from "../components/ai-assistant/lib/build-resume-revision-prompt";
import {
  INLINE_REVISION_CHAT_WIDTH,
  INLINE_REVISION_CHECKLIST_WIDTH,
  appendUniqueRevisionSuggestions,
  buildInlineRevisionBranchName,
  buildInlineRevisionSuggestionCommitMessage,
  buildInlineRevisionWorkItemAutomationMessage,
  buildInlineRevisionWorkItemsFromPlan,
  markWorkItemsCompletedFromSuggestions,
  type InlineRevisionStage,
} from "../components/revision/inline-revision";
import {
  createResumeActionToolRegistry,
  createResumePlanningToolRegistry,
  type RevisionPlan,
  type RevisionSuggestions,
  type RevisionWorkItems,
} from "../lib/ai-tools/registries/resume-tools";
import { useAIAssistantContext } from "../lib/ai-assistant-context";
import type { AIToolContext } from "../lib/ai-tools/types";

type DraftPatch = {
  consultantTitle?: string | null;
  presentation?: string[];
  summary?: string | null;
};

type DraftState = {
  title: string;
  presentation: string;
  summary: string;
  titleRef: MutableRefObject<string>;
  presentationRef: MutableRefObject<string>;
  summaryRef: MutableRefObject<string>;
  setTitle: (value: string) => void;
  setPresentation: (value: string) => void;
  setSummary: (value: string) => void;
};

type ResumeAssignmentLike = {
  id: string;
  assignmentId?: string;
  clientName: string;
  role: string;
  description?: string;
};

type RevisionSectionRefs = {
  coverSectionRef: RefObject<HTMLDivElement | null>;
  presentationRef: RefObject<HTMLDivElement | null>;
  skillsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentItemRefs: MutableRefObject<Record<string, HTMLElement | null>>;
};

type ResumeInspectionSnapshot = {
  resumeId: string;
  employeeName: string;
  title: string;
  consultantTitle: string | null;
  language: string | null | undefined;
  presentation: string[];
  summary: string | null;
  skills: Array<{ name: string; category: string | null; sortOrder: number }>;
  assignments: Array<{
    id: string;
    clientName: string;
    role: string;
    description: string;
    technologies: string[];
    isCurrent: boolean;
    startDate: string | null;
    endDate: string | null;
  }>;
};

type UseInlineResumeRevisionParams = {
  resumeId: string;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  activeBranchId: string | null;
  activeBranchName: string;
  activeBranchHeadCommitId: string | null;
  mainBranchId: string | null;
  baseCommitId: string | null;
  resumeTitle: string;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  sortedAssignments: ResumeAssignmentLike[];
  resumeInspectionSnapshot: ResumeInspectionSnapshot;
  sectionRefs: RevisionSectionRefs;
  draftState: DraftState;
  buildDraftPatch: () => DraftPatch;
  buildDraftPatchFromValues: (title: string, presentation: string, summary: string) => DraftPatch;
};

export function useInlineResumeRevision({
  resumeId,
  isEditing,
  setIsEditing,
  activeBranchId,
  activeBranchName,
  activeBranchHeadCommitId,
  mainBranchId,
  baseCommitId,
  resumeTitle,
  consultantTitle,
  presentation,
  summary,
  sortedAssignments,
  resumeInspectionSnapshot,
  sectionRefs,
  draftState,
  buildDraftPatch,
  buildDraftPatchFromValues,
}: UseInlineResumeRevisionParams) {
  const { t, i18n } = useTranslation("common");
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

  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<InlineRevisionStage>("planning");
  const [plan, setPlan] = useState<RevisionPlan | null>(null);
  const [workItems, setWorkItems] = useState<RevisionWorkItems | null>(null);
  const [suggestions, setSuggestions] = useState<RevisionSuggestions | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [reviewSuggestionId, setReviewSuggestionId] = useState<string | null>(null);
  const [isSuggestionReviewOpen, setIsSuggestionReviewOpen] = useState(false);
  const [pendingActionBranchId, setPendingActionBranchId] = useState<string | null>(null);
  const [sourceBranchName, setSourceBranchName] = useState<string | null>(null);
  const [sourceBranchId, setSourceBranchId] = useState<string | null>(null);
  const [planningSessionId, setPlanningSessionId] = useState<string | null>(null);
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null);
  const [isPreparingFinalize, setIsPreparingFinalize] = useState(false);
  const lastInlineRevisionBranchIdRef = useRef<string | null>(null);
  const workItemsRef = useRef<RevisionWorkItems | null>(null);

  useEffect(() => {
    workItemsRef.current = workItems;
  }, [workItems]);

  const saveVersion = useMutation({
    mutationFn: (input: Parameters<typeof orpc.saveResumeVersion>[0]) => orpc.saveResumeVersion(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resumeBranchesKey(resumeId) });
      if (activeBranchHeadCommitId) {
        await queryClient.invalidateQueries({ queryKey: ["getResumeCommit", activeBranchHeadCommitId] });
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

  const closeInlineConversation = useCloseAIConversation("resume", resumeId);
  const forkResumeBranch = useForkResumeBranch();
  const finaliseInlineRevision = useFinaliseResumeBranch();

  useEffect(() => {
    if (!isEditing) {
      setIsOpen(false);
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isOpen) {
      lastInlineRevisionBranchIdRef.current = activeBranchId;
      return;
    }

    if (stage === "planning") {
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
  }, [activeBranchId, closeAssistant, isOpen, stage]);

  const planningToolRegistry = createResumePlanningToolRegistry({
    getResumeSnapshot: () => resumeInspectionSnapshot,
    setRevisionPlan: setPlan,
  });

  const actionToolRegistry = createResumeActionToolRegistry({
    getResumeSnapshot: () => resumeInspectionSnapshot,
    setRevisionWorkItems: setWorkItems,
    markRevisionWorkItemNoChangesNeeded: ({ workItemId, note }) => {
      setWorkItems((prev) => {
        if (!prev) {
          return prev;
        }

        const target = prev.items.find((item) => item.id === workItemId);
        if (!target || target.status === "completed" || target.status === "no_changes_needed") {
          return prev;
        }

        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === workItemId ? { ...item, status: "no_changes_needed", note } : item,
          ),
        };
      });
    },
    appendRevisionSuggestions: (incoming) => {
      setWorkItems((prev) => markWorkItemsCompletedFromSuggestions(prev, incoming));
      setSuggestions((prev) => {
        const activeItems = (workItemsRef.current?.items ?? []).filter(
          (item) => item.status !== "completed" && item.status !== "no_changes_needed",
        );
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
      setWorkItems((prev) => markWorkItemsCompletedFromSuggestions(prev, incoming));
      setSuggestions((prev) => appendUniqueRevisionSuggestions(prev, incoming));
    },
  });

  const planningToolContext: AIToolContext = {
    route: "/_authenticated/resumes/$id/planning",
    entityType: "resume",
    entityId: resumeId,
  };

  const actionToolContext: AIToolContext = {
    route: "/_authenticated/resumes/$id/actions",
    entityType: "resume",
    entityId: resumeId,
  };

  const guardrail =
    stage === "actions"
      ? {
          isSatisfied:
            (workItems?.items.length ?? 0) > 0 &&
            (workItems?.items.every(
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
          isSatisfied: plan !== null,
          reminderMessage: [
            "You must use the available tools for this stage.",
            "Inspect the resume if needed and then create the agreed revision plan with set_revision_plan.",
            "If the user's goal is broad, such as proofreading the whole CV, the plan must include multiple section-based actions and must not collapse to a single typo or a single section.",
            "Do not continue with free-text execution updates until the plan has been created.",
            "Return a tool call now.",
          ].join(" "),
        };

  const automation = stage === "actions" ? buildInlineRevisionWorkItemAutomationMessage(workItems) : null;

  useEffect(() => {
    if (!pendingActionBranchId || !plan) {
      return;
    }

    if (activeBranchId !== pendingActionBranchId) {
      return;
    }

    setStage("actions");
    setPendingActionBranchId(null);
    setWorkItems(buildInlineRevisionWorkItemsFromPlan(plan));
    setSuggestions(null);

    if (
      assistantEntityType !== "resume-revision-actions" ||
      assistantEntityId !== activeBranchId ||
      assistantToolContext?.route !== actionToolContext.route
    ) {
      openAssistant({
        entityType: "resume-revision-actions",
        entityId: activeBranchId,
        title: t("revision.inline.actionsConversationTitle"),
        systemPrompt: buildResumeRevisionActionPrompt(i18n.resolvedLanguage ?? i18n.language),
        originalContent: [resumeTitle, consultantTitle ?? "", presentation.join("\n\n"), summary ?? ""]
          .filter(Boolean)
          .join("\n\n"),
        toolRegistry: actionToolRegistry,
        toolContext: actionToolContext,
        onAccept: () => {},
      });
    }

    hideDrawer();
  }, [
    actionToolContext,
    actionToolRegistry,
    activeBranchId,
    assistantEntityId,
    assistantEntityType,
    assistantToolContext?.route,
    consultantTitle,
    hideDrawer,
    i18n.language,
    i18n.resolvedLanguage,
    openAssistant,
    pendingActionBranchId,
    plan,
    presentation,
    resumeTitle,
    summary,
    t,
  ]);

  const openPlanning = () => {
    const nextPlanningSessionId = planningSessionId ?? crypto.randomUUID();
    if (!planningSessionId) {
      setPlanningSessionId(nextPlanningSessionId);
    }

    setStage("planning");
    if (
      assistantEntityType !== "resume-revision-planning" ||
      assistantEntityId !== nextPlanningSessionId ||
      assistantToolContext?.route !== planningToolContext.route
    ) {
      openAssistant({
        entityType: "resume-revision-planning",
        entityId: nextPlanningSessionId,
        title: t("revision.inline.conversationTitle"),
        systemPrompt: buildResumeRevisionPrompt(i18n.resolvedLanguage ?? i18n.language),
        kickoffMessage: buildResumeRevisionKickoff(),
        originalContent: [resumeTitle, consultantTitle ?? "", presentation.join("\n\n"), summary ?? ""]
          .filter(Boolean)
          .join("\n\n"),
        toolRegistry: planningToolRegistry,
        toolContext: planningToolContext,
        onAccept: () => {},
      });
    }

    hideDrawer();
  };

  const openActions = async () => {
    if (!plan || !baseCommitId) {
      return;
    }

    if (assistantConversationId) {
      await closeInlineConversation.mutateAsync({ conversationId: assistantConversationId });
    }

    const newBranch = await forkResumeBranch.mutateAsync({
      fromCommitId: baseCommitId,
      name: buildInlineRevisionBranchName(plan),
      resumeId,
    });

    setPendingActionBranchId(newBranch.id);
    await navigate({
      to: "/resumes/$id",
      params: { id: resumeId },
      search: { branchId: newBranch.id },
      replace: true,
    });
  };

  const open = () => {
    setIsEditing(true);
    setIsOpen(true);
    setSourceBranchName(activeBranchName);
    setSourceBranchId(activeBranchId);
    setPlanningSessionId(crypto.randomUUID());
    setPlan(null);
    setWorkItems(null);
    setSuggestions(null);
    setSelectedSuggestionId(null);
    setReviewSuggestionId(null);
    setIsSuggestionReviewOpen(false);
    setPendingActionBranchId(null);
    openPlanning();
  };

  const reset = () => {
    setIsOpen(false);
    setIsEditing(false);
    setStage("planning");
    setPlan(null);
    setWorkItems(null);
    setSuggestions(null);
    setSelectedSuggestionId(null);
    setReviewSuggestionId(null);
    setIsSuggestionReviewOpen(false);
    setSourceBranchName(null);
    setSourceBranchId(null);
    setPlanningSessionId(null);
    setPendingActionBranchId(null);
    setApplyingSuggestionId(null);
    setIsPreparingFinalize(false);
    closeAssistant();
  };

  const close = () => {
    setIsOpen(false);
    hideDrawer();
  };

  const getSuggestionOriginalText = (suggestion: RevisionSuggestions["suggestions"][number]) => {
    const section = suggestion.section.trim().toLowerCase();

    if (suggestion.assignmentId) {
      const matchingAssignment = sortedAssignments.find((assignment) => {
        const assignmentIdentityId = assignment.assignmentId ?? assignment.id;
        return assignmentIdentityId === suggestion.assignmentId;
      });

      if (matchingAssignment?.description) {
        return matchingAssignment.description;
      }
    }

    if (section.includes("title") || section.includes("titel") || section.includes("consultant")) {
      return consultantTitle ?? "";
    }

    if (section.includes("presentation") || section.includes("profil") || section.includes("intro")) {
      return presentation.join("\n\n");
    }

    if (section.includes("summary") || section.includes("sammanfatt")) {
      return summary ?? "";
    }

    if (section.includes("assignment") || section.includes("uppdrag") || section.includes("experience")) {
      const matchingAssignment = sortedAssignments.find((assignment) => {
        const client = assignment.clientName.toLowerCase();
        const role = assignment.role.toLowerCase();
        return section.includes(client) || section.includes(role);
      });

      if (matchingAssignment?.description) {
        return matchingAssignment.description;
      }
    }

    return "";
  };

  const applySuggestionTextToDraft = (suggestion: RevisionSuggestions["suggestions"][number]) => {
    const section = suggestion.section.trim().toLowerCase();
    const suggestedText = suggestion.suggestedText.trim();
    let nextTitle = draftState.titleRef.current;
    let nextPresentation = draftState.presentationRef.current;
    let nextSummary = draftState.summaryRef.current;

    if (section.includes("title") || section.includes("titel") || section.includes("consultant")) {
      nextTitle = suggestedText;
    } else if (section.includes("presentation") || section.includes("profil") || section.includes("intro")) {
      nextPresentation = suggestedText;
    } else if (section.includes("summary") || section.includes("sammanfatt")) {
      nextSummary = suggestedText;
    } else {
      return null;
    }

    draftState.titleRef.current = nextTitle;
    draftState.presentationRef.current = nextPresentation;
    draftState.summaryRef.current = nextSummary;
    draftState.setTitle(nextTitle);
    draftState.setPresentation(nextPresentation);
    draftState.setSummary(nextSummary);
    return buildDraftPatchFromValues(nextTitle, nextPresentation, nextSummary);
  };

  const applySuggestionToAssignment = async (suggestion: RevisionSuggestions["suggestions"][number]) => {
    if (!suggestion.assignmentId || !activeBranchId) {
      return false;
    }

    const targetAssignment = sortedAssignments.find((assignment) => {
      const assignmentIdentityId = assignment.assignmentId ?? assignment.id;
      return assignmentIdentityId === suggestion.assignmentId;
    });

    if (!targetAssignment) {
      return false;
    }

    const branchAssignmentId = targetAssignment.id;
    const nextDescription = suggestion.suggestedText.trim();
    const assignmentsQueryKey = ["listBranchAssignmentsFull", activeBranchId] as const;
    const previousAssignments = queryClient.getQueryData<ResumeAssignmentLike[]>(assignmentsQueryKey);

    queryClient.setQueryData<ResumeAssignmentLike[]>(assignmentsQueryKey, (prev) =>
      (prev ?? []).map((assignment) =>
        assignment.id === branchAssignmentId ? { ...assignment, description: nextDescription } : assignment,
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

  const approveSuggestion = async (suggestionId: string) => {
    const suggestion = suggestions?.suggestions.find((item) => item.id === suggestionId);
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
    setSuggestions((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        suggestions: prev.suggestions.map((item) =>
          item.id === suggestionId ? { ...item, status: "accepted" } : item,
        ),
      };
    });
  };

  const dismissSuggestion = (suggestionId: string) => {
    setSelectedSuggestionId(suggestionId);
    setSuggestions((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        suggestions: prev.suggestions.map((item) =>
          item.id === suggestionId ? { ...item, status: "dismissed" } : item,
        ),
      };
    });
  };

  const openSuggestionReview = (suggestionId: string) => {
    setSelectedSuggestionId(suggestionId);
    setReviewSuggestionId(suggestionId);
    setIsSuggestionReviewOpen(true);
  };

  const closeSuggestionReview = () => {
    setIsSuggestionReviewOpen(false);
    setReviewSuggestionId(null);
  };

  const scrollSuggestionIntoView = (suggestionId: string) => {
    const suggestion = suggestions?.suggestions.find((item) => item.id === suggestionId);
    if (!suggestion) {
      return;
    }

    const section = suggestion.section.trim().toLowerCase();
    let target: HTMLElement | null = null;

    if (suggestion.assignmentId) {
      const assignmentTarget = sectionRefs.assignmentItemRefs.current[suggestion.assignmentId];
      if (assignmentTarget) {
        setSelectedSuggestionId(suggestionId);
        assignmentTarget.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    if (section.includes("skills") || section.includes("kompetens")) {
      target = sectionRefs.skillsSectionRef.current;
    } else if (section.includes("assignment") || section.includes("uppdrag") || section.includes("experience")) {
      target = sectionRefs.assignmentsSectionRef.current;
    } else if (
      section.includes("presentation") ||
      section.includes("profil") ||
      section.includes("summary") ||
      section.includes("sammanfatt") ||
      section.includes("title") ||
      section.includes("titel")
    ) {
      target = sectionRefs.presentationRef.current ?? sectionRefs.coverSectionRef.current;
    } else {
      target = sectionRefs.coverSectionRef.current;
    }

    setSelectedSuggestionId(suggestionId);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const hasUnsavedChanges =
    draftState.titleRef.current !== (consultantTitle ?? "") ||
    draftState.presentationRef.current !== presentation.join("\n\n") ||
    draftState.summaryRef.current !== (summary ?? "");

  const isReadyToFinalize =
    (workItems?.items.length ?? 0) > 0 &&
    (workItems?.items.every(
      (item) => item.status === "completed" || item.status === "no_changes_needed",
    ) ?? false) &&
    (suggestions?.suggestions.every((suggestion) => suggestion.status !== "pending") ?? true);

  const prepareFinalize = async () => {
    if (!activeBranchId) {
      return;
    }

    setIsPreparingFinalize(true);
    try {
      if (hasUnsavedChanges) {
        await saveVersion.mutateAsync({
          branchId: activeBranchId,
          message: t("revision.inline.finalizeCommitMessage"),
          ...buildDraftPatch(),
        });
      }

      setStage("finalize");
      hideDrawer();
    } finally {
      setIsPreparingFinalize(false);
    }
  };

  const finish = (action: "merge" | "keep") => {
    if (!activeBranchId || !sourceBranchId) {
      return;
    }

    finaliseInlineRevision.mutate(
      {
        sourceBranchId,
        revisionBranchId: activeBranchId,
        action,
      },
      {
        onSuccess: async (data) => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["getResume", resumeId] }),
            queryClient.invalidateQueries({ queryKey: resumeBranchesKey(resumeId) }),
            queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(resumeId) }),
            queryClient.invalidateQueries({ queryKey: ["listBranchAssignmentsFull", sourceBranchId] }),
            queryClient.invalidateQueries({ queryKey: ["listBranchAssignmentsFull", data.resultBranchId] }),
          ]);

          reset();
          void navigate({
            to: "/resumes/$id",
            params: { id: resumeId },
            search:
              action === "merge" && data.resultBranchId === mainBranchId
                ? {}
                : { branchId: data.resultBranchId },
            replace: true,
          });
        },
      },
    );
  };

  const reviewSuggestion = reviewSuggestionId
    ? suggestions?.suggestions.find((item) => item.id === reviewSuggestionId) ?? null
    : null;

  return {
    isOpen,
    stage,
    plan,
    workItems,
    suggestions: suggestions?.suggestions ?? [],
    selectedSuggestionId,
    sourceBranchName: sourceBranchName ?? activeBranchName,
    checklistWidth: INLINE_REVISION_CHECKLIST_WIDTH,
    chatWidth: INLINE_REVISION_CHAT_WIDTH,
    planningToolRegistry,
    actionToolRegistry,
    planningToolContext,
    actionToolContext,
    guardrail,
    automation,
    applyingSuggestionId,
    isPreparingFinalize,
    isReadyToFinalize,
    isMovingToActions:
      pendingActionBranchId !== null || forkResumeBranch.isPending || closeInlineConversation.isPending,
    isMerging: finaliseInlineRevision.isPending && finaliseInlineRevision.variables?.action === "merge",
    isKeeping: finaliseInlineRevision.isPending && finaliseInlineRevision.variables?.action === "keep",
    reviewDialog: reviewSuggestion
      ? {
          isOpen: isSuggestionReviewOpen,
          original: getSuggestionOriginalText(reviewSuggestion),
          suggested: reviewSuggestion.suggestedText ?? "",
          onApply: async () => {
            await approveSuggestion(reviewSuggestion.id);
            closeSuggestionReview();
          },
          onKeepEditing: closeSuggestionReview,
          onDiscard: () => {
            dismissSuggestion(reviewSuggestion.id);
            closeSuggestionReview();
          },
        }
      : null,
    open,
    close,
    reset,
    openActions,
    prepareFinalize,
    backToActions: () => setStage("actions"),
    selectSuggestion: scrollSuggestionIntoView,
    openSuggestionReview,
    keepBranch: () => finish("keep"),
    mergeBranch: () => finish("merge"),
  };
}
