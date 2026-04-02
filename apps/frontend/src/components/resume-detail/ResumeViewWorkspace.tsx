import Box from "@mui/material/Box";
import type { MutableRefObject, RefObject } from "react";
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

interface ResumeViewWorkspaceProps {
  resumeId: string;
  resumeTitle: string;
  language: string | null;
  totalPages: number;
  employeeName: string;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedItems: string[];
  showSkillsPage: boolean;
  skillsPage: number | null;
  skills: Array<{ id: string; name: string; category: string | null; sortOrder?: number; level?: string | null }>;
  degrees: string[];
  certifications: string[];
  languages: string[];
  isSnapshotMode: boolean;
  getResumeQueryKey: (id: string) => readonly ["getResume", string];
  skillsFabTop: number;
  hasAssignments: boolean;
  assignmentsPage: number | null;
  assignments: Assignment[];
  showFullAssignments: boolean;
  onToggleShowFullAssignments: () => void;
  canvasRef: RefObject<HTMLDivElement | null>;
  presentationRef: RefObject<HTMLDivElement | null>;
  coverSectionRef: RefObject<HTMLDivElement | null>;
  skillsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentItemRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  activeBranchId: string | null;
}

export function ResumeViewWorkspace(props: ResumeViewWorkspaceProps) {
  return (
    <Box
      sx={{
        bgcolor: "background.default",
        minHeight: "calc(100vh - 56px)",
        py: 4,
        px: { xs: 2, md: 3 },
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Box sx={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>
          <ResumeDocumentCanvas
            {...props}
            isEditing={false}
            draftTitle=""
            draftPresentation=""
            draftSummary=""
            draftHighlightedItems=""
            onDraftTitleChange={() => {}}
            onDraftPresentationChange={() => {}}
            onDraftSummaryChange={() => {}}
            onDraftHighlightedItemsChange={() => {}}
            skillsFabTop={props.skillsFabTop}
            showImprovePresentationFab={false}
            fabTop={0}
            onImprovePresentationAccept={() => {}}
            showAssignmentsToggleFab={true}
            newAssignmentId={null}
            onAutoEditConsumed={() => {}}
            onCreateAssignment={() => {}}
            createAssignmentPending={false}
            canCreateAssignment={false}
            assignmentsFabTop={0}
          />
        </Box>
      </Box>
    </Box>
  );
}
