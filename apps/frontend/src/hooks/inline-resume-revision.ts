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
} from "./versioning";
import { orpc } from "../orpc-client";
import {
  INLINE_REVISION_CHAT_WIDTH,
  INLINE_REVISION_CHECKLIST_WIDTH,
  appendUniqueRevisionSuggestions,
  reconcileRevisionSuggestionsWithCurrentContent,
} from "../components/revision/inline-revision";
import { type RevisionSuggestions, type RevisionWorkItems } from "../lib/ai-tools/registries/resume-tool-schemas";
import { useAIAssistantContext } from "../lib/ai-assistant-context";
import {
  deriveSuggestionsFromConversation,
  deriveWorkItemsFromConversation,
} from "./inline-revision/conversation";
import {
  clearPersistedInlineRevisionSession,
  patchPersistedInlineRevisionSession,
  readPersistedInlineRevisionSession,
  writePersistedInlineRevisionSession,
} from "./inline-revision/storage";
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
  const [isFinalized, setIsFinalized] = useState(false);
  const [workItems, setWorkItems] = useState<RevisionWorkItems | null>(null);
  const [suggestions, setSuggestions] = useState<RevisionSuggestions | null>(null);
  const [sourceBranchName, setSourceBranchName] = useState<string | null>(null);
  const [sourceBranchId, setSourceBranchId] = useState<string | null>(null);
  const [isPreparingFinalize, setIsPreparingFinalize] = useState(false);
  const lastInlineRevisionBranchIdRef = useRef<string | null>(null);
  const restoredBranchIdRef = useRef<string | null>(null);
  const openingRevisionBranchIdRef = useRef<string | null>(null);

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

  const finaliseInlineRevision = useFinaliseResumeBranch();
  const closeActionConversation = useCloseAIConversation(
    "resume-revision-actions",
    activeBranchId,
  );
  const { data: existingActionConversations } = useAIConversations(
    activeBranchId && activeBranchId !== mainBranchId ? "resume-revision-actions" : null,
    activeBranchId && activeBranchId !== mainBranchId ? activeBranchId : null,
  );
  const latestOpenActionConversationId =
    [...(existingActionConversations?.conversations ?? [])]
      .reverse()
      .find((conversation) => !conversation.isClosed)?.id ?? null;
  const { data: existingActionConversation } = useAIConversation(latestOpenActionConversationId);
  const { data: activeAssistantConversation } = useAIConversation(assistantConversationId);

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

    if (isFinalized) {
      lastInlineRevisionBranchIdRef.current = activeBranchId;
      return;
    }

    if (
      lastInlineRevisionBranchIdRef.current !== null &&
      activeBranchId !== lastInlineRevisionBranchIdRef.current &&
      activeBranchId !== openingRevisionBranchIdRef.current
    ) {
      closeAssistant();
    }

    lastInlineRevisionBranchIdRef.current = activeBranchId;
  }, [activeBranchId, closeAssistant, isFinalized, isOpen]);

  const {
    toolRegistry,
    toolContext,
    openRevisionAssistant,
  } = useInlineRevisionAssistant({
    resumeId,
    resumeInspectionSnapshot,
    resumeTitle,
    consultantTitle,
    presentation,
    summary,
    language: i18n.resolvedLanguage ?? i18n.language,
    t,
    setWorkItems,
    setSuggestions,
    openAssistant,
    hideDrawer,
    assistantEntityType,
    assistantEntityId,
    assistantToolRoute: assistantToolContext?.route,
  });

  const openRevisionAssistantRef = useRef(openRevisionAssistant);
  useLayoutEffect(() => {
    openRevisionAssistantRef.current = openRevisionAssistant;
  });

  const handledBranchHandoffRef = useRef<string | null>(null);

  const {
    selectedSuggestionId,
    applyingSuggestionId,
    reviewDialog,
    hasUnsavedChanges,
    openSuggestionReview,
    dismissSuggestion,
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
    persistSuggestions: (updater) => {
      if (!activeBranchId || activeBranchId === mainBranchId) {
        return;
      }

      patchPersistedInlineRevisionSession(activeBranchId, (current) => {
        const nextSuggestions = updater(current?.suggestions ?? suggestions ?? null);
        return {
          version: 3,
          sourceBranchId: current?.sourceBranchId ?? sourceBranchId,
          sourceBranchName: current?.sourceBranchName ?? sourceBranchName,
          conversationId:
            current?.conversationId
            ?? (
              assistantEntityType === "resume-revision-actions" && assistantEntityId === activeBranchId
                ? assistantConversationId
                : null
            ),
          suggestions: nextSuggestions,
        };
      });
    },
    saveVersion: async (input) => saveVersion.mutateAsync(input),
    updateBranchAssignment: updateBranchAssignment.mutateAsync,
    buildDraftPatchFromValues,
  });

  const open = async () => {
    if (!activeBranchId || isOpen) {
      return;
    }

    setIsOpen(true);
    setIsFinalized(false);
    setSourceBranchName(activeBranchName);
    setSourceBranchId(activeBranchId);
    setWorkItems(null);
    setSuggestions(null);

    try {
      openRevisionAssistantRef.current({ branchId: activeBranchId });
    } catch (error) {
      setIsOpen(false);
      setSourceBranchName(null);
      setSourceBranchId(null);
      setWorkItems(null);
      setSuggestions(null);
      throw error;
    }
  };

  const reset = () => {
    setIsOpen(false);
    setIsFinalized(false);
    setWorkItems(null);
    setSuggestions(null);
    setSourceBranchName(null);
    setSourceBranchId(null);
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
    setIsFinalized(false);
    setSuggestions(persistedSession.suggestions);
    setSourceBranchId(persistedSession.sourceBranchId);
    setSourceBranchName(persistedSession.sourceBranchName);
    setWorkItems(null);

    const restoredConversationId =
      persistedSession.conversationId ?? latestOpenActionConversationId ?? null;
    const restoredKickoff = restoredConversationId === null ? null : undefined;
    openRevisionAssistant({
      branchId: activeBranchId,
      kickoffMessage: restoredKickoff,
      initialConversationId: restoredConversationId,
    });
  }, [
    activeBranchId,
    isEditRoute,
    isOpen,
    latestOpenActionConversationId,
    mainBranchId,
    navigate,
    openRevisionAssistant,
    resumeId,
  ]);

  useLayoutEffect(() => {
    if (!activeBranchId || activeBranchId === mainBranchId || !isOpen) {
      return;
    }

    writePersistedInlineRevisionSession(activeBranchId, {
      version: 3,
      sourceBranchId,
      sourceBranchName,
      conversationId:
        assistantEntityType === "resume-revision-actions" && assistantEntityId === activeBranchId
          ? assistantConversationId
          : null,
      suggestions,
    });
  }, [
    activeBranchId,
    assistantConversationId,
    assistantEntityId,
    assistantEntityType,
    isOpen,
    mainBranchId,
    sourceBranchId,
    sourceBranchName,
    suggestions,
  ]);

  useEffect(() => {
    if (!isOpen || suggestions || !existingActionConversation) {
      return;
    }

    const restoredSuggestions =
      existingActionConversation.revisionSuggestions
      ?? deriveSuggestionsFromConversation(existingActionConversation.messages);
    if (restoredSuggestions) {
      setSuggestions((prev) => appendUniqueRevisionSuggestions(prev, restoredSuggestions));
    }
  }, [existingActionConversation, isOpen, suggestions]);

  useEffect(() => {
    const currentConversation = activeAssistantConversation;
    if (!isOpen || !currentConversation) {
      return;
    }

    if (
      activeBranchId &&
      assistantEntityType === "resume-revision-actions" &&
      assistantEntityId === activeBranchId
    ) {
      const derivedWorkItems = deriveWorkItemsFromConversation(currentConversation.messages);
      if (derivedWorkItems) {
        setWorkItems(derivedWorkItems);
      }

      const derivedSuggestions =
        currentConversation.revisionSuggestions
        ?? deriveSuggestionsFromConversation(currentConversation.messages);
      if (derivedSuggestions) {
        setSuggestions((prev) => appendUniqueRevisionSuggestions(prev, derivedSuggestions));
      }
    }
  }, [
    activeAssistantConversation,
    activeBranchId,
    assistantEntityId,
    assistantEntityType,
    isOpen,
  ]);

  useEffect(() => {
    if (!suggestions) {
      return;
    }

    const reconciled = reconcileRevisionSuggestionsWithCurrentContent(suggestions, {
      title: resumeTitle,
      consultantTitle,
      presentation,
      summary,
      skills,
      assignments: sortedAssignments.map((assignment) => ({
        id: assignment.assignmentId ?? assignment.id,
        ...(assignment.description !== undefined ? { description: assignment.description } : {}),
      })),
    });

    const didChange = JSON.stringify(reconciled) !== JSON.stringify(suggestions);
    if (!didChange) {
      return;
    }

    setSuggestions(reconciled);

    if (activeBranchId && activeBranchId !== mainBranchId) {
      patchPersistedInlineRevisionSession(activeBranchId, (current) => current ? {
        ...current,
        suggestions: reconciled,
      } : current);
    }
  }, [
    activeBranchId,
    consultantTitle,
    mainBranchId,
    presentation,
    resumeTitle,
    skills,
    sortedAssignments,
    suggestions,
    summary,
  ]);

  useEffect(() => {
    const branchHandoff = activeAssistantConversation?.latestBranchHandoff;
    if (
      !isOpen
      || !assistantConversationId
      || !branchHandoff
      || handledBranchHandoffRef.current === branchHandoff.branchId
    ) {
      return;
    }

    handledBranchHandoffRef.current = branchHandoff.branchId;

    clearPersistedInlineRevisionSession(activeBranchId);

    writePersistedInlineRevisionSession(branchHandoff.branchId, {
      version: 3,
      sourceBranchId: activeBranchId,
      sourceBranchName: activeBranchName,
      conversationId: null,
      suggestions: null,
    });

    openingRevisionBranchIdRef.current = branchHandoff.branchId;

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: resumeBranchesKey(resumeId) }),
      queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(resumeId) }),
      queryClient.invalidateQueries({ queryKey: ["getResume", resumeId] }),
    ]).then(() =>
      navigate({
        to: "/resumes/$id/edit",
        params: { id: resumeId },
        search: { branchId: branchHandoff.branchId, assistant: "true" },
        replace: true,
      }).then(() => {
        openRevisionAssistantRef.current({
          branchId: branchHandoff.branchId,
          branchAlreadyCreated: true,
          branchGoal: branchHandoff.goal,
        });
      })
    ).finally(() => {
      openingRevisionBranchIdRef.current = null;
    });
  }, [
    activeAssistantConversation,
    activeBranchId,
    activeBranchName,
    assistantConversationId,
    isOpen,
    navigate,
    queryClient,
    resumeId,
  ]);

  const isReadyToFinalize =
    (suggestions?.suggestions.length ?? 0) > 0 &&
    (suggestions?.suggestions.every((s) => s.status !== "pending") ?? false);

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

      setIsFinalized(true);
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
          if (assistantConversationId && !activeAssistantConversation?.isClosed) {
            await closeActionConversation.mutateAsync({ conversationId: assistantConversationId });
          }

          clearPersistedInlineRevisionSession(activeBranchId);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["getResume", resumeId] }),
            queryClient.invalidateQueries({ queryKey: resumeBranchesKey(resumeId) }),
            queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(resumeId) }),
            queryClient.invalidateQueries({
              queryKey: ["listAIConversations", "resume-revision-actions", activeBranchId],
            }),
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
    stage: isFinalized ? "finalize" as const : "revision" as const,
    workItems,
    suggestions: suggestions?.suggestions ?? [],
    selectedSuggestionId,
    sourceBranchName: sourceBranchName ?? activeBranchName,
    checklistWidth: INLINE_REVISION_CHECKLIST_WIDTH,
    chatWidth: INLINE_REVISION_CHAT_WIDTH,
    toolRegistry,
    toolContext,
    applyingSuggestionId,
    isPreparingFinalize,
    isReadyToFinalize,
    isOpening: false,
    isMerging: finaliseInlineRevision.isPending && finaliseInlineRevision.variables?.action === "merge",
    isKeeping: finaliseInlineRevision.isPending && finaliseInlineRevision.variables?.action === "keep",
    reviewDialog,
    open,
    close,
    reset: () => {
      clearPersistedInlineRevisionSession(activeBranchId);
      reset();
    },
    prepareFinalize,
    backToRevision: () => setIsFinalized(false),
    selectSuggestion,
    openSuggestionReview,
    dismissSuggestion,
    keepBranch: () => finish("keep"),
    mergeBranch: () => finish("merge"),
  };
}
