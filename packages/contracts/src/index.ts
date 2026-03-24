import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  listEmployeesOutputSchema,
  getEmployeeInputSchema,
  getEmployeeOutputSchema,
  createEmployeeInputSchema,
  createEmployeeOutputSchema,
  updateEmployeeInputSchema,
  updateEmployeeOutputSchema,
} from "./employees.js";
import {
  listResumesInputSchema,
  listResumesOutputSchema,
  getResumeInputSchema,
  getResumeOutputSchema,
  createResumeInputSchema,
  createResumeOutputSchema,
  updateResumeInputSchema,
  updateResumeOutputSchema,
  deleteResumeInputSchema,
  deleteResumeOutputSchema,
  createResumeSkillInputSchema,
  createResumeSkillOutputSchema,
  updateResumeSkillInputSchema,
  updateResumeSkillOutputSchema,
  deleteResumeSkillInputSchema,
  deleteResumeSkillOutputSchema,
} from "./resumes.js";
import {
  createAssignmentInputSchema,
  createAssignmentOutputSchema,
  deleteAssignmentInputSchema,
  deleteAssignmentOutputSchema,
} from "./assignments.js";
import {
  listEducationInputSchema,
  listEducationOutputSchema,
  createEducationInputSchema,
  createEducationOutputSchema,
  deleteEducationInputSchema,
  deleteEducationOutputSchema,
} from "./education.js";
import {
  importCvInputSchema,
  importCvOutputSchema,
  parseCvDocxInputSchema,
  parseCvDocxOutputSchema,
} from "./import-cv.js";
import {
  exportResumeMarkdownInputSchema,
  exportResumeMarkdownOutputSchema,
  exportResumePdfInputSchema,
  exportResumePdfOutputSchema,
  exportResumeDocxInputSchema,
  exportResumeDocxOutputSchema,
} from "./export-resume.js";
import {
  saveResumeVersionInputSchema,
  saveResumeVersionOutputSchema,
  getResumeCommitInputSchema,
  getResumeCommitOutputSchema,
  listResumeCommitsInputSchema,
  listResumeCommitsOutputSchema,
  forkResumeBranchInputSchema,
  forkResumeBranchOutputSchema,
  listResumeBranchesInputSchema,
  listResumeBranchesOutputSchema,
  getResumeBranchHistoryGraphInputSchema,
  getResumeBranchHistoryGraphOutputSchema,
  compareResumeCommitsInputSchema,
  compareResumeCommitsOutputSchema,
} from "./resume-versions.js";
import {
  listBranchAssignmentsInputSchema,
  listBranchAssignmentsOutputSchema,
  addBranchAssignmentInputSchema,
  addBranchAssignmentOutputSchema,
  removeBranchAssignmentInputSchema,
  removeBranchAssignmentOutputSchema,
  updateBranchAssignmentInputSchema,
  updateBranchAssignmentOutputSchema,
  listBranchAssignmentsFullInputSchema,
  listBranchAssignmentsFullOutputSchema,
} from "./branch-assignments.js";
import {
  improveDescriptionInputSchema,
  improveDescriptionOutputSchema,
} from "./ai.js";
import {
  getCurrentSessionInputSchema,
  getCurrentSessionOutputSchema,
} from "./auth.js";
import {
  createAIConversationInputSchema,
  createAIConversationOutputSchema,
  sendAIMessageInputSchema,
  sendAIMessageOutputSchema,
  getAIConversationInputSchema,
  getAIConversationOutputSchema,
  listAIConversationsInputSchema,
  listAIConversationsOutputSchema,
  closeAIConversationInputSchema,
  closeAIConversationOutputSchema,
} from "./ai-conversations.js";

// ---------------------------------------------------------------------------
// Health procedure — Zod schemas
// ---------------------------------------------------------------------------

export const healthInputSchema = z.object({
  echo: z.string().optional(),
});

export const healthOutputSchema = z.object({
  status: z.literal("ok"),
  echo: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Test entries procedure — Zod schemas
// ---------------------------------------------------------------------------

export const listTestEntriesInputSchema = z.object({});

export const testEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  note: z.string(),
});

