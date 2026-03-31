import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
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
  useForkResumeBranch,
} from "./versioning";
import { orpc } from "../orpc-client";
import {
  buildResumeRevisionActionPrompt,
  buildResumeRevisionKickoff,
  buildResumeRevisionPrompt,
} from "../components/ai-assistant/lib/build-resume-revision-prompt";
import {
  renderTextDiffReview,
  type TextDiffReviewValue,
} from "../components/ai-assistant/DiffReviewDialog";
import {
  appendUniqueRevisionSuggestions,
  INLINE_REVISION_CHAT_WIDTH,
  INLINE_REVISION_CHECKLIST_WIDTH,
  buildInlineRevisionBranchName,
  buildInlineRevisionSuggestionCommitMessage,
  buildInlineRevisionWorkItemAutomationMessage,
  buildInlineRevisionWorkItemsFromPlan,
  markWorkItemsCompletedFromSuggestions,
  resolveRevisionWorkItems,
  type InlineRevisionStage,
} from "../components/revision/inline-revision";
import {
  renderSkillsReview,
  type SkillsReviewValue,
} from "../components/revision/SkillsReviewContent";
import {
  createResumeActionToolRegistry,
  createResumePlanningToolRegistry,
  normalizeRevisionSuggestionsInput,
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
  highlightedItems?: string[];
};

type DraftState = {
  title: string;
  presentation: string;
  summary: string;
  highlightedItems: string;
  titleRef: MutableRefObject<string>;
  presentationRef: MutableRefObject<string>;
  summaryRef: MutableRefObject<string>;
  highlightedItemsRef: MutableRefObject<string>;
  setTitle: (value: string) => void;
  setPresentation: (value: string) => void;
  setSummary: (value: string) => void;
  setHighlightedItems: (value: string) => void;
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
  skills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>;
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

type PersistedInlineRevisionSession = {
  version: 1;
  sourceBranchId: string | null;
  sourceBranchName: string | null;
  stage: Extract<InlineRevisionStage, "actions" | "finalize">;
  plan: RevisionPlan | null;
  workItems: RevisionWorkItems | null;
  suggestions: RevisionSuggestions | null;
};

type PersistedToolCall = {
  type: "tool_call";
  toolName: string;
  input?: unknown;
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
  highlightedItems: string[];
  skills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>;
  sortedAssignments: ResumeAssignmentLike[];
  resumeInspectionSnapshot: ResumeInspectionSnapshot;
  sectionRefs: RevisionSectionRefs;
  draftState: DraftState;
  buildDraftPatch: () => DraftPatch;
  buildDraftPatchFromValues: (title: string, presentation: string, summary: string) => DraftPatch;
};

function getInlineRevisionStorageKey(branchId: string) {
  return `inline-resume-revision:${branchId}`;
}

function readPersistedInlineRevisionSession(branchId: string): PersistedInlineRevisionSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getInlineRevisionStorageKey(branchId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedInlineRevisionSession;
    if (parsed.version !== 1) {
      return null;
    }

    if (parsed.stage !== "actions" && parsed.stage !== "finalize") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writePersistedInlineRevisionSession(
  branchId: string,
  session: PersistedInlineRevisionSession,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getInlineRevisionStorageKey(branchId), JSON.stringify(session));
}

function clearPersistedInlineRevisionSession(branchId: string | null) {
  if (typeof window === "undefined" || !branchId) {
    return;
  }

  window.localStorage.removeItem(getInlineRevisionStorageKey(branchId));
}

function extractPersistedToolCalls(text: string): PersistedToolCall[] {
  return [...text.matchAll(/```json\s*([\s\S]*?)\s*```/g)].flatMap((match) => {
    const block = match[1];
    if (!block) {
      return [];
    }

    try {
      const parsed = JSON.parse(block.trim()) as PersistedToolCall;
      if (parsed.type === "tool_call" && typeof parsed.toolName === "string") {
        return [parsed];
      }
    } catch {
      return [];
    }

    return [];
  });
}

function deriveSuggestionsFromConversation(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): RevisionSuggestions | null {
  let nextSuggestions: RevisionSuggestions | null = null;

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    for (const toolCall of extractPersistedToolCalls(message.content)) {
      if (toolCall.toolName === "set_revision_suggestions") {
        try {
          nextSuggestions = normalizeRevisionSuggestionsInput(toolCall.input as never);
        } catch {
          continue;
        }
      }

      if (toolCall.toolName === "set_assignment_suggestions") {
        try {
          const input = toolCall.input as {
            workItemId: string;
            summary?: string;
            suggestions: unknown[];
          };
          const normalizedSuggestions = normalizeRevisionSuggestionsInput({
            summary: input.summary,
            suggestions: input.suggestions,
          });

          nextSuggestions = appendUniqueRevisionSuggestions(nextSuggestions, {
            summary: normalizedSuggestions.summary,
            suggestions: normalizedSuggestions.suggestions.map((suggestion) => ({
              ...suggestion,
              id: `${input.workItemId}:${suggestion.id}`,
            })),
          });
        } catch {
          continue;
        }
      }
    }
  }

  return nextSuggestions;
}

