import Box from "@mui/material/Box";
import Slide from "@mui/material/Slide";
import type { MutableRefObject, RefObject } from "react";
import { FinalReview } from "../revision/FinalReview";
import { InlineRevisionChatPanel } from "../revision/InlineRevisionChatPanel";
import { InlineRevisionChecklist } from "../revision/InlineRevisionChecklist";
import { ResumeDocumentCanvas } from "./ResumeDocumentCanvas";

type Assignment = {
  id: string;
  assignmentId?: string;
  clientName: string;
  role: string;
  startDate: string | Date | null;
  endDate?: string | Date | null;
  isCurrent: boolean;
  description?: string | null;
  technologies?: string[] | null;
  keywords?: string | null;
};

interface ResumeEditWorkspaceProps {
  inlineRevision: any;
  activeBranchId: string | null;
  activeBranchName: string;
  resumeId: string;
  resumeTitle: string;
  language: string | null;
  totalPages: number;
  employeeName: string;
  profileImageDataUrl: string | null;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedItems: string[];
  draftTitle: string;
  draftPresentation: string;
  draftSummary: string;
  draftHighlightedItems: string;
  onDraftTitleChange: (value: string) => void;
  onDraftPresentationChange: (value: string) => void;
  onDraftSummaryChange: (value: string) => void;
  onDraftHighlightedItemsChange: (value: string) => void;
  showSkillsPage: boolean;
  skillsPage: number | null;
  skillGroups: Array<{ id: string; resumeId: string; name: string; sortOrder: number }>;
  skills: Array<{ id: string; groupId: string; name: string; category: string | null; sortOrder?: number }>;
  degrees: string[];
  certifications: string[];
  languages: string[];
  isSnapshotMode: boolean;
  getResumeQueryKey: (id: string, branchId?: string | null) => readonly ["getResume", string, string | null];
  fabTop: number;
  hasAssignments: boolean;
  assignmentsPage: number | null;
  assignments: Assignment[];
  showFullAssignments: boolean;
  onToggleShowFullAssignments: () => void;
  canvasRef: RefObject<HTMLDivElement | null>;
  newAssignmentId: string | null;
  onAutoEditConsumed: () => void;
  onCreateAssignment: () => void;
  createAssignmentPending: boolean;
  canCreateAssignment: boolean;
  assignmentsFabTop: number;
  presentationRef: RefObject<HTMLDivElement | null>;
  coverSectionRef: RefObject<HTMLDivElement | null>;
  skillsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentItemRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  zoom: number;
  showSuggestionsPanel: boolean;
  showChatPanel: boolean;
}

export function ResumeEditWorkspace({
  inlineRevision,
  activeBranchId,
  activeBranchName,
  zoom,
  showSuggestionsPanel,
  showChatPanel,
  ...props
}: ResumeEditWorkspaceProps) {
  const showRevisionShell = inlineRevision.isOpen;

  return (
    <Box
      sx={{
        bgcolor: "background.default",
        minHeight: showRevisionShell ? 0 : "calc(100vh - 56px)",
        height: showRevisionShell ? "auto" : undefined,
        flex: showRevisionShell ? 1 : undefined,
        py: showRevisionShell ? 0 : 4,
        px: showRevisionShell ? 0 : { xs: 2, md: 3 },
        display: "flex",
        flexDirection: "column",
        overflow: showRevisionShell ? "hidden" : undefined,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "hidden",
      }}
    >
      <Box
        sx={{
          width: "100%",
          flex: showRevisionShell ? 1 : "0 0 auto",
          minHeight: showRevisionShell ? 0 : undefined,
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: "stretch",
          justifyContent: "center",
          gap: showRevisionShell ? 0 : 3,
          overflow: showRevisionShell ? "hidden" : "visible",
          maxWidth: "100%",
          minWidth: 0,
        }}
      >
        <Slide
          in={showRevisionShell && showSuggestionsPanel}
          direction="right"
          mountOnEnter
          unmountOnExit
          timeout={{ enter: 220, exit: 180 }}
        >
          <Box
            sx={{
              width: { xs: "100%", lg: inlineRevision.checklistWidth },
              order: { xs: 0, lg: 0 },
              flexShrink: 0,
              overflow: "auto",
              borderRight: { xs: "none", lg: "1px solid" },
              borderBottom: { xs: "1px solid", lg: "none" },
              borderColor: "divider",
              bgcolor: "background.paper",
              maxHeight: { xs: 320, lg: "none" },
            }}
          >
            <InlineRevisionChecklist
              stage={inlineRevision.stage}
              sourceBranchName={inlineRevision.sourceBranchName}
              branchName={activeBranchName}
              suggestions={inlineRevision.suggestions}
              selectedSuggestionId={inlineRevision.selectedSuggestionId}
              onSelectSuggestion={inlineRevision.selectSuggestion}
              onReviewSuggestion={inlineRevision.openSuggestionReview}
              onDismissSuggestion={inlineRevision.dismissSuggestion}
              onMoveToFinalize={() => void inlineRevision.prepareFinalize()}
              isReadyToFinalize={inlineRevision.isReadyToFinalize}
              isPreparingFinalize={inlineRevision.isPreparingFinalize}
              onBackToRevision={inlineRevision.backToRevision}
            />
          </Box>
        </Slide>

        <Box
          sx={{
            flex: "1 1 0",
            width: 0,
            order: { xs: 2, lg: 1 },
            minWidth: 0,
            maxWidth: "100%",
            minHeight: showRevisionShell ? 0 : undefined,
            overflowY: showRevisionShell ? "auto" : "visible",
            overflowX: "hidden",
            px: showRevisionShell ? { xs: 2, md: 3 } : 0,
            py: showRevisionShell ? 4 : 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {inlineRevision.stage === "finalize" ? (
            <FinalReview
              workflowId={activeBranchId ?? "inline-revision"}
              onMerge={inlineRevision.mergeBranch}
              onKeep={inlineRevision.keepBranch}
              isMerging={inlineRevision.isMerging}
              isKeeping={inlineRevision.isKeeping}
            />
          ) : (
            <ResumeDocumentCanvas
              {...props}
              zoom={zoom}
              activeBranchId={activeBranchId}
              isEditing={true}
              showAssignmentsToggleFab={!showRevisionShell}
            />
          )}
        </Box>

        <Slide
          in={showRevisionShell && showChatPanel && inlineRevision.stage !== "finalize"}
          direction="left"
          mountOnEnter
          unmountOnExit
          timeout={{ enter: 220, exit: 180 }}
        >
          <Box
            sx={{
              width: { xs: "100%", lg: inlineRevision.chatWidth },
              order: { xs: 1, lg: 2 },
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderLeft: { xs: "none", lg: "1px solid" },
              borderBottom: { xs: "1px solid", lg: "none" },
              borderColor: "divider",
              bgcolor: "background.paper",
              minHeight: 0,
              maxHeight: { xs: 320, lg: "none" },
            }}
          >
            <InlineRevisionChatPanel
              toolRegistry={inlineRevision.toolRegistry}
              toolContext={inlineRevision.toolContext}
            />
          </Box>
        </Slide>
      </Box>
    </Box>
  );
}