export const listTestEntriesOutputSchema = z.object({
  entries: z.array(testEntrySchema),
});

export type TestEntry = z.infer<typeof testEntrySchema>;

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export {
  employeeSchema,
  listEmployeesOutputSchema,
  getEmployeeInputSchema,
  getEmployeeOutputSchema,
  createEmployeeInputSchema,
  createEmployeeOutputSchema,
  updateEmployeeInputSchema,
  updateEmployeeOutputSchema,
} from "./employees.js";
export type { Employee } from "./employees.js";

export {
  resumeSkillSchema,
  resumeSchema,
  resumeWithSkillsSchema,
  listResumesInputSchema,
  listResumesOutputSchema,
  getResumeInputSchema,
  getResumeOutputSchema,
  createResumeInputSchema,
  createResumeOutputSchema,
  updateResumeInputSchema,
  updateResumeOutputSchema,
  deleteResumeInputSchema,
  deleteResumeOutputSchema,
  createResumeSkillInputSchema,
  createResumeSkillOutputSchema,
  updateResumeSkillInputSchema,
  updateResumeSkillOutputSchema,
  deleteResumeSkillInputSchema,
  deleteResumeSkillOutputSchema,
} from "./resumes.js";
export type { ResumeSkill, Resume, ResumeWithSkills } from "./resumes.js";

export {
  assignmentSchema,
  createAssignmentInputSchema,
  createAssignmentOutputSchema,
  deleteAssignmentInputSchema,
  deleteAssignmentOutputSchema,
} from "./assignments.js";
export type { Assignment } from "./assignments.js";

export {
  educationTypeSchema,
  educationSchema,
  listEducationInputSchema,
  listEducationOutputSchema,
  createEducationInputSchema,
  createEducationOutputSchema,
  deleteEducationInputSchema,
  deleteEducationOutputSchema,
} from "./education.js";
export type { Education, EducationType } from "./education.js";

export {
  cvJsonSchema,
  importCvInputSchema,
  importCvOutputSchema,
  parseCvDocxInputSchema,
  parseCvDocxOutputSchema,
} from "./import-cv.js";
export type { CvJson } from "./import-cv.js";

export {
  exportResumeMarkdownInputSchema,
  exportResumeMarkdownOutputSchema,
  exportResumePdfInputSchema,
  exportResumePdfOutputSchema,
  exportResumeDocxInputSchema,
  exportResumeDocxOutputSchema,
} from "./export-resume.js";

export {
  resumeCommitSkillSchema,
  resumeCommitAssignmentSchema,
  resumeCommitContentSchema,
  resumeCommitSchema,
  resumeCommitSummarySchema,
  resumeBranchSchema,
  branchAssignmentSchema,
  saveResumeVersionInputSchema,
  saveResumeVersionOutputSchema,
  getResumeCommitInputSchema,
  getResumeCommitOutputSchema,
  listResumeCommitsInputSchema,
  listResumeCommitsOutputSchema,
  forkResumeBranchInputSchema,
  forkResumeBranchOutputSchema,
  listResumeBranchesInputSchema,
  listResumeBranchesOutputSchema,
  getResumeBranchHistoryGraphInputSchema,
  getResumeBranchHistoryGraphOutputSchema,
  compareResumeCommitsInputSchema,
  compareResumeCommitsOutputSchema,
  diffStatusSchema,
  resumeBranchHistoryGraphSchema,
  resumeDiffScalarsSchema,
  skillDiffEntrySchema,
  assignmentDiffEntrySchema,
  resumeDiffSchema,
} from "./resume-versions.js";
export type {
  ResumeCommitContent,
  ResumeCommit,
  ResumeCommitSummary,
  ResumeBranch,
  ResumeBranchHistoryGraph,
  BranchAssignment,
  DiffStatus,
  ResumeDiffScalars,
  SkillDiffEntry,
  AssignmentDiffEntry,
  ResumeDiff,
  CompareResumeCommitsOutput,
} from "./resume-versions.js";