function formatSkillsSnapshot(
  skills: Array<{ name: string; category: string | null; sortOrder: number }>,
) {
  const orderedSkills = [...skills].sort((a, b) => a.sortOrder - b.sortOrder);
  const groups = orderedSkills.reduce<Array<{ category: string; skills: string[] }>>((acc, skill) => {
    const category = skill.category?.trim() || "Other";
    const existing = acc.find((group) => group.category === category);

    if (existing) {
      existing.skills.push(skill.name);
      return acc;
    }

    return [...acc, { category, skills: [skill.name] }];
  }, []);

  return groups.map((group) => `${group.category}: ${group.skills.join(", ")}`).join("\n");
}

function normalizeSkillCategory(category: string | null | undefined) {
  return category?.trim() || "Other";
}

function groupSkillsByCategory(
  skills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>,
) {
  const orderedSkills = [...skills].sort((a, b) => a.sortOrder - b.sortOrder);

  return orderedSkills.reduce<Array<{
    category: string;
    skills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>;
  }>>((acc, skill) => {
    const category = normalizeSkillCategory(skill.category);
    const existing = acc.find((group) => group.category === category);

    if (existing) {
      existing.skills.push(skill);
      return acc;
    }

    return [...acc, { category, skills: [skill] }];
  }, []);
}

function resequenceSkillGroups(
  groups: Array<{
    category: string;
    skills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>;
  }>,
) {
  return groups.flatMap((group, groupIndex) =>
    group.skills.map((skill, skillIndex) => ({
      ...skill,
      category: group.category,
      sortOrder: groupIndex * 1000 + skillIndex,
    })),
  );
}

function isSkillsSection(section: string) {
  const normalized = section.trim().toLowerCase();
  return (
    normalized.includes("skill")
    || normalized.includes("kompetens")
    || normalized.includes("färdighet")
  );
}

function normalizeSkillsLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[\d\s.\-:]+/u, "")
    .replace(/\s+/g, " ");
}

function parseSuggestedGroupOrder(
  suggestedText: string,
  currentSkills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>,
) {
  const currentGroups = groupSkillsByCategory(currentSkills);
  const currentGroupsByLabel = new Map(
    currentGroups.map((group) => [normalizeSkillsLabel(group.category), group]),
  );
  const desiredLabels = suggestedText
    .split("\n")
    .map((line) => normalizeSkillsLabel(line))
    .filter(Boolean);

  const desiredGroups = desiredLabels
    .map((label) => currentGroupsByLabel.get(label))
    .filter((group, index, groups): group is NonNullable<typeof group> =>
      Boolean(group) && groups.findIndex((candidate) => candidate?.category === group?.category) === index,
    );

  if (desiredGroups.length < 2) {
    return null;
  }

  const desiredCategorySet = new Set(desiredGroups.map((group) => group.category));
  const remainingGroups = currentGroups.filter((group) => !desiredCategorySet.has(group.category));
  const reorderedSkills = resequenceSkillGroups([...desiredGroups, ...remainingGroups]);

  return {
    skills: reorderedSkills,
    skillScope: {
      type: "group_order" as const,
    },
  };
}

