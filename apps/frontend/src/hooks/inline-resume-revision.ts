import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAIConversation,
  useAIConversations,
  useCloseAIConversation,
} from "./ai-assistant";
import {
  resumeBranchesKey,
  resumeBranchHistoryGraphKey,
  useFinaliseResumeBranch,
} from "./versioning";
import {
  INLINE_REVISION_CHAT_WIDTH,
  INLINE_REVISION_CHECKLIST_WIDTH,
} from "../components/revision/inline-revision";
import { type RevisionSuggestions, type RevisionWorkItems } from "../lib/ai-tools/registries/resume-tool-schemas";
import { useAIAssistantContext } from "../lib/ai-assistant-context";
import {
  useInlineRevisionSaveVersion,
  useInlineRevisionUpdateAssignment,
} from "./inline-revision/mutations";
import {
  clearAssistantSessionParams,
  writeAssistantSessionParams,
} from "./inline-revision/url-session";
import {
  useReconcileSuggestionsAgainstContent,
  useRestoreSuggestionsFromActionConversation,
  useSyncSuggestionsFromAssistant,
} from "./inline-revision/suggestion-sync";
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

  // Read URL search params (strict: false so this works from any route)
  const { assistant: assistantMode, sourceBranchId: urlSourceBranchId, sourceBranchName: urlSourceBranchName } =
    useSearch({ strict: false }) as {
      assistant?: "true";
      sourceBranchId?: string;
      sourceBranchName?: string;
    };

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

  const saveVersion = useInlineRevisionSaveVersion(resumeId);
  const updateBranchAssignment = useInlineRevisionUpdateAssignment(resumeId);

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
  const { data: existingActionConversation } = useAIConversation(latestOpenActionConversationId, {
    enabled: isOpen,
    pollingEnabled: isOpen,
  });
  const { data: activeAssistantConversation } = useAIConversation(assistantConversationId, {
    enabled: isOpen,
    pollingEnabled: isOpen,
  });

  useEffect(() => {
    if (isEditRoute) {
      return;
    }

    if (
      activeBranchId !== null &&
      activeBranchId !== mainBranchId &&
      assistantMode === "true"
    ) {
      // Still on view route — let the restore effect handle after navigation
      return;
    }

    setIsOpen(false);
  }, [activeBranchId, assistantMode, isEditRoute, mainBranchId]);

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
    conversationId: assistantEntityType === "resume-revision-actions" && assistantEntityId === activeBranchId
      ? assistantConversationId
      : latestOpenActionConversationId,
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

    // Persist session state in URL so page reloads restore the session
    writeAssistantSessionParams(navigate, {
      assistantBranchId: activeBranchId,
      assistantBranchName: activeBranchName,
    });

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
    clearAssistantSessionParams(navigate);
  };

  const close = () => {
    setIsOpen(false);
    hideDrawer();
    clearAssistantSessionParams(navigate);
  };

  // Restore session from URL params when page loads with ?assistant=true
  useEffect(() => {
    if (!activeBranchId || activeBranchId === mainBranchId || !isEditRoute) {
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

    if (assistantMode !== "true") {
      restoredBranchIdRef.current = activeBranchId;
      return;
    }

    // Wait for the conversation list to load before deciding whether to restore
    if (existingActionConversations === undefined) {
      return;
    }

    restoredBranchIdRef.current = activeBranchId;

    setIsOpen(true);
    setIsFinalized(false);
    setSuggestions(null);
    setSourceBranchId(urlSourceBranchId ?? activeBranchId);
    setSourceBranchName(urlSourceBranchName ?? activeBranchName);
    setWorkItems(null);

    const restoredConversationId = latestOpenActionConversationId ?? null;
    const restoredKickoff = restoredConversationId === null ? null : undefined;
    openRevisionAssistant({
      branchId: activeBranchId,
      kickoffMessage: restoredKickoff,
      initialConversationId: restoredConversationId ?? undefined,
    });
  }, [
    activeBranchId,
    assistantMode,
    existingActionConversations,
    isEditRoute,
    isOpen,
    latestOpenActionConversationId,
    mainBranchId,
    openRevisionAssistant,
    urlSourceBranchId,
    urlSourceBranchName,
    activeBranchName,
  ]);

  useRestoreSuggestionsFromActionConversation({
    isOpen,
    suggestions,
    existingActionConversation,
    setSuggestions,
  });

  useSyncSuggestionsFromAssistant({
    isOpen,
    activeBranchId,
    assistantEntityType,
    assistantEntityId,
    activeAssistantConversation,
    setWorkItems,
    setSuggestions,
  });

  useReconcileSuggestionsAgainstContent({
    suggestions,
    resumeTitle,
    consultantTitle,
    presentation,
    summary,
    skills,
    sortedAssignments,
    setSuggestions,
  });

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

    openingRevisionBranchIdRef.current = branchHandoff.branchId;

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: resumeBranchesKey(resumeId) }),
      queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(resumeId) }),
      queryClient.invalidateQueries({ queryKey: ["getResume", resumeId] }),
    ]).then(() =>
      navigate({
        to: "/resumes/$id/edit/branch/$branchId",
        params: { id: resumeId, branchId: branchHandoff.branchId },
        search: {
          assistant: "true",
          sourceBranchId: activeBranchId ?? undefined,
          sourceBranchName: activeBranchName,
        },
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
    const currentSourceBranchId = sourceBranchId ?? urlSourceBranchId;
    if (!activeBranchId || !currentSourceBranchId) {
      return;
    }

    finaliseInlineRevision.mutate(
      {
        sourceBranchId: currentSourceBranchId,
        revisionBranchId: activeBranchId,
        action,
      },
      {
        onSuccess: async (data) => {
          if (assistantConversationId && !activeAssistantConversation?.isClosed) {
            await closeActionConversation.mutateAsync({ conversationId: assistantConversationId });
          }

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["getResume", resumeId] }),
            queryClient.invalidateQueries({ queryKey: resumeBranchesKey(resumeId) }),
            queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(resumeId) }),
            queryClient.invalidateQueries({
              queryKey: ["listAIConversations", "resume-revision-actions", activeBranchId],
            }),
            queryClient.invalidateQueries({ queryKey: ["getResume", resumeId] }),
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
    sourceBranchName: sourceBranchName ?? urlSourceBranchName ?? activeBranchName,
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
