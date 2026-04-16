/**
 * ResumePreviewPage — read-only render of a resume detail.
 *
 * Pulls all derived state from useResumeDetailPage and renders the read-only
 * workspace inside the shared shell.
 */
import { ErrorState, LoadingState } from "../../feedback";
import { ResumeDetailActions } from "../ResumeDetailActions";
import { ResumeViewWorkspace } from "../ResumeViewWorkspace";
import { ResumeDetailShell } from "./ResumeDetailShell";
import { getResumeQueryKey, useResumeDetailPage } from "./useResumeDetailPage";

interface ResumePreviewPageProps {
  id: string;
  forcedBranchId: string | null;
  forcedCommitId: string | null;
}

export function ResumePreviewPage({
  id,
  forcedBranchId,
  forcedCommitId,
}: ResumePreviewPageProps) {
  const bundle = useResumeDetailPage({
    id,
    isEditRoute: false,
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
    activeBranch,
    compareBaseRef,
    currentViewedCommitId,
    isEditRoute,
    isEditing,
    baseCommitId,
    updateResumeIsPending,
    saveVersionIsPending,
    forkBranchIsPending,
    handleSave,
    handleSaveAsNewVersion,
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
      activeBranchId={activeBranchId}
      activeBranchName={activeBranch?.name ?? null}
      compareBaseRef={compareBaseRef}
      currentCommitId={currentViewedCommitId}
      isEditRoute={isEditRoute}
      isSnapshotMode={isSnapshotMode}
      isEditing={isEditing}
      baseCommitId={baseCommitId}
      isSaving={updateResumeIsPending || saveVersionIsPending || forkBranchIsPending}
      canSaveAsNewVersion={baseCommitId !== null}
      onSaveCurrent={() => void handleSave()}
      onSaveAsNewVersion={handleSaveAsNewVersion}
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
      <ResumeViewWorkspace
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
        presentationRef={presentationRef}
        coverSectionRef={coverSectionRef}
        skillsSectionRef={skillsSectionRef}
        assignmentsSectionRef={assignmentsSectionRef}
        assignmentItemRefs={assignmentItemRefs}
        activeBranchId={activeBranchId}
        zoom={zoom}
      />
    </ResumeDetailShell>
  );
}
