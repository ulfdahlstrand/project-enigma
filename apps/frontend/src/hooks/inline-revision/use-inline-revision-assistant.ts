import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  buildUnifiedRevisionPrompt,
  buildUnifiedRevisionKickoff,
} from "../../components/ai-assistant/lib/build-resume-revision-prompt";
import {
  appendUniqueRevisionSuggestions,
  markWorkItemsCompletedFromSuggestions,
  resolveRevisionWorkItems,
} from "../../components/revision/inline-revision";
import { createResumeActionToolRegistry } from "../../lib/ai-tools/registries/resume-action-tools";
import type {
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
  setWorkItems,
  setSuggestions,
  openAssistant,
  hideDrawer,
  assistantEntityType,
  assistantEntityId,
  assistantToolRoute,
}: Params) {
  const toolRegistry = createResumeActionToolRegistry({
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
      setSuggestions((prev) => appendUniqueRevisionSuggestions(prev, incoming));
    },
    setRevisionSuggestions: (incoming) => {
      setWorkItems((prev) => markWorkItemsCompletedFromSuggestions(prev, incoming));
      setSuggestions((prev) => appendUniqueRevisionSuggestions(prev, incoming));
    },
  });

  const toolContext: AIToolContext = {
    route: "/_authenticated/resumes/$id/actions",
    entityType: "resume",
    entityId: resumeId,
  };

  const originalContent = [resumeTitle, consultantTitle ?? "", presentation.join("\n\n"), summary ?? ""]
    .filter(Boolean)
    .join("\n\n");

  const openRevisionAssistant = useCallback((branchId: string, kickoffMessage?: string | null) => {
    if (
      assistantEntityType === "resume-revision-actions" &&
      assistantEntityId === branchId &&
      assistantToolRoute === toolContext.route
    ) {
      hideDrawer();
      return;
    }

    openAssistant({
      entityType: "resume-revision-actions",
      entityId: branchId,
      title: t("revision.inline.actionsConversationTitle"),
      systemPrompt: buildUnifiedRevisionPrompt(language),
      kickoffMessage: kickoffMessage ?? buildUnifiedRevisionKickoff(),
      originalContent,
      toolRegistry,
      toolContext,
      onAccept: () => {},
    });

    hideDrawer();
  }, [
    assistantEntityId,
    assistantEntityType,
    assistantToolRoute,
    hideDrawer,
    language,
    openAssistant,
    originalContent,
    t,
    toolContext,
    toolRegistry,
  ]);

  return {
    toolRegistry,
    toolContext,
    openRevisionAssistant,
  };
}