export {
  branchAssignmentItemSchema,
  fullBranchAssignmentSchema,
  listBranchAssignmentsInputSchema,
  listBranchAssignmentsOutputSchema,
  addBranchAssignmentInputSchema,
  addBranchAssignmentOutputSchema,
  removeBranchAssignmentInputSchema,
  removeBranchAssignmentOutputSchema,
  updateBranchAssignmentInputSchema,
  updateBranchAssignmentOutputSchema,
  listBranchAssignmentsFullInputSchema,
  listBranchAssignmentsFullOutputSchema,
} from "./branch-assignments.js";
export type { BranchAssignmentItem, FullBranchAssignment } from "./branch-assignments.js";

export {
  authUserRoleSchema,
  currentSessionUserSchema,
  getCurrentSessionInputSchema,
  getCurrentSessionOutputSchema,
} from "./auth.js";
export type {
  AuthUserRole,
  CurrentSessionUser,
  GetCurrentSessionInput,
  GetCurrentSessionOutput,
} from "./auth.js";

export {
  improveDescriptionInputSchema,
  improveDescriptionOutputSchema,
} from "./ai.js";
export type { ImproveDescriptionInput, ImproveDescriptionOutput } from "./ai.js";

export {
  aiMessageRoleSchema,
  aiConversationSchema,
  aiMessageSchema,
  createAIConversationInputSchema,
  createAIConversationOutputSchema,
  sendAIMessageInputSchema,
  sendAIMessageOutputSchema,
  getAIConversationInputSchema,
  getAIConversationOutputSchema,
  listAIConversationsInputSchema,
  listAIConversationsOutputSchema,
  closeAIConversationInputSchema,
  closeAIConversationOutputSchema,
} from "./ai-conversations.js";
export type {
  AIConversation,
  AIMessage,
  AIMessageRole,
  CreateAIConversationInput,
  CreateAIConversationOutput,
  SendAIMessageInput,
  SendAIMessageOutput,
  GetAIConversationInput,
  GetAIConversationOutput,
  ListAIConversationsInput,
  ListAIConversationsOutput,
  CloseAIConversationInput,
  CloseAIConversationOutput,
} from "./ai-conversations.js";

// ---------------------------------------------------------------------------
// Router contract
// ---------------------------------------------------------------------------

