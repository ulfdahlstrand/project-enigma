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
  profileImageDataUrl: string | null;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedItems: string[];
  showSkillsPage: boolean;
  skillsPage: number | null;
  skillGroups: Array<{ id: string; resumeId: string; name: string; sortOrder: number }>;
  skills: Array<{ id: string; groupId: string; name: string; category: string | null; sortOrder?: number }>;
  degrees: string[];
  certifications: string[];
  languages: string[];
  isSnapshotMode: boolean;
  getResumeQueryKey: (
    id: string,
    branchId?: string | null,
    commitId?: string | null,
  ) => readonly ["getResume", string, string | null, string | null];
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
  zoom: number;
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
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
      }}
    >
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          maxWidth: "100%",
          minWidth: 0,
          overflowX: "hidden",
          overflowY: "visible",
        }}
      >
        <Box sx={{ flex: "1 1 0", width: 0, minWidth: 0, maxWidth: "100%", overflow: "visible" }}>
          <ResumeDocumentCanvas
            {...props}
            zoom={props.zoom}
            isEditing={false}
            draftTitle=""
            draftPresentation=""
            draftSummary=""
            draftHighlightedItems=""
            onDraftTitleChange={() => {}}
            onDraftPresentationChange={() => {}}
            onDraftSummaryChange={() => {}}
            onDraftHighlightedItemsChange={() => {}}
            showAssignmentsToggleFab={true}
            newAssignmentId={null}
            onAutoEditConsumed={() => {}}
            onCreateAssignment={() => {}}
            createAssignmentPending={false}
            canCreateAssignment={false}
          />
        </Box>
      </Box>
    </Box>
  );
}