function parseSuggestedGroupContents(
  suggestedText: string,
  currentSkills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>,
) {
  const [rawCategory, rawItems] = suggestedText.split(":");
  if (!rawCategory || !rawItems) {
    return null;
  }

  const targetCategory = normalizeSkillsLabel(rawCategory);
  const currentGroups = groupSkillsByCategory(currentSkills);
  const matchingGroup = currentGroups.find((group) => normalizeSkillsLabel(group.category) === targetCategory);

  if (!matchingGroup) {
    return null;
  }

  const desiredNames = rawItems
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (desiredNames.length < 2) {
    return null;
  }

  const desiredNameSet = new Set(desiredNames.map((item) => item.toLowerCase()));
  const skillsByName = new Map(
    matchingGroup.skills.map((skill) => [skill.name.trim().toLowerCase(), skill]),
  );
  const reorderedSkills = desiredNames
    .map((name) => skillsByName.get(name.toLowerCase()))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

  if (reorderedSkills.length < 2) {
    return null;
  }

  const remainingSkills = matchingGroup.skills.filter((skill) => !desiredNameSet.has(skill.name.trim().toLowerCase()));
  const nextGroups = currentGroups.map((group) =>
    group.category === matchingGroup.category
      ? { ...group, skills: [...reorderedSkills, ...remainingSkills] }
      : group,
  );

  return {
    skills: resequenceSkillGroups(nextGroups),
    skillScope: {
      type: "group_contents" as const,
      category: matchingGroup.category,
    },
  };
}

// Handles AI output like "Skill A, Skill B, Skill C" — a flat comma-separated list of skill names
// with no category prefix. Detects which group the skills belong to and returns a group_contents result.
function parseSuggestedFlatSkillsList(
  suggestedText: string,
  currentSkills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>,
) {
  const suggestedNames = suggestedText.split(",").map((s) => s.trim()).filter(Boolean);
  if (suggestedNames.length < 2) {
    return null;
  }

  const skillsByNormalized = new Map(
    currentSkills.map((skill) => [normalizeSkillsLabel(skill.name), skill]),
  );
  const matchedSkills = suggestedNames
    .map((name) => skillsByNormalized.get(normalizeSkillsLabel(name)))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

  if (matchedSkills.length < 2) {
    return null;
  }

  const categories = new Set(matchedSkills.map((skill) => skill.category));
  if (categories.size !== 1) {
    return null;
  }

  const targetCategory = [...categories][0]!;
  const currentGroups = groupSkillsByCategory(currentSkills);
  const matchingGroup = currentGroups.find((g) => g.category === targetCategory);
  if (!matchingGroup) {
    return null;
  }

  const desiredNameSet = new Set(suggestedNames.map((n) => normalizeSkillsLabel(n)));
  const reorderedSkills = suggestedNames
    .map((name) => matchingGroup.skills.find((s) => normalizeSkillsLabel(s.name) === normalizeSkillsLabel(name)))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  if (reorderedSkills.length < 2) {
    return null;
  }

  const remainingSkills = matchingGroup.skills.filter((s) => !desiredNameSet.has(normalizeSkillsLabel(s.name)));
  const nextGroups = currentGroups.map((group) =>
    group.category === matchingGroup.category
      ? { ...group, skills: [...reorderedSkills, ...remainingSkills] }
      : group,
  );

  return {
    skills: resequenceSkillGroups(nextGroups),
    skillScope: { type: "group_contents" as const, category: matchingGroup.category },
  };
}

