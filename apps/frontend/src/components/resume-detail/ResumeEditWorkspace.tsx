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
  skills: Array<{ id: string; name: string; category: string | null; sortOrder?: number; level?: string | null }>;
  degrees: string[];
  certifications: string[];
  languages: string[];
  isSnapshotMode: boolean;
  getResumeQueryKey: (id: string) => readonly ["getResume", string];
  fabTop: number;
  onImprovePresentationAccept: (improved: string) => void;
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
}

export function ResumeEditWorkspace({
  inlineRevision,
  activeBranchId,
  activeBranchName,
  ...props
}: ResumeEditWorkspaceProps) {
  return (
    <Box
      sx={{
        bgcolor: "background.default",
        minHeight: inlineRevision.isOpen ? 0 : "calc(100vh - 56px)",
        height: inlineRevision.isOpen ? "auto" : undefined,
        flex: inlineRevision.isOpen ? 1 : undefined,
        py: inlineRevision.isOpen ? 0 : 4,
        px: inlineRevision.isOpen ? 0 : { xs: 2, md: 3 },
        display: "flex",
        flexDirection: "column",
        overflow: inlineRevision.isOpen ? "hidden" : undefined,
      }}
    >
      <Box
        sx={{
          width: "100%",
          flex: inlineRevision.isOpen ? 1 : "0 0 auto",
          minHeight: inlineRevision.isOpen ? 0 : undefined,
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: "stretch",
          justifyContent: "center",
          gap: inlineRevision.isOpen ? 0 : 3,
          overflow: inlineRevision.isOpen ? "hidden" : "visible",
        }}
      >
        <Slide
          in={inlineRevision.isOpen}
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
              plan={inlineRevision.plan}
              workItems={inlineRevision.workItems}
              suggestions={inlineRevision.suggestions}
              selectedSuggestionId={inlineRevision.selectedSuggestionId}
              onSelectSuggestion={inlineRevision.selectSuggestion}
              onReviewSuggestion={inlineRevision.openSuggestionReview}
              onMoveToActions={() => void inlineRevision.openActions()}
              isMovingToActions={inlineRevision.isMovingToActions}
              onMoveToFinalize={() => void inlineRevision.prepareFinalize()}
              isReadyToFinalize={inlineRevision.isReadyToFinalize}
              isPreparingFinalize={inlineRevision.isPreparingFinalize}
              onBackToActions={inlineRevision.backToActions}
            />
          </Box>
        </Slide>

        <Box
          sx={{
            flex: "1 1 auto",
            order: { xs: 2, lg: 1 },
            minWidth: 0,
            minHeight: inlineRevision.isOpen ? 0 : undefined,
            overflow: inlineRevision.isOpen ? "auto" : "hidden",
            px: inlineRevision.isOpen ? { xs: 2, md: 3 } : 0,
            py: inlineRevision.isOpen ? 4 : 0,
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
              activeBranchId={activeBranchId}
              isEditing={true}
              showImprovePresentationFab={!inlineRevision.isOpen && !props.isSnapshotMode}
              showAssignmentsToggleFab={!inlineRevision.isOpen}
            />
          )}
        </Box>

        <Slide
          in={inlineRevision.isOpen && inlineRevision.stage !== "finalize"}
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
              stage={inlineRevision.stage}
              toolRegistry={
                inlineRevision.stage === "actions"
                  ? inlineRevision.actionToolRegistry
                  : inlineRevision.planningToolRegistry
              }
              toolContext={
                inlineRevision.stage === "actions"
                  ? inlineRevision.actionToolContext
                  : inlineRevision.planningToolContext
              }
              autoStartMessage={null}
              automation={inlineRevision.automation}
              guardrail={inlineRevision.guardrail}
            />
          </Box>
        </Slide>
      </Box>
    </Box>
  );
}
