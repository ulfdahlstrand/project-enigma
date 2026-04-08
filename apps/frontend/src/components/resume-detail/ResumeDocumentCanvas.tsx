import Box from "@mui/material/Box";
import { ResumeAssignmentsPage } from "./ResumeAssignmentsPage";
import { ResumeCoverPage } from "./ResumeCoverPage";
import { ResumeSkillsPage } from "./ResumeSkillsPage";
import type { SkillGroupRow, SkillRow } from "../SkillsEditor";
import type { AssignmentRow as EditorAssignmentRow } from "../AssignmentEditor";
import type { MutableRefObject, RefObject } from "react";

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

interface ResumeDocumentCanvasProps {
  zoom: number;
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
  isEditing: boolean;
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
  skillGroups: SkillGroupRow[];
  skills: Array<{ id: string; groupId: string; name: string; category: string | null; sortOrder?: number }>;
  degrees: string[];
  certifications: string[];
  languages: string[];
  isSnapshotMode: boolean;
  getResumeQueryKey: (id: string, branchId?: string | null) => readonly ["getResume", string, string | null];
  hasAssignments: boolean;
  assignmentsPage: number | null;
  assignments: Assignment[];
  showFullAssignments: boolean;
  onToggleShowFullAssignments: () => void;
  showAssignmentsToggleFab: boolean;
  canvasRef: RefObject<HTMLDivElement | null>;
  newAssignmentId: string | null;
  onAutoEditConsumed: () => void;
  onCreateAssignment: () => void;
  createAssignmentPending: boolean;
  canCreateAssignment: boolean;
  presentationRef: RefObject<HTMLDivElement | null>;
  coverSectionRef: RefObject<HTMLDivElement | null>;
  skillsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentItemRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  activeBranchId: string | null;
}

export function ResumeDocumentCanvas({
  zoom,
  resumeId,
  resumeTitle,
  language,
  totalPages,
  employeeName,
  profileImageDataUrl,
  consultantTitle,
  presentation,
  summary,
  highlightedItems,
  isEditing,
  draftTitle,
  draftPresentation,
  draftSummary,
  draftHighlightedItems,
  onDraftTitleChange,
  onDraftPresentationChange,
  onDraftSummaryChange,
  onDraftHighlightedItemsChange,
  showSkillsPage,
  skillsPage,
  skillGroups,
  skills,
  degrees,
  certifications,
  languages,
  isSnapshotMode,
  getResumeQueryKey,
  hasAssignments,
  assignmentsPage,
  assignments,
  showFullAssignments,
  onToggleShowFullAssignments,
  showAssignmentsToggleFab,
  canvasRef,
  newAssignmentId,
  onAutoEditConsumed,
  onCreateAssignment,
  createAssignmentPending,
  canCreateAssignment,
  presentationRef,
  coverSectionRef,
  skillsSectionRef,
  assignmentsSectionRef,
  assignmentItemRefs,
  activeBranchId,
}: ResumeDocumentCanvasProps) {
  return (
    <Box
      ref={canvasRef}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        zoom,
        transformOrigin: "top center",
      }}
    >
      <ResumeCoverPage
        title={resumeTitle}
        language={language}
        page={1}
        totalPages={totalPages}
        employeeName={employeeName}
        profileImageDataUrl={profileImageDataUrl}
        consultantTitle={consultantTitle}
        presentation={presentation}
        summary={summary}
        highlightedItems={highlightedItems}
        presentationRef={presentationRef}
        isEditing={isEditing}
        draftTitle={draftTitle}
        draftPresentation={draftPresentation}
        draftSummary={draftSummary}
        draftHighlightedItems={draftHighlightedItems}
        onDraftTitleChange={onDraftTitleChange}
        onDraftPresentationChange={onDraftPresentationChange}
        onDraftSummaryChange={onDraftSummaryChange}
        onDraftHighlightedItemsChange={onDraftHighlightedItemsChange}
        sectionRef={coverSectionRef}
      />

      {showSkillsPage && skillsPage !== null && (
        <ResumeSkillsPage
          title={resumeTitle}
          language={language}
          page={skillsPage}
          totalPages={totalPages}
          employeeName={employeeName}
          skillGroups={skillGroups}
          skills={skills as SkillRow[]}
          degrees={degrees}
          certifications={certifications}
          languages={languages}
          isEditing={isEditing}
          isSnapshotMode={isSnapshotMode}
          resumeId={resumeId}
          queryKey={getResumeQueryKey(resumeId, activeBranchId)}
          sectionRef={skillsSectionRef}
        />
      )}

      {hasAssignments && assignmentsPage !== null && (
        <ResumeAssignmentsPage
          title={resumeTitle}
          language={language}
          page={assignmentsPage}
          totalPages={totalPages}
          assignments={assignments as EditorAssignmentRow[]}
          showFullAssignments={showFullAssignments}
          onToggleShowFullAssignments={onToggleShowFullAssignments}
          isEditing={isEditing}
          isSnapshotMode={isSnapshotMode}
          canCreateAssignment={canCreateAssignment}
          canvasEl={canvasRef.current}
          newAssignmentId={newAssignmentId}
          onAutoEditConsumed={onAutoEditConsumed}
          onCreateAssignment={onCreateAssignment}
          createAssignmentPending={createAssignmentPending}
          showToggleFab={showAssignmentsToggleFab}
          sectionRef={assignmentsSectionRef}
          assignmentItemRefs={assignmentItemRefs}
          activeBranchId={activeBranchId}
        />
      )}
    </Box>
  );
}
