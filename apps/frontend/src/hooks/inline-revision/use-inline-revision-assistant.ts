import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  buildResumeRevisionActionPrompt,
  buildResumeRevisionKickoff,
  buildResumeRevisionPrompt,
} from "../../components/ai-assistant/lib/build-resume-revision-prompt";
import {
  appendUniqueRevisionSuggestions,
  buildInlineRevisionWorkItemAutomationMessage,
  markWorkItemsCompletedFromSuggestions,
  resolveRevisionWorkItems,
  type InlineRevisionStage,
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
  stage: InlineRevisionStage;
  plan: RevisionPlan | null;
  workItems: RevisionWorkItems | null;
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

  const openActionAssistant = useCallback((branchId: string) => {
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

  return {
    planningToolRegistry,
    actionToolRegistry,
    planningToolContext,
    actionToolContext,
    openActionAssistant,
    openPlanning,
    guardrail,
    automation,
  };
}
