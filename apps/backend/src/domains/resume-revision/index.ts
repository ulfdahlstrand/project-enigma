import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// Resume Revision Workflow handlers
//
// Stub implementations — full logic will be added in the backend procedures
// issue (#390). Each handler throws NOT_IMPLEMENTED until implemented.
// ---------------------------------------------------------------------------

export const createResumeRevisionWorkflowHandler = implement(
  contract.createResumeRevisionWorkflow
).handler(async () => {
  throw new ORPCError("NOT_IMPLEMENTED");
});

export const getResumeRevisionWorkflowHandler = implement(
  contract.getResumeRevisionWorkflow
).handler(async () => {
  throw new ORPCError("NOT_IMPLEMENTED");
});

export const listResumeRevisionWorkflowsHandler = implement(
  contract.listResumeRevisionWorkflows
).handler(async () => {
  throw new ORPCError("NOT_IMPLEMENTED");
});

export const sendResumeRevisionMessageHandler = implement(
  contract.sendResumeRevisionMessage
).handler(async () => {
  throw new ORPCError("NOT_IMPLEMENTED");
});

export const approveRevisionStepHandler = implement(
  contract.approveRevisionStep
).handler(async () => {
  throw new ORPCError("NOT_IMPLEMENTED");
});

export const requestRevisionStepReworkHandler = implement(
  contract.requestRevisionStepRework
).handler(async () => {
  throw new ORPCError("NOT_IMPLEMENTED");
});

export const finaliseResumeRevisionHandler = implement(
  contract.finaliseResumeRevision
).handler(async () => {
  throw new ORPCError("NOT_IMPLEMENTED");
});
