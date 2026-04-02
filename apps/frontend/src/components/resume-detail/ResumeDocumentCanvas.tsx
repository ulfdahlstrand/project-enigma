import Box from "@mui/material/Box";
import { ImprovePresentationFab } from "../ai-assistant/ImprovePresentationFab";
import { ResumeAssignmentsPage } from "./ResumeAssignmentsPage";
import { ResumeCoverPage } from "./ResumeCoverPage";
import { ResumeSkillsPage } from "./ResumeSkillsPage";
import type { SkillRow } from "../SkillsEditor";
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
  resumeId: string;
  resumeTitle: string;
  language: string | null;
  totalPages: number;
  employeeName: string;
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
  skills: Array<{ id: string; name: string; category: string | null; sortOrder?: number; level?: string | null }>;
  degrees: string[];
  certifications: string[];
  languages: string[];
  isSnapshotMode: boolean;
  getResumeQueryKey: (id: string) => readonly ["getResume", string];
  showImprovePresentationFab: boolean;
  fabTop: number;
  onImprovePresentationAccept: (improved: string) => void;
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
  assignmentsFabTop: number;
  presentationRef: RefObject<HTMLDivElement | null>;
  coverSectionRef: RefObject<HTMLDivElement | null>;
  skillsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentsSectionRef: RefObject<HTMLDivElement | null>;
  assignmentItemRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  activeBranchId: string | null;
}

export function ResumeDocumentCanvas({
  resumeId,
  resumeTitle,
  language,
  totalPages,
  employeeName,
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
  skills,
  degrees,
  certifications,
  languages,
  isSnapshotMode,
  getResumeQueryKey,
  showImprovePresentationFab,
  fabTop,
  onImprovePresentationAccept,
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
  assignmentsFabTop,
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
      }}
    >
      <ResumeCoverPage
        title={resumeTitle}
        language={language}
        page={1}
        totalPages={totalPages}
        employeeName={employeeName}
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
          skills={skills as SkillRow[]}
          degrees={degrees}
          certifications={certifications}
          languages={languages}
          isEditing={isEditing}
          isSnapshotMode={isSnapshotMode}
          resumeId={resumeId}
          queryKey={getResumeQueryKey(resumeId)}
          sectionRef={skillsSectionRef}
        />
      )}

      {showImprovePresentationFab && presentation.length > 0 && (
        <ImprovePresentationFab
          resumeId={resumeId}
          presentation={presentation}
          consultantTitle={consultantTitle}
          employeeName={employeeName}
          top={fabTop}
          onAccept={onImprovePresentationAccept}
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
          assignmentsFabTop={assignmentsFabTop}
          showToggleFab={showAssignmentsToggleFab}
          sectionRef={assignmentsSectionRef}
          assignmentItemRefs={assignmentItemRefs}
          activeBranchId={activeBranchId}
        />
      )}
    </Box>
  );
}
