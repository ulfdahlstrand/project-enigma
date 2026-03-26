/**
 * /resumes/$id/revision — AI Revision Workflow page.
 *
 * Three-column layout:
 *   Left  (~220px): WorkflowChecklist — step list with status
 *   Center (flex):  DiffPanel — discovery summary or original/proposed content
 *   Right  (~360px): StepConversation — message thread + composer + approve/rework
 *
 * When workflow.status === "completed": FinalReview replaces the three-column layout.
 *
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import type { ResumeRevisionDiscoveryOutput, ResumeRevisionProposalContent } from "@cv-tool/contracts";
import { WorkflowChecklist } from "../../../../../components/revision/WorkflowChecklist";
import { StepConversation } from "../../../../../components/revision/StepConversation";
import { DiffPanel } from "../../../../../components/revision/DiffPanel";
import { FinalReview } from "../../../../../components/revision/FinalReview";
import {
  useRevisionWorkflows,
  useRevisionWorkflow,
  useCreateRevisionWorkflow,
  useSendRevisionMessage,
  useApproveRevisionStep,
  useRequestRevisionRework,
  useFinaliseRevision,
  useKickoffRevisionStep,
  useSkipRevisionStep,
} from "../../../../../hooks/revision";
import { useResumeBranches } from "../../../../../hooks/versioning";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { LoadingState, ErrorState } from "../../../../../components/feedback";

export const Route = createFileRoute("/_authenticated/resumes/$id_/revision/")({
  validateSearch: z.object({
    branchId: z.string().optional(),
  }),
  component: RevisionWorkflowPage,
});

function RevisionWorkflowPage() {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const { id: resumeId } = useParams({ strict: false }) as { id: string };
  const { branchId: searchBranchId } = useSearch({ strict: false }) as { branchId?: string };

  const { data: branches } = useResumeBranches(resumeId);
  const mainBranchId = branches?.find((b) => b.isMain)?.id ?? null;
  const baseBranchId = searchBranchId ?? mainBranchId ?? null;

  // List existing workflows for this resume
  const { data: workflowsList, isLoading: isLoadingList, isError: isListError } =
    useRevisionWorkflows(resumeId);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const selectedWorkflow = workflowsList?.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  const workflowsForBranch = (workflowsList ?? []).filter((workflow) => workflow.baseBranchId === baseBranchId);
  const activeWorkflowForBranch =
    workflowsForBranch.find((workflow) => workflow.status === "active") ?? null;
  const completedWorkflowForBranch =
    workflowsForBranch.find((workflow) => workflow.status === "completed") ?? null;
  const workflowId =
    selectedWorkflow?.id ??
    activeWorkflowForBranch?.id ??
    completedWorkflowForBranch?.id ??
    null;

  const { data: workflow, isLoading: isLoadingWorkflow, isError: isWorkflowError } =
    useRevisionWorkflow(workflowId);

  // Derive active step: first non-approved step, or first step
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const steps = workflow?.steps ?? [];
  const activeStep =
    steps.find((s) => s.id === selectedStepId) ??
    steps.find((s) => s.status !== "approved") ??
    steps[0] ??
    null;

  // Discovery output from the approved discovery step
  const discoveryStep = steps.find((s) => s.section === "discovery");
  const discoveryOutput: ResumeRevisionDiscoveryOutput | null =
    discoveryStep?.status === "approved"
      ? ((discoveryStep.messages
          .slice()
          .reverse()
          .find((m) => m.messageType === "proposal")
          ?.structuredContent as ResumeRevisionProposalContent | null)
          ?.proposedContent as ResumeRevisionDiscoveryOutput | null) ?? null
      : null;

  // Mutations
  const createWorkflow = useCreateRevisionWorkflow();
  const sendMessage = useSendRevisionMessage(workflowId);
  const approveStep = useApproveRevisionStep(workflowId);
  const requestRework = useRequestRevisionRework(workflowId);
  const finalise = useFinaliseRevision(resumeId);
  const kickoffStep = useKickoffRevisionStep(workflowId);
  const skipStep = useSkipRevisionStep(workflowId);

  // Auto-kickoff: fire once per pending step that has no messages yet
  const kickedOffStepsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeStep || activeStep.status !== "pending" || activeStep.messages.length > 0) return;
    if (kickedOffStepsRef.current.has(activeStep.id)) return;
    kickedOffStepsRef.current.add(activeStep.id);
    kickoffStep.mutate({ stepId: activeStep.id, locale: i18n.language });
  }, [activeStep, kickoffStep]);

  const isCompleted = workflow?.status === "completed";

  function handleCreateWorkflow() {
    if (!baseBranchId) return;
    createWorkflow.mutate(
      { resumeId, baseBranchId },
      {
        onSuccess: (data) => {
          setSelectedWorkflowId(data.id);
        },
      }
    );
  }

  function handleSend(content: string) {
    if (!activeStep) return;
    sendMessage.mutate({ stepId: activeStep.id, content, locale: i18n.language });
  }

  function handleApprove() {
    if (!activeStep) return;
    approveStep.mutate({ stepId: activeStep.id });
  }

  function handleRequestRework(feedback: string) {
    if (!activeStep) return;
    requestRework.mutate({ stepId: activeStep.id, feedback });
  }

  function handleSkip() {
    if (!activeStep) return;
    skipStep.mutate({ stepId: activeStep.id });
  }

  function handleStepClick(stepId: string) {
    setSelectedStepId(stepId);
  }

  function handleMerge() {
    if (!workflowId) return;
    finalise.mutate(
      { workflowId, action: "merge" },
      {
        onSuccess: () => {
          void navigate({ to: "/resumes/$id", params: { id: resumeId } });
        },
      }
    );
  }

  function handleKeep() {
    if (!workflowId) return;
    finalise.mutate(
      { workflowId, action: "keep" },
      {
        onSuccess: (data) => {
          void navigate({
            to: "/resumes/$id",
            params: { id: resumeId },
            search: { branchId: data.resultBranchId },
          });
        },
      }
    );
  }

  // ─── Loading / error states ────────────────────────────────────────────────

  if (isLoadingList || isLoadingWorkflow) return <LoadingState label={t("revision.loading")} />;
  if (isListError || isWorkflowError) return <ErrorState message={t("revision.error")} />;

  // ─── Start screen — no workflow yet ───────────────────────────────────────

  if (!workflowId || !workflow) {
    return (
      <>
        <PageHeader
          title={t("revision.pageTitle")}
          breadcrumbs={[
            { label: t("resume.pageTitle"), to: "/resumes" },
            { label: t("resume.detail.pageTitle"), to: `/resumes/${resumeId}` },
          ]}
          actions={
            <Button
              variant="contained"
              onClick={handleCreateWorkflow}
              disabled={createWorkflow.isPending || !baseBranchId}
            >
              {createWorkflow.isPending ? t("revision.starting") : t("revision.startButton")}
            </Button>
          }
        />
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "calc(100vh - 176px)",
            gap: 3,
            px: 4,
          }}
        >
          <Box sx={{ textAlign: "center", maxWidth: 480 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {t("revision.startTitle")}
            </Typography>
            <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
              {t("revision.startDescription")}
            </Typography>
            {createWorkflow.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {t("revision.createError")}
              </Alert>
            )}
          </Box>
        </Box>
      </>
    );
  }

  // ─── Completed → Final review ──────────────────────────────────────────────

  const approvedCount = steps.filter((s) => s.status === "approved").length;
  const currentStepIndex = steps.findIndex((s) => s.id === activeStep?.id) + 1;

  const revisionPageHeader = (current: number) => (
    <PageHeader
      title={t("revision.pageTitle")}
      breadcrumbs={[
        { label: t("resume.pageTitle"), to: "/resumes" },
        { label: t("resume.detail.pageTitle"), to: `/resumes/${resumeId}` },
      ]}
      chip={
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {t("revision.topBar.step", { current, total: steps.length })}
        </Typography>
      }
    />
  );

  if (isCompleted) {
    return (
      <Box sx={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
        {revisionPageHeader(approvedCount)}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <FinalReview
            workflowId={workflow.id}
            onMerge={handleMerge}
            onKeep={handleKeep}
            isMerging={finalise.isPending && finalise.variables?.action === "merge"}
            isKeeping={finalise.isPending && finalise.variables?.action === "keep"}
          />
        </Box>
      </Box>
    );
  }

  // ─── Main three-column layout ──────────────────────────────────────────────

  return (
    <Box sx={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
      {revisionPageHeader(currentStepIndex)}

      <Box sx={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* Left: checklist */}
        <Box
          sx={{
            width: 220,
            flexShrink: 0,
            overflow: "auto",
            p: 1.5,
            borderRight: "1px solid",
            borderColor: "divider",
          }}
        >
          <WorkflowChecklist
            steps={steps}
            selectedStepId={activeStep?.id ?? null}
            onStepClick={handleStepClick}
          />
        </Box>

        {/* Center: diff / proposal panel */}
        <Box sx={{ flex: 1, minWidth: 0, overflow: "auto", p: 2 }}>
          <DiffPanel step={activeStep} discoveryOutput={discoveryOutput} />
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Right: conversation */}
        <Box
          sx={{
            width: 360,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderLeft: "1px solid",
            borderColor: "divider",
          }}
        >
          {activeStep ? (
            kickoffStep.isPending && activeStep.messages.length === 0 ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                <CircularProgress aria-label={t("revision.loading")} />
              </Box>
            ) : (
              <StepConversation
                step={activeStep}
                onSend={handleSend}
                onApprove={handleApprove}
                onRequestRework={handleRequestRework}
                onSkip={handleSkip}
                isSending={sendMessage.isPending}
                isApproving={approveStep.isPending}
                isRequestingRework={requestRework.isPending}
                isSkipping={skipStep.isPending}
              />
            )
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {t("revision.conversation.noMessages")}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
