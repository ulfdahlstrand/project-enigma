import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAIConversation,
  useAIConversations,
  useCloseAIConversation,
} from "./ai-assistant";
import {
  resumeCommitsKey,
  resumeBranchesKey,
  resumeBranchHistoryGraphKey,
  useFinaliseResumeBranch,
  useForkResumeBranch,
} from "./versioning";
import { orpc } from "../orpc-client";
import {
  INLINE_REVISION_CHAT_WIDTH,
  INLINE_REVISION_CHECKLIST_WIDTH,
  buildInlineRevisionBranchName,
  buildInlineRevisionWorkItemAutomationMessage,
  buildInlineRevisionWorkItemsFromPlan,
  type InlineRevisionStage,
} from "../components/revision/inline-revision";
import { type RevisionPlan, type RevisionSuggestions, type RevisionWorkItems } from "../lib/ai-tools/registries/resume-tool-schemas";
import { useAIAssistantContext } from "../lib/ai-assistant-context";
import { deriveSuggestionsFromConversation } from "./inline-revision/conversation";
import { clearPersistedInlineRevisionSession, readPersistedInlineRevisionSession, writePersistedInlineRevisionSession } from "./inline-revision/storage";
import type { UseInlineResumeRevisionParams } from "./inline-revision/types";
import { useInlineRevisionAssistant } from "./inline-revision/use-inline-revision-assistant";
import { useInlineRevisionReview } from "./inline-revision/review";

