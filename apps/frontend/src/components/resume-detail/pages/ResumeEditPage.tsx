/**
 * ResumeEditPage — editable render of a resume detail.
 *
 * Same shape as ResumePreviewPage but invokes useResumeDetailPage with
 * isEditRoute=true and renders the editable workspace.
 */
import { ErrorState, LoadingState } from "../../feedback";
import { ResumeDetailActions } from "../ResumeDetailActions";
import { ResumeEditWorkspace } from "../ResumeEditWorkspace";
import { ResumeDetailShell } from "./ResumeDetailShell";
import { getResumeQueryKey, useResumeDetailPage } from "./useResumeDetailPage";

interface ResumeEditPageProps {
  id: string;
  forcedBranchId: string | null;
  forcedCommitId: string | null;
}

export function ResumeEditPage({
  id,
  forcedBranchId,
  forcedCommitId,
}: ResumeEditPageProps) {
  const bundle = useResumeDetailPage({
    id,
    isEditRoute: true,
    forcedBranchId,
    forcedCommitId,
  });

  const {
    t,
    isLoading,
    isError,
    error,
    isSnapshotMode,
    isSelectedCommitError,
    resumeTitle,
    activeBranchId,
    activeBranchName,
    activeBranch,
    compareBaseRef,
    currentViewedCommitId,
    isEditRoute,
    isEditing,
    updateResumeIsPending,
    saveVersionIsPending,
    forkBranchIsPending,
    handleSave,
    handleCreateBranchFromCommit,
    handleExitEditing,
    onEdit,
    onDeleteResume,
    deleteResumeIsPending,
    deleteResumeIsError,
    employee,
    language,
    totalPages,
    consultantTitle,
    presentation,
    summary,
    highlightedItems,
    showSkillsPage,
    skillsPage,
    skillGroups,
    skills,
    resolvedEducation,
    hasAssignments,
    assignmentsPage,
    editableAssignments,
    showFullAssignments,
    onToggleShowFullAssignments,
    canvasRef,
    presentationRef,
    coverSectionRef,
    skillsSectionRef,
    assignmentsSectionRef,
    assignmentItemRefs,
    zoom,
    inlineRevision,
    showSuggestionsPanel,
    showChatPanel,
    draftTitle,
    draftPresentation,
    draftSummary,
    draftHighlightedItems,
    setDraftTitle,
    setDraftPresentation,
    setDraftSummary,
    setDraftHighlightedItems,
    newAssignmentId,
    onAutoEditConsumed,
    onCreateAssignment,
    createAssignmentIsPending,
    canCreateAssignment,
  } = bundle;

  if (isLoading) return <LoadingState label={t("resume.detail.loading")} />;

  if (isError) {
    const isNotFound =
      error != null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "NOT_FOUND";

    return (
      <ErrorState
        message={isNotFound ? t("resume.detail.notFound") : t("resume.detail.error")}
      />
    );
  }

  if (isSnapshotMode && isSelectedCommitError) {
    return <ErrorState message={t("resume.detail.error")} />;
  }

  const toolbarActions = (
    <ResumeDetailActions
      resumeId={id}
      resumeTitle={resumeTitle}
      resumeLanguage={language ?? null}
      activeBranchId={activeBranchId}
      activeBranchName={activeBranch?.name ?? null}
      compareBaseRef={compareBaseRef}
      currentCommitId={currentViewedCommitId}
      isEditRoute={isEditRoute}
      isSnapshotMode={isSnapshotMode}
      isEditing={isEditing}
      isSaving={updateResumeIsPending || saveVersionIsPending || forkBranchIsPending}
      onSaveCurrent={() => void handleSave()}
      onCreateBranchFromCommit={handleCreateBranchFromCommit}
      onEdit={onEdit}
      onExitEdit={handleExitEditing}
      onDeleteResume={onDeleteResume}
      isDeletePending={deleteResumeIsPending}
      isDeleteError={deleteResumeIsError}
    />
  );

  return (
    <ResumeDetailShell bundle={bundle} toolbarActions={toolbarActions}>
      <ResumeEditWorkspace
        inlineRevision={inlineRevision}
        activeBranchId={activeBranchId}
        activeBranchName={activeBranchName}
        resumeId={id}
        resumeTitle={resumeTitle}
        language={language ?? null}
        totalPages={totalPages}
        employeeName={employee?.name ?? ""}
        profileImageDataUrl={employee?.profileImageDataUrl ?? null}
        consultantTitle={consultantTitle}
        presentation={presentation}
        summary={summary}
        highlightedItems={highlightedItems}
        draftTitle={draftTitle}
        draftPresentation={draftPresentation}
        draftSummary={draftSummary}
        draftHighlightedItems={draftHighlightedItems}
        onDraftTitleChange={setDraftTitle}
        onDraftPresentationChange={setDraftPresentation}
        onDraftSummaryChange={setDraftSummary}
        onDraftHighlightedItemsChange={setDraftHighlightedItems}
        showSkillsPage={showSkillsPage}
        skillsPage={skillsPage}
        skillGroups={skillGroups}
        skills={skills}
        degrees={resolvedEducation.filter((e) => e.type === "degree").map((e) => e.value)}
        certifications={resolvedEducation
          .filter((e) => e.type === "certification")
          .map((e) => e.value)}
        languages={resolvedEducation.filter((e) => e.type === "language").map((e) => e.value)}
        isSnapshotMode={isSnapshotMode}
        getResumeQueryKey={getResumeQueryKey}
        hasAssignments={hasAssignments}
        assignmentsPage={assignmentsPage}
        assignments={editableAssignments}
        showFullAssignments={showFullAssignments}
        onToggleShowFullAssignments={onToggleShowFullAssignments}
        canvasRef={canvasRef}
        newAssignmentId={newAssignmentId}
        onAutoEditConsumed={onAutoEditConsumed}
        onCreateAssignment={onCreateAssignment}
        createAssignmentPending={createAssignmentIsPending}
        canCreateAssignment={canCreateAssignment}
        presentationRef={presentationRef}
        coverSectionRef={coverSectionRef}
        skillsSectionRef={skillsSectionRef}
        assignmentsSectionRef={assignmentsSectionRef}
        assignmentItemRefs={assignmentItemRefs}
        zoom={zoom}
        showSuggestionsPanel={showSuggestionsPanel}
        showChatPanel={showChatPanel}
      />
    </ResumeDetailShell>
  );
}
