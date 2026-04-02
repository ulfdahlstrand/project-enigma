import type { MutableRefObject, RefObject } from "react";
import type {
  RevisionSuggestions,
  RevisionWorkItems,
} from "../../lib/ai-tools/registries/resume-tool-schemas";

export type DraftPatch = {
  consultantTitle?: string | null;
  presentation?: string[];
  summary?: string | null;
  highlightedItems?: string[];
};

export type DraftState = {
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

export type ResumeAssignmentLike = {
  id: string;
  assignmentId?: string;
  clientName: string;
  role: string;
  description?: string;
};

export type RevisionSectionRefs = {
  coverSectionRef: RefObject<HTMLDivElement | null>;
  presentationRef: RefObject<HTMLDivElement | null>;
  skillsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentItemRefs: MutableRefObject<Record<string, HTMLElement | null>>;
};

export type ResumeInspectionSnapshot = {
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

export type PersistedInlineRevisionSession = {
  version: 2;
  sourceBranchId: string | null;
  sourceBranchName: string | null;
  suggestions: RevisionSuggestions | null;
};

export type PersistedToolCall = {
  type: "tool_call";
  toolName: string;
  input?: unknown;
};

export type UseInlineResumeRevisionParams = {
  resumeId: string;
  isEditRoute: boolean;
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