export function useInlineResumeRevision({
  resumeId,
  isEditRoute,
  activeBranchId,
  activeBranchName,
  activeBranchHeadCommitId,
  mainBranchId,
  baseCommitId,
  resumeTitle,
  consultantTitle,
  presentation,
  summary,
  highlightedItems,
  skills,
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
  const [pendingActionBranchId, setPendingActionBranchId] = useState<string | null>(null);
  const [sourceBranchName, setSourceBranchName] = useState<string | null>(null);
  const [sourceBranchId, setSourceBranchId] = useState<string | null>(null);
  const [planningSessionId, setPlanningSessionId] = useState<string | null>(null);
  const [isPreparingFinalize, setIsPreparingFinalize] = useState(false);
  const lastInlineRevisionBranchIdRef = useRef<string | null>(null);
  const workItemsRef = useRef<RevisionWorkItems | null>(null);
  const restoredBranchIdRef = useRef<string | null>(null);

  useEffect(() => {
    workItemsRef.current = workItems;
  }, [workItems]);

  const saveVersion = useMutation({
    mutationFn: (input: Parameters<typeof orpc.saveResumeVersion>[0]) => orpc.saveResumeVersion(input),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(resumeId) }),
        queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(resumeId) }),
        queryClient.invalidateQueries({ queryKey: resumeCommitsKey(variables.branchId) }),
      ]);
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
  const { data: existingActionConversations } = useAIConversations(
    activeBranchId && activeBranchId !== mainBranchId ? "resume-revision-actions" : null,
    activeBranchId && activeBranchId !== mainBranchId ? activeBranchId : null,
  );
  const existingActionConversationId =
    existingActionConversations?.conversations.at(-1)?.id ?? null;
  const { data: existingActionConversation } = useAIConversation(existingActionConversationId);

  useEffect(() => {
    if (isEditRoute) {
      return;
    }

    const hasPersistedSession =
      activeBranchId !== null &&
      activeBranchId !== mainBranchId &&
      readPersistedInlineRevisionSession(activeBranchId) !== null;

    if (!hasPersistedSession) {
      setIsOpen(false);
    }
  }, [activeBranchId, isEditRoute, mainBranchId]);

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

  const {
    planningToolRegistry,
    actionToolRegistry,
    planningToolContext,
    actionToolContext,
    openActionAssistant,
    openPlanning,
    guardrail,
    automation,
  } = useInlineRevisionAssistant({
    resumeId,
    resumeInspectionSnapshot,
    resumeTitle,
    consultantTitle,
    presentation,
    summary,
    language: i18n.resolvedLanguage ?? i18n.language,
    t,
    stage,
    plan,
    workItems,
    workItemsRef,
    setPlan,
    setWorkItems,
    setSuggestions,
    openAssistant,
    hideDrawer,
    assistantEntityType,
    assistantEntityId,
    assistantToolRoute: assistantToolContext?.route,
  });

  const {
    selectedSuggestionId,
    applyingSuggestionId,
    reviewDialog,
    hasUnsavedChanges,
    openSuggestionReview,
    selectSuggestion,
  } = useInlineRevisionReview({
    activeBranchId,
    consultantTitle,
    presentation,
    summary,
    highlightedItems,
    skills,
    sortedAssignments,
    sectionRefs,
    draftState,
    queryClient,
    suggestions,
    setSuggestions,
    saveVersion: async (input) => saveVersion.mutateAsync(input),
    updateBranchAssignment: updateBranchAssignment.mutateAsync,
    buildDraftPatchFromValues,
  });

  useEffect(() => {
    if (!pendingActionBranchId || !plan) {
      return;
    }

    if (activeBranchId !== pendingActionBranchId) {
      return;
    }

    const initialWorkItems = buildInlineRevisionWorkItemsFromPlan(plan);
    const initialAutomationMessage = buildInlineRevisionWorkItemAutomationMessage(initialWorkItems)?.message ?? null;

    setStage("actions");
    setPendingActionBranchId(null);
    setWorkItems(initialWorkItems);
    setSuggestions(null);
    openActionAssistant(activeBranchId, initialAutomationMessage);
  }, [
    activeBranchId,
    openActionAssistant,
    pendingActionBranchId,
    plan,
  ]);

  const startPlanning = () => {
    const nextPlanningSessionId = planningSessionId ?? crypto.randomUUID();
    if (!planningSessionId) {
      setPlanningSessionId(nextPlanningSessionId);
    }

    setStage("planning");
    openPlanning(nextPlanningSessionId);
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

    writePersistedInlineRevisionSession(newBranch.id, {
      version: 1,
      sourceBranchId: activeBranchId,
      sourceBranchName: activeBranchName,
      stage: "actions",
      plan,
      workItems: buildInlineRevisionWorkItemsFromPlan(plan),
      suggestions: null,
    });

    setPendingActionBranchId(newBranch.id);
    await navigate({
      to: "/resumes/$id/edit",
      params: { id: resumeId },
      search: { branchId: newBranch.id, assistant: "true" },
      replace: true,
    });
  };

  const open = () => {
    setIsOpen(true);
    setSourceBranchName(activeBranchName);
    setSourceBranchId(activeBranchId);
    setPlanningSessionId(crypto.randomUUID());
    setPlan(null);
    setWorkItems(null);
    setSuggestions(null);
    setPendingActionBranchId(null);
    startPlanning();
  };

  const reset = () => {
    setIsOpen(false);
    setStage("planning");
    setPlan(null);
    setWorkItems(null);
    setSuggestions(null);
    setSourceBranchName(null);
    setSourceBranchId(null);
    setPlanningSessionId(null);
    setPendingActionBranchId(null);
    setIsPreparingFinalize(false);
    closeAssistant();
  };

  const close = () => {
    setIsOpen(false);
    hideDrawer();
  };

  useEffect(() => {
    if (!activeBranchId || activeBranchId === mainBranchId) {
      restoredBranchIdRef.current = null;
      return;
    }

    if (isOpen) {
      restoredBranchIdRef.current = activeBranchId;
      return;
    }

    if (restoredBranchIdRef.current === activeBranchId) {
      return;
    }

    const persistedSession = readPersistedInlineRevisionSession(activeBranchId);
    if (!persistedSession) {
      restoredBranchIdRef.current = activeBranchId;
      return;
    }

    restoredBranchIdRef.current = activeBranchId;
    if (!isEditRoute) {
      void navigate({
        to: "/resumes/$id/edit",
        params: { id: resumeId },
        search: { branchId: activeBranchId, assistant: "true" },
        replace: true,
      });
      return;
    }

    setIsOpen(true);
    setStage(persistedSession.stage);
    setPlan(persistedSession.plan);
    setWorkItems(persistedSession.workItems);
    setSuggestions(persistedSession.suggestions);
    setSourceBranchId(persistedSession.sourceBranchId);
    setSourceBranchName(persistedSession.sourceBranchName);
    setPlanningSessionId(null);
    setPendingActionBranchId(null);
    setIsPreparingFinalize(false);
    if (persistedSession.stage === "actions") {
      const restoredAutomationMessage =
        existingActionConversationId === null
          ? buildInlineRevisionWorkItemAutomationMessage(persistedSession.workItems)?.message ?? null
          : null;
      openActionAssistant(activeBranchId, restoredAutomationMessage);
    } else {
      hideDrawer();
    }
  }, [
    activeBranchId,
    existingActionConversationId,
    hideDrawer,
    isEditRoute,
    isOpen,
    mainBranchId,
    navigate,
    openActionAssistant,
    resumeId,
  ]);

  useLayoutEffect(() => {
    if (!activeBranchId || activeBranchId === mainBranchId || !isOpen) {
      return;
    }

    if (stage !== "actions" && stage !== "finalize") {
      return;
    }

    if (stage === "actions" && !workItems && !suggestions) {
      return;
    }

    writePersistedInlineRevisionSession(activeBranchId, {
      version: 1,
      sourceBranchId,
      sourceBranchName,
      stage,
      plan,
      workItems,
      suggestions,
    });
  }, [
    activeBranchId,
    isOpen,
    mainBranchId,
    plan,
    sourceBranchId,
    sourceBranchName,
    stage,
    suggestions,
    workItems,
  ]);

  useEffect(() => {
    if (!isOpen || stage !== "actions" || suggestions || !existingActionConversation) {
      return;
    }

    const restoredSuggestions = deriveSuggestionsFromConversation(existingActionConversation.messages);
    if (restoredSuggestions) {
      setSuggestions(restoredSuggestions);
    }
  }, [existingActionConversation, isOpen, stage, suggestions]);
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
          title: t("revision.inline.finalizeCommitMessage"),
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
          clearPersistedInlineRevisionSession(activeBranchId);
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
    reviewDialog,
    open,
    close,
    reset: () => {
      clearPersistedInlineRevisionSession(activeBranchId);
      reset();
    },
    openActions,
    prepareFinalize,
    backToActions: () => setStage("actions"),
    selectSuggestion,
    openSuggestionReview,
    keepBranch: () => finish("keep"),
    mergeBranch: () => finish("merge"),
  };
}
