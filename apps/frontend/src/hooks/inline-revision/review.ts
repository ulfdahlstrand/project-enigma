import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  renderTextDiffReview,
  type TextDiffReviewValue,
} from "../../components/ai-assistant/DiffReviewDialog";
import {
  buildInlineRevisionSuggestionCommitMessage,
} from "../../components/revision/inline-revision";
import {
  renderSkillsReview,
  type SkillsReviewValue,
} from "../../components/revision/SkillsReviewContent";
import type { RevisionSuggestions } from "../../lib/ai-tools/registries/resume-tool-schemas";
import {
  applySuggestionTextToDraft,
  applySuggestionToAssignment,
  applySuggestionToSkills,
  getSuggestionOriginalText,
} from "./apply";
import {
  buildSkillsReviewValue,
  hydrateSkillsSuggestion,
  isSkillsSection,
} from "./skills";
import type {
  DraftState,
  ResumeAssignmentLike,
  RevisionSectionRefs,
} from "./types";

type Suggestion = RevisionSuggestions["suggestions"][number];
type ReviewDialog =
  | {
      kind: "skills";
      isOpen: boolean;
      value: SkillsReviewValue;
      renderReview: typeof renderSkillsReview;
      formatResult: (nextValue: SkillsReviewValue) => string;
      onApply: (suggestionId: string) => Promise<void>;
      onKeepEditing: () => void;
      onDiscard: () => void;
    }
  | {
      kind: "text";
      isOpen: boolean;
      value: TextDiffReviewValue;
      renderReview: typeof renderTextDiffReview;
      formatResult: (nextValue: TextDiffReviewValue) => string;
      onApply: () => Promise<void>;
      onKeepEditing: () => void;
      onDiscard: () => void;
    };

type ResumeSkill = {
  name: string;
  level: string | null;
  category: string | null;
  sortOrder: number;
};

type Params = {
  activeBranchId: string | null;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedItems: string[];
  skills: ResumeSkill[];
  sortedAssignments: ResumeAssignmentLike[];
  sectionRefs: RevisionSectionRefs;
  draftState: DraftState;
  queryClient: QueryClient;
  suggestions: RevisionSuggestions | null;
  setSuggestions: Dispatch<SetStateAction<RevisionSuggestions | null>>;
  saveVersion: (input: {
    branchId: string;
    message?: string;
    consultantTitle?: string | null;
    presentation?: string[];
    summary?: string | null;
    highlightedItems?: string[];
    skills?: ResumeSkill[];
  }) => Promise<unknown>;
  updateBranchAssignment: (input: { id: string; description: string }) => Promise<unknown>;
  buildDraftPatchFromValues: (title: string, presentation: string, summary: string) => unknown;
};

export function useInlineRevisionReview({
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
  saveVersion,
  updateBranchAssignment,
  buildDraftPatchFromValues,
}: Params) {
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [reviewSuggestionId, setReviewSuggestionId] = useState<string | null>(null);
  const [isSuggestionReviewOpen, setIsSuggestionReviewOpen] = useState(false);
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null);

  const approveSuggestion = async (suggestionId: string) => {
    const suggestion = suggestions?.suggestions.find((item) => item.id === suggestionId);
    if (suggestion) {
      const nextPatch = applySuggestionTextToDraft(suggestion, draftState, buildDraftPatchFromValues);
      if (nextPatch && activeBranchId) {
        setApplyingSuggestionId(suggestionId);
        try {
          await saveVersion({
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
          await applySuggestionToAssignment(suggestion, {
            activeBranchId,
            sortedAssignments,
            queryClient,
            updateBranchAssignment,
            saveVersion: async (input) => saveVersion(input),
            buildCommitMessage: buildInlineRevisionSuggestionCommitMessage,
          });
        } finally {
          setApplyingSuggestionId(null);
        }
      } else if (isSkillsSection(suggestion.section) && activeBranchId) {
        setApplyingSuggestionId(suggestionId);
        try {
          await applySuggestionToSkills(suggestion, {
            activeBranchId,
            skills,
            saveVersion: async (input) => saveVersion(input),
            buildCommitMessage: buildInlineRevisionSuggestionCommitMessage,
          });
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

  const selectSuggestion = (suggestionId: string) => {
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
      section.includes("presentation")
      || section.includes("profil")
      || section.includes("summary")
      || section.includes("sammanfatt")
      || section.includes("title")
      || section.includes("titel")
    ) {
      target = sectionRefs.presentationRef.current ?? sectionRefs.coverSectionRef.current;
    } else {
      target = sectionRefs.coverSectionRef.current;
    }

    setSelectedSuggestionId(suggestionId);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const reviewSuggestion = reviewSuggestionId
    ? suggestions?.suggestions.find((item) => item.id === reviewSuggestionId) ?? null
    : null;
  const reviewDialog: ReviewDialog | null = reviewSuggestion
    ? (() => {
        const isSkillsSuggestion = isSkillsSection(reviewSuggestion.section);
        if (isSkillsSuggestion) {
          const value = buildSkillsReviewValue(skills, hydrateSkillsSuggestion(reviewSuggestion, skills));
          if (value) {
            return {
              kind: "skills",
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
          original: getSuggestionOriginalText(reviewSuggestion, {
            consultantTitle,
            presentation,
            summary,
            highlightedItems,
            skills,
            sortedAssignments,
          }),
          suggested: reviewSuggestion.suggestedText ?? "",
        };

        return {
          kind: "text",
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

  const hasUnsavedChanges =
    draftState.titleRef.current !== (consultantTitle ?? "")
    || draftState.presentationRef.current !== presentation.join("\n\n")
    || draftState.summaryRef.current !== (summary ?? "")
    || draftState.highlightedItemsRef.current !== highlightedItems.join("\n");

  return {
    selectedSuggestionId,
    applyingSuggestionId,
    reviewDialog,
    hasUnsavedChanges,
    openSuggestionReview,
    selectSuggestion,
  };
}
