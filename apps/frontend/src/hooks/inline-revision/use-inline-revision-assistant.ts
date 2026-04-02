import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  buildResumeRevisionActionPrompt,
  buildResumeRevisionKickoff,
  buildResumeRevisionPrompt,
} from "../../components/ai-assistant/lib/build-resume-revision-prompt";
import {
  appendUniqueRevisionSuggestions,
  markWorkItemsCompletedFromSuggestions,
  resolveRevisionWorkItems,
} from "../../components/revision/inline-revision";
import { createResumeActionToolRegistry } from "../../lib/ai-tools/registries/resume-action-tools";
import { createResumePlanningToolRegistry } from "../../lib/ai-tools/registries/resume-planning-tools";
import type {
  RevisionPlan,
  RevisionSuggestions,
  RevisionWorkItems,
} from "../../lib/ai-tools/registries/resume-tool-schemas";
import type { AIToolContext } from "../../lib/ai-tools/types";
import type { OpenAssistantOptions } from "../../lib/ai-assistant-context";
import type { ResumeInspectionSnapshot } from "./types";

type Params = {
  resumeId: string;
  resumeInspectionSnapshot: ResumeInspectionSnapshot;
  resumeTitle: string;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  language: string;
  t: (key: string) => string;
  workItemsRef: { current: RevisionWorkItems | null };
  setPlan: Dispatch<SetStateAction<RevisionPlan | null>>;
  setWorkItems: Dispatch<SetStateAction<RevisionWorkItems | null>>;
  setSuggestions: Dispatch<SetStateAction<RevisionSuggestions | null>>;
  openAssistant: (params: OpenAssistantOptions) => void;
  hideDrawer: () => void;
  assistantEntityType: string | null;
  assistantEntityId: string | null;
  assistantToolRoute: string | undefined;
};

export function useInlineRevisionAssistant({
  resumeId,
  resumeInspectionSnapshot,
  resumeTitle,
  consultantTitle,
  presentation,
  summary,
  language,
  t,
  workItemsRef,
  setPlan,
  setWorkItems,
  setSuggestions,
  openAssistant,
  hideDrawer,
  assistantEntityType,
  assistantEntityId,
  assistantToolRoute,
}: Params) {
  const planningToolRegistry = createResumePlanningToolRegistry({
    getResumeSnapshot: () => resumeInspectionSnapshot,
    setRevisionPlan: setPlan,
  });

  const actionToolRegistry = createResumeActionToolRegistry({
    getResumeSnapshot: () => resumeInspectionSnapshot,
    setRevisionWorkItems: (incoming) => {
      setWorkItems((prev) => resolveRevisionWorkItems(prev, incoming));
    },
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

  const originalContent = [resumeTitle, consultantTitle ?? "", presentation.join("\n\n"), summary ?? ""]
    .filter(Boolean)
    .join("\n\n");

  const openActionAssistant = useCallback((branchId: string, kickoffMessage?: string | null) => {
    if (
      assistantEntityType === "resume-revision-actions" &&
      assistantEntityId === branchId &&
      assistantToolRoute === actionToolContext.route
    ) {
      hideDrawer();
      return;
    }

    openAssistant({
      entityType: "resume-revision-actions",
      entityId: branchId,
      title: t("revision.inline.actionsConversationTitle"),
      systemPrompt: buildResumeRevisionActionPrompt(language),
      ...(kickoffMessage ? { kickoffMessage } : {}),
      originalContent,
      toolRegistry: actionToolRegistry,
      toolContext: actionToolContext,
      onAccept: () => {},
    });

    hideDrawer();
  }, [
    actionToolContext,
    actionToolRegistry,
    assistantEntityId,
    assistantEntityType,
    assistantToolRoute,
    hideDrawer,
    language,
    openAssistant,
    originalContent,
    t,
  ]);

  const openPlanning = (planningSessionId: string) => {
    if (
      assistantEntityType !== "resume-revision-planning" ||
      assistantEntityId !== planningSessionId ||
      assistantToolRoute !== planningToolContext.route
    ) {
      openAssistant({
        entityType: "resume-revision-planning",
        entityId: planningSessionId,
        title: t("revision.inline.conversationTitle"),
        systemPrompt: buildResumeRevisionPrompt(language),
        kickoffMessage: buildResumeRevisionKickoff(),
        originalContent,
        toolRegistry: planningToolRegistry,
        toolContext: planningToolContext,
        onAccept: () => {},
      });
    }

    hideDrawer();
  };

  return {
    planningToolRegistry,
    actionToolRegistry,
    planningToolContext,
    actionToolContext,
    openActionAssistant,
    openPlanning,
  };
}