function hydrateSkillsSuggestion(
  suggestion: RevisionSuggestions["suggestions"][number],
  currentSkills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>,
) {
  if (!isSkillsSection(suggestion.section)) {
    return suggestion;
  }

  if (suggestion.skills && suggestion.skills.length > 0) {
    return suggestion;
  }

  const parsedGroupContents = parseSuggestedGroupContents(suggestion.suggestedText, currentSkills);
  if (parsedGroupContents) {
    return { ...suggestion, skills: parsedGroupContents.skills, skillScope: parsedGroupContents.skillScope };
  }

  const parsedGroupOrder = parseSuggestedGroupOrder(suggestion.suggestedText, currentSkills);
  if (parsedGroupOrder) {
    return { ...suggestion, skills: parsedGroupOrder.skills, skillScope: parsedGroupOrder.skillScope };
  }

  const parsedFlatList = parseSuggestedFlatSkillsList(suggestion.suggestedText, currentSkills);
  if (parsedFlatList) {
    return { ...suggestion, skills: parsedFlatList.skills, skillScope: parsedFlatList.skillScope };
  }

  return suggestion;
}

function buildSkillsReviewValue(
  currentSkills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>,
  suggestion: RevisionSuggestions["suggestions"][number],
): SkillsReviewValue | null {
  if (!suggestion.skills || suggestion.skills.length === 0) {
    return null;
  }

  const originalGroups = groupSkillsByCategory(currentSkills).map((group) => ({
    heading: group.category,
    items: group.skills.map((skill) => skill.name),
  }));
  const suggestedGroups = groupSkillsByCategory(suggestion.skills.map((skill) => ({
    name: skill.name,
    level: skill.level ?? null,
    category: skill.category,
    sortOrder: skill.sortOrder,
  }))).map((group) => ({
    heading: group.category,
    items: group.skills.map((skill) => skill.name),
  }));

  if (suggestion.skillScope?.type === "group_order") {
    return {
      suggestionId: suggestion.id,
      mode: "group_order",
      originalSections: originalGroups.map((group) => ({ heading: group.heading, items: [] })),
      suggestedSections: suggestedGroups.map((group) => ({ heading: group.heading, items: [] })),
    };
  }

  if (suggestion.skillScope?.type === "group_contents" && suggestion.skillScope.category) {
    const targetCategory = normalizeSkillsLabel(suggestion.skillScope.category);
    const originalSection = originalGroups.find(
      (group) => normalizeSkillsLabel(group.heading) === targetCategory,
    );
    const suggestedSection = suggestedGroups.find(
      (group) => normalizeSkillsLabel(group.heading) === targetCategory,
    );
    const displayCategory =
      originalSection?.heading ?? suggestedSection?.heading ?? suggestion.skillScope.category;

    return {
      suggestionId: suggestion.id,
      mode: "group_contents",
      targetCategory: displayCategory,
      originalSections: originalSection ? [originalSection] : [],
      suggestedSections: suggestedSection ? [suggestedSection] : [],
    };
  }

  const suggestedGroupLabels = new Set(suggestedGroups.map((g) => normalizeSkillsLabel(g.heading)));
  const scopedOriginalGroups = originalGroups.filter((g) => suggestedGroupLabels.has(normalizeSkillsLabel(g.heading)));

  return {
    suggestionId: suggestion.id,
    mode: "group_contents",
    originalSections: scopedOriginalGroups.length > 0 ? scopedOriginalGroups : originalGroups,
    suggestedSections: suggestedGroups,
  };
}

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
  const restoredBranchIdRef = useRef<string | null>(null);

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
  const { data: existingActionConversations } = useAIConversations(
    activeBranchId && activeBranchId !== mainBranchId ? "resume-revision-actions" : null,
    activeBranchId && activeBranchId !== mainBranchId ? activeBranchId : null,
  );
  const existingActionConversationId =
    existingActionConversations?.conversations.at(-1)?.id ?? null;
  const { data: existingActionConversation } = useAIConversation(existingActionConversationId);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    const hasPersistedSession =
      activeBranchId !== null &&
      activeBranchId !== mainBranchId &&
      readPersistedInlineRevisionSession(activeBranchId) !== null;

    if (!hasPersistedSession) {
      setIsOpen(false);
    }
  }, [activeBranchId, isEditing, mainBranchId]);

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

  const openActionAssistant = useCallback((branchId: string) => {
    if (
      assistantEntityType === "resume-revision-actions" &&
      assistantEntityId === branchId &&
      assistantToolContext?.route === actionToolContext.route
    ) {
      hideDrawer();
      return;
    }

    openAssistant({
      entityType: "resume-revision-actions",
      entityId: branchId,
      title: t("revision.inline.actionsConversationTitle"),
      systemPrompt: buildResumeRevisionActionPrompt(i18n.resolvedLanguage ?? i18n.language),
      originalContent: [resumeTitle, consultantTitle ?? "", presentation.join("\n\n"), summary ?? ""]
        .filter(Boolean)
        .join("\n\n"),
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
    assistantToolContext?.route,
    consultantTitle,
    hideDrawer,
    i18n.language,
    i18n.resolvedLanguage,
    openAssistant,
    presentation,
    resumeTitle,
    summary,
    t,
  ]);

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
    openActionAssistant(activeBranchId);
  }, [
    activeBranchId,
    openActionAssistant,
    pendingActionBranchId,
    plan,
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
    setIsEditing(true);
    setIsOpen(true);
    setStage(persistedSession.stage);
    setPlan(persistedSession.plan);
    setWorkItems(persistedSession.workItems);
    setSuggestions(persistedSession.suggestions);
    setSelectedSuggestionId(null);
    setReviewSuggestionId(null);
    setIsSuggestionReviewOpen(false);
    setSourceBranchId(persistedSession.sourceBranchId);
    setSourceBranchName(persistedSession.sourceBranchName);
    setPlanningSessionId(null);
    setPendingActionBranchId(null);
    setApplyingSuggestionId(null);
    setIsPreparingFinalize(false);
    if (persistedSession.stage === "actions") {
      openActionAssistant(activeBranchId);
    } else {
      hideDrawer();
    }
  }, [activeBranchId, hideDrawer, isOpen, mainBranchId, openActionAssistant, setIsEditing]);

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

  const getSuggestionOriginalText = (suggestion: RevisionSuggestions["suggestions"][number]) => {
    const hydratedSuggestion = hydrateSkillsSuggestion(suggestion, skills);
    const section = hydratedSuggestion.section.trim().toLowerCase();

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

    if (isSkillsSection(section)) {
      if (hydratedSuggestion.skillScope?.type === "group_contents" && hydratedSuggestion.skillScope.category) {
        const targetCategory = normalizeSkillCategory(hydratedSuggestion.skillScope.category);
        const targetGroup = groupSkillsByCategory(skills).find((group) => group.category === targetCategory);
        if (targetGroup) {
          return `${targetGroup.category}: ${targetGroup.skills.map((skill) => skill.name).join(", ")}`;
        }
      }

      return formatSkillsSnapshot(skills);
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

  const applySuggestionToSkills = async (suggestion: RevisionSuggestions["suggestions"][number]) => {
    const hydratedSuggestion = hydrateSkillsSuggestion(suggestion, skills);
    if (!activeBranchId || !hydratedSuggestion.skills || hydratedSuggestion.skills.length === 0) {
      return false;
    }

    const currentSkillGroups = groupSkillsByCategory(skills);
    const currentSkillsByName = new Map(
      skills.map((skill) => [skill.name.trim().toLowerCase(), skill]),
    );
    let nextSkills = hydratedSuggestion.skills.map((skill) => {
      const currentSkill = currentSkillsByName.get(skill.name.trim().toLowerCase());

      return {
        name: skill.name,
        level: skill.level ?? currentSkill?.level ?? null,
        category: skill.category,
        sortOrder: skill.sortOrder,
      };
    });

    if (hydratedSuggestion.skillScope?.type === "group_order") {
      const desiredCategoryOrder = hydratedSuggestion.skills.reduce<string[]>((acc, skill) => {
        const category = normalizeSkillCategory(skill.category);
        if (!acc.includes(category)) {
          acc.push(category);
        }
        return acc;
      }, []);
      const currentGroupsByCategory = new Map(
        currentSkillGroups.map((group) => [group.category, group]),
      );
      const reorderedGroups = desiredCategoryOrder
        .map((category) => currentGroupsByCategory.get(category))
        .filter((group): group is NonNullable<typeof group> => Boolean(group));
      const remainingGroups = currentSkillGroups.filter((group) => !desiredCategoryOrder.includes(group.category));

      nextSkills = resequenceSkillGroups([...reorderedGroups, ...remainingGroups]);
    } else if (
      hydratedSuggestion.skillScope?.type === "group_contents"
      && hydratedSuggestion.skillScope.category
    ) {
      const targetCategory = normalizeSkillCategory(hydratedSuggestion.skillScope.category);
      const desiredNames = hydratedSuggestion.skills
        .filter((skill) => normalizeSkillCategory(skill.category) === targetCategory)
        .map((skill) => skill.name.trim().toLowerCase());
      const desiredNameSet = new Set(desiredNames);

      nextSkills = resequenceSkillGroups(currentSkillGroups.map((group) => {
        if (group.category !== targetCategory) {
          return group;
        }

        const skillsByName = new Map(
          group.skills.map((skill) => [skill.name.trim().toLowerCase(), skill]),
        );
        const reorderedSkills = desiredNames
          .map((name) => skillsByName.get(name))
          .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
        const remainingSkills = group.skills.filter((skill) => !desiredNameSet.has(skill.name.trim().toLowerCase()));

        return {
          ...group,
          skills: [...reorderedSkills, ...remainingSkills],
        };
      }));
    }

    await saveVersion.mutateAsync({
      branchId: activeBranchId,
      message: buildInlineRevisionSuggestionCommitMessage(hydratedSuggestion),
      skills: nextSkills,
    });

    return true;
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
      } else if (isSkillsSection(suggestion.section) && activeBranchId) {
        setApplyingSuggestionId(suggestionId);
        try {
          await applySuggestionToSkills(suggestion);
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
    draftState.summaryRef.current !== (summary ?? "") ||
    draftState.highlightedItemsRef.current !== highlightedItems.join("\n");

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

  const reviewSuggestion = reviewSuggestionId
    ? suggestions?.suggestions.find((item) => item.id === reviewSuggestionId) ?? null
    : null;
  const reviewDialog = reviewSuggestion
    ? (() => {
        const isSkillsSuggestion = isSkillsSection(reviewSuggestion.section);
        if (isSkillsSuggestion) {
          const value = buildSkillsReviewValue(skills, hydrateSkillsSuggestion(reviewSuggestion, skills));
          if (value) {
            return {
              kind: "skills" as const,
              isOpen: isSuggestionReviewOpen,
              value,
              renderReview: renderSkillsReview,
              formatResult: (nextValue: SkillsReviewValue) => nextValue.suggestionId,
              onApply: async (suggestionId: string) => {
                await approveSuggestion(suggestionId);
                closeSuggestionReview();
              },
              onKeepEditing: closeSuggestionReview,
              onDiscard: () => {
                dismissSuggestion(reviewSuggestion.id);
                closeSuggestionReview();
              },
            };
          }
        }

        const value: TextDiffReviewValue = {
          original: getSuggestionOriginalText(reviewSuggestion),
          suggested: reviewSuggestion.suggestedText ?? "",
        };

        return {
          kind: "text" as const,
          isOpen: isSuggestionReviewOpen,
          value,
          renderReview: renderTextDiffReview,
          formatResult: (nextValue: TextDiffReviewValue) => nextValue.suggested,
          onApply: async () => {
            await approveSuggestion(reviewSuggestion.id);
            closeSuggestionReview();
          },
          onKeepEditing: closeSuggestionReview,
          onDiscard: () => {
            dismissSuggestion(reviewSuggestion.id);
            closeSuggestionReview();
          },
        };
      })()
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
    selectSuggestion: scrollSuggestionIntoView,
    openSuggestionReview,
    keepBranch: () => finish("keep"),
    mergeBranch: () => finish("merge"),
  };
}
