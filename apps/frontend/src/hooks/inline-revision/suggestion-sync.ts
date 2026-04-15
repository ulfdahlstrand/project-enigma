/**
 * Effects that keep the local suggestions state in sync with whatever the
 * backend/assistant conversation knows. Splitting these into their own
 * hooks keeps the main revision hook focused on orchestration.
 */
import { useEffect } from "react";
import {
  appendUniqueRevisionSuggestions,
  reconcileRevisionSuggestionsWithCurrentContent,
} from "../../components/revision/inline-revision";
import type {
  RevisionSuggestions,
  RevisionWorkItems,
} from "../../lib/ai-tools/registries/resume-tool-schemas";
import { deriveWorkItemsFromConversation } from "./conversation";

interface AssistantConversationLike {
  messages: unknown[];
  revisionSuggestions?: RevisionSuggestions | null;
}

interface ActionConversationLike {
  revisionSuggestions?: RevisionSuggestions | null;
}

interface RestoreSuggestionsParams {
  isOpen: boolean;
  suggestions: RevisionSuggestions | null;
  existingActionConversation: ActionConversationLike | null | undefined;
  setSuggestions: (
    updater: (prev: RevisionSuggestions | null) => RevisionSuggestions | null,
  ) => void;
}

export function useRestoreSuggestionsFromActionConversation({
  isOpen,
  suggestions,
  existingActionConversation,
  setSuggestions,
}: RestoreSuggestionsParams): void {
  useEffect(() => {
    if (!isOpen || suggestions || !existingActionConversation) {
      return;
    }

    const restoredSuggestions = existingActionConversation.revisionSuggestions;
    if (restoredSuggestions) {
      setSuggestions((prev) => appendUniqueRevisionSuggestions(prev, restoredSuggestions));
    }
  }, [existingActionConversation, isOpen, suggestions, setSuggestions]);
}

interface SyncFromAssistantParams {
  isOpen: boolean;
  activeBranchId: string | null;
  assistantEntityType: string | null;
  assistantEntityId: string | null;
  activeAssistantConversation: (AssistantConversationLike & {
    messages: Parameters<typeof deriveWorkItemsFromConversation>[0];
  }) | null | undefined;
  setWorkItems: (value: RevisionWorkItems | null) => void;
  setSuggestions: (
    updater: (prev: RevisionSuggestions | null) => RevisionSuggestions | null,
  ) => void;
}

export function useSyncSuggestionsFromAssistant({
  isOpen,
  activeBranchId,
  assistantEntityType,
  assistantEntityId,
  activeAssistantConversation,
  setWorkItems,
  setSuggestions,
}: SyncFromAssistantParams): void {
  useEffect(() => {
    if (!isOpen || !activeAssistantConversation) {
      return;
    }

    if (
      activeBranchId &&
      assistantEntityType === "resume-revision-actions" &&
      assistantEntityId === activeBranchId
    ) {
      const derivedWorkItems = deriveWorkItemsFromConversation(
        activeAssistantConversation.messages,
      );
      if (derivedWorkItems) {
        setWorkItems(derivedWorkItems);
      }

      const derivedSuggestions = activeAssistantConversation.revisionSuggestions;
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
    setSuggestions,
    setWorkItems,
  ]);
}

interface ReconcileParams {
  suggestions: RevisionSuggestions | null;
  resumeTitle: string;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  skills: Parameters<typeof reconcileRevisionSuggestionsWithCurrentContent>[1]["skills"];
  sortedAssignments: Array<{
    id: string;
    assignmentId?: string;
    description?: string;
  }>;
  setSuggestions: (next: RevisionSuggestions) => void;
}

export function useReconcileSuggestionsAgainstContent({
  suggestions,
  resumeTitle,
  consultantTitle,
  presentation,
  summary,
  skills,
  sortedAssignments,
  setSuggestions,
}: ReconcileParams): void {
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

    if (!reconciled) {
      return;
    }

    const didChange = JSON.stringify(reconciled) !== JSON.stringify(suggestions);
    if (!didChange) {
      return;
    }

    setSuggestions(reconciled);
  }, [
    consultantTitle,
    presentation,
    resumeTitle,
    skills,
    sortedAssignments,
    suggestions,
    summary,
    setSuggestions,
  ]);
}
