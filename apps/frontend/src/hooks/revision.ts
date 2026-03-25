import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../orpc-client";

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------

export const revisionWorkflowsKey = (resumeId: string) =>
  ["listResumeRevisionWorkflows", resumeId] as const;

export const revisionWorkflowKey = (workflowId: string) =>
  ["getResumeRevisionWorkflow", workflowId] as const;

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useRevisionWorkflows(resumeId: string | null) {
  return useQuery({
    queryKey: revisionWorkflowsKey(resumeId ?? ""),
    queryFn: () => orpc.listResumeRevisionWorkflows({ resumeId: resumeId! }),
    enabled: Boolean(resumeId),
  });
}

export function useRevisionWorkflow(workflowId: string | null) {
  return useQuery({
    queryKey: revisionWorkflowKey(workflowId ?? ""),
    queryFn: () => orpc.getResumeRevisionWorkflow({ workflowId: workflowId! }),
    enabled: Boolean(workflowId),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateRevisionWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { resumeId: string; baseBranchId: string }) =>
      orpc.createResumeRevisionWorkflow(input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: revisionWorkflowsKey(data.resumeId),
      });
    },
  });
}

export function useSendRevisionMessage(workflowId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { stepId: string; content: string; locale?: string }) =>
      orpc.sendResumeRevisionMessage(input),
    onSuccess: () => {
      if (workflowId) {
        void queryClient.invalidateQueries({
          queryKey: revisionWorkflowKey(workflowId),
        });
      }
    },
  });
}

export function useApproveRevisionStep(workflowId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { stepId: string }) => orpc.approveRevisionStep(input),
    onSuccess: () => {
      if (workflowId) {
        void queryClient.invalidateQueries({
          queryKey: revisionWorkflowKey(workflowId),
        });
      }
    },
  });
}

export function useRequestRevisionRework(workflowId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { stepId: string; feedback?: string }) =>
      orpc.requestRevisionStepRework(input),
    onSuccess: () => {
      if (workflowId) {
        void queryClient.invalidateQueries({
          queryKey: revisionWorkflowKey(workflowId),
        });
      }
    },
  });
}

export function useKickoffRevisionStep(workflowId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { stepId: string; locale?: string }) => orpc.kickoffRevisionStep(input),
    onSuccess: () => {
      if (workflowId) {
        void queryClient.invalidateQueries({
          queryKey: revisionWorkflowKey(workflowId),
        });
      }
    },
  });
}

export function useSkipRevisionStep(workflowId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { stepId: string }) => orpc.skipRevisionStep(input),
    onSuccess: () => {
      if (workflowId) {
        void queryClient.invalidateQueries({
          queryKey: revisionWorkflowKey(workflowId),
        });
      }
    },
  });
}

export function useFinaliseRevision(resumeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workflowId: string; action: "merge" | "keep" }) =>
      orpc.finaliseResumeRevision(input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: revisionWorkflowKey(data.workflow.id),
      });
      if (resumeId) {
        void queryClient.invalidateQueries({
          queryKey: revisionWorkflowsKey(resumeId),
        });
      }
    },
  });
}