export const contract = oc.router({
  health: oc.input(healthInputSchema).output(healthOutputSchema),
  getCurrentSession: oc
    .route({ method: "GET", path: "/auth/session" })
    .input(getCurrentSessionInputSchema)
    .output(getCurrentSessionOutputSchema),
  listTestEntries: oc
    .input(listTestEntriesInputSchema)
    .output(listTestEntriesOutputSchema),
  listEmployees: oc
    .input(z.object({}))
    .output(listEmployeesOutputSchema),
  getEmployee: oc
    .input(getEmployeeInputSchema)
    .output(getEmployeeOutputSchema),
  createEmployee: oc
    .input(createEmployeeInputSchema)
    .output(createEmployeeOutputSchema),
  updateEmployee: oc
    .input(updateEmployeeInputSchema)
    .output(updateEmployeeOutputSchema),
  listResumes: oc.input(listResumesInputSchema).output(listResumesOutputSchema),
  getResume: oc.input(getResumeInputSchema).output(getResumeOutputSchema),
  createResume: oc.input(createResumeInputSchema).output(createResumeOutputSchema),
  updateResume: oc.input(updateResumeInputSchema).output(updateResumeOutputSchema),
  deleteResume: oc.input(deleteResumeInputSchema).output(deleteResumeOutputSchema),
  createResumeSkill: oc.input(createResumeSkillInputSchema).output(createResumeSkillOutputSchema),
  updateResumeSkill: oc.input(updateResumeSkillInputSchema).output(updateResumeSkillOutputSchema),
  deleteResumeSkill: oc.input(deleteResumeSkillInputSchema).output(deleteResumeSkillOutputSchema),
  createAssignment: oc.input(createAssignmentInputSchema).output(createAssignmentOutputSchema),
  deleteAssignment: oc.input(deleteAssignmentInputSchema).output(deleteAssignmentOutputSchema),
  listEducation: oc.input(listEducationInputSchema).output(listEducationOutputSchema),
  createEducation: oc.input(createEducationInputSchema).output(createEducationOutputSchema),
  deleteEducation: oc.input(deleteEducationInputSchema).output(deleteEducationOutputSchema),
  importCv: oc.input(importCvInputSchema).output(importCvOutputSchema),
  parseCvDocx: oc.input(parseCvDocxInputSchema).output(parseCvDocxOutputSchema),
  exportResumeMarkdown: oc
    .input(exportResumeMarkdownInputSchema)
    .output(exportResumeMarkdownOutputSchema),
  exportResumePdf: oc
    .input(exportResumePdfInputSchema)
    .output(exportResumePdfOutputSchema),
  exportResumeDocx: oc
    .input(exportResumeDocxInputSchema)
    .output(exportResumeDocxOutputSchema),
  saveResumeVersion: oc
    .input(saveResumeVersionInputSchema)
    .output(saveResumeVersionOutputSchema),
  getResumeCommit: oc
    .input(getResumeCommitInputSchema)
    .output(getResumeCommitOutputSchema),
  listResumeCommits: oc
    .input(listResumeCommitsInputSchema)
    .output(listResumeCommitsOutputSchema),
  forkResumeBranch: oc
    .input(forkResumeBranchInputSchema)
    .output(forkResumeBranchOutputSchema),
  listResumeBranches: oc
    .input(listResumeBranchesInputSchema)
    .output(listResumeBranchesOutputSchema),
  getResumeBranchHistoryGraph: oc
    .input(getResumeBranchHistoryGraphInputSchema)
    .output(getResumeBranchHistoryGraphOutputSchema),
  listBranchAssignments: oc
    .input(listBranchAssignmentsInputSchema)
    .output(listBranchAssignmentsOutputSchema),
  addBranchAssignment: oc
    .input(addBranchAssignmentInputSchema)
    .output(addBranchAssignmentOutputSchema),
  removeBranchAssignment: oc
    .input(removeBranchAssignmentInputSchema)
    .output(removeBranchAssignmentOutputSchema),
  updateBranchAssignment: oc
    .input(updateBranchAssignmentInputSchema)
    .output(updateBranchAssignmentOutputSchema),
  listBranchAssignmentsFull: oc
    .input(listBranchAssignmentsFullInputSchema)
    .output(listBranchAssignmentsFullOutputSchema),
  compareResumeCommits: oc
    .input(compareResumeCommitsInputSchema)
    .output(compareResumeCommitsOutputSchema),
  improveDescription: oc
    .route({ method: "POST", path: "/ai/improve-description" })
    .input(improveDescriptionInputSchema)
    .output(improveDescriptionOutputSchema),
  createAIConversation: oc
    .route({ method: "POST", path: "/ai/conversations" })
    .input(createAIConversationInputSchema)
    .output(createAIConversationOutputSchema),
  sendAIMessage: oc
    .route({ method: "POST", path: "/ai/conversations/message" })
    .input(sendAIMessageInputSchema)
    .output(sendAIMessageOutputSchema),
  getAIConversation: oc
    .route({ method: "GET", path: "/ai/conversations/{conversationId}" })
    .input(getAIConversationInputSchema)
    .output(getAIConversationOutputSchema),
  listAIConversations: oc
    .route({ method: "GET", path: "/ai/conversations" })
    .input(listAIConversationsInputSchema)
    .output(listAIConversationsOutputSchema),
  closeAIConversation: oc
    .route({ method: "POST", path: "/ai/conversations/close" })
    .input(closeAIConversationInputSchema)
    .output(closeAIConversationOutputSchema),
});

/** Inferred contract type — used by the frontend to create a typed oRPC client. */
export type AppRouter = typeof contract;
