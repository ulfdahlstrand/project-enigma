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
  deleteEmployeeInputSchema,
  deleteEmployeeOutputSchema,
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
  finaliseResumeBranchInputSchema,
  finaliseResumeBranchOutputSchema,
  deleteResumeBranchInputSchema,
  deleteResumeBranchOutputSchema,
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
  resolveRevisionSuggestionInputSchema,
  resolveRevisionSuggestionOutputSchema,
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
  deleteEmployeeInputSchema,
  deleteEmployeeOutputSchema,
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
  finaliseResumeBranchInputSchema,
  finaliseResumeBranchOutputSchema,
  deleteResumeBranchInputSchema,
  deleteResumeBranchOutputSchema,
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
  resolveRevisionSuggestionInputSchema,
  resolveRevisionSuggestionOutputSchema,
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
  ResolveRevisionSuggestionInput,
  ResolveRevisionSuggestionOutput,
} from "./ai-conversations.js";

// ---------------------------------------------------------------------------
// Router contract
// ---------------------------------------------------------------------------

export const contract = oc.router({
  health: oc
    .route({ method: "GET", path: "/health" })
    .input(healthInputSchema)
    .output(healthOutputSchema),
  getCurrentSession: oc
    .route({ method: "GET", path: "/auth/session" })
    .input(getCurrentSessionInputSchema)
    .output(getCurrentSessionOutputSchema),
  listTestEntries: oc
    .route({ method: "GET", path: "/test-entries" })
    .input(listTestEntriesInputSchema)
    .output(listTestEntriesOutputSchema),
  listEmployees: oc
    .route({ method: "GET", path: "/employees" })
    .input(z.object({}))
    .output(listEmployeesOutputSchema),
  getEmployee: oc
    .route({ method: "GET", path: "/employees/{id}" })
    .input(getEmployeeInputSchema)
    .output(getEmployeeOutputSchema),
  createEmployee: oc
    .route({ method: "POST", path: "/employees" })
    .input(createEmployeeInputSchema)
    .output(createEmployeeOutputSchema),
  updateEmployee: oc
    .route({ method: "PATCH", path: "/employees/{id}" })
    .input(updateEmployeeInputSchema)
    .output(updateEmployeeOutputSchema),
  deleteEmployee: oc
    .route({ method: "DELETE", path: "/employees/{id}" })
    .input(deleteEmployeeInputSchema)
    .output(deleteEmployeeOutputSchema),
  listResumes: oc
    .route({ method: "GET", path: "/resumes" })
    .input(listResumesInputSchema)
    .output(listResumesOutputSchema),
  getResume: oc
    .route({ method: "GET", path: "/resumes/{id}" })
    .input(getResumeInputSchema)
    .output(getResumeOutputSchema),
  createResume: oc
    .route({ method: "POST", path: "/resumes" })
    .input(createResumeInputSchema)
    .output(createResumeOutputSchema),
  updateResume: oc
    .route({ method: "PATCH", path: "/resumes/{id}" })
    .input(updateResumeInputSchema)
    .output(updateResumeOutputSchema),
  deleteResume: oc
    .route({ method: "DELETE", path: "/resumes/{id}" })
    .input(deleteResumeInputSchema)
    .output(deleteResumeOutputSchema),
  createResumeSkill: oc
    .route({ method: "POST", path: "/resumes/{cvId}/skills" })
    .input(createResumeSkillInputSchema)
    .output(createResumeSkillOutputSchema),
  updateResumeSkill: oc
    .route({ method: "PATCH", path: "/resume-skills/{id}" })
    .input(updateResumeSkillInputSchema)
    .output(updateResumeSkillOutputSchema),
  deleteResumeSkill: oc
    .route({ method: "DELETE", path: "/resume-skills/{id}" })
    .input(deleteResumeSkillInputSchema)
    .output(deleteResumeSkillOutputSchema),
  createAssignment: oc.input(createAssignmentInputSchema).output(createAssignmentOutputSchema),
  deleteAssignment: oc.input(deleteAssignmentInputSchema).output(deleteAssignmentOutputSchema),
  listEducation: oc
    .route({ method: "GET", path: "/employees/{employeeId}/education" })
    .input(listEducationInputSchema)
    .output(listEducationOutputSchema),
  createEducation: oc
    .route({ method: "POST", path: "/employees/{employeeId}/education" })
    .input(createEducationInputSchema)
    .output(createEducationOutputSchema),
  deleteEducation: oc
    .route({ method: "DELETE", path: "/education/{id}" })
    .input(deleteEducationInputSchema)
    .output(deleteEducationOutputSchema),
  importCv: oc
    .route({ method: "POST", path: "/employees/{employeeId}/resumes/import" })
    .input(importCvInputSchema)
    .output(importCvOutputSchema),
  parseCvDocx: oc
    .route({ method: "POST", path: "/cv/parse-docx" })
    .input(parseCvDocxInputSchema)
    .output(parseCvDocxOutputSchema),
  exportResumeMarkdown: oc
    .route({ method: "POST", path: "/resumes/{resumeId}/export/markdown" })
    .input(exportResumeMarkdownInputSchema)
    .output(exportResumeMarkdownOutputSchema),
  exportResumePdf: oc
    .route({ method: "POST", path: "/resumes/{resumeId}/export/pdf" })
    .input(exportResumePdfInputSchema)
    .output(exportResumePdfOutputSchema),
  exportResumeDocx: oc
    .route({ method: "POST", path: "/resumes/{resumeId}/export/docx" })
    .input(exportResumeDocxInputSchema)
    .output(exportResumeDocxOutputSchema),
  saveResumeVersion: oc
    .route({ method: "POST", path: "/resume-branches/{branchId}/commits" })
    .input(saveResumeVersionInputSchema)
    .output(saveResumeVersionOutputSchema),
  getResumeCommit: oc
    .route({ method: "GET", path: "/resume-commits/{commitId}" })
    .input(getResumeCommitInputSchema)
    .output(getResumeCommitOutputSchema),
  listResumeCommits: oc
    .route({ method: "GET", path: "/resume-branches/{branchId}/commits" })
    .input(listResumeCommitsInputSchema)
    .output(listResumeCommitsOutputSchema),
  forkResumeBranch: oc
    .route({ method: "POST", path: "/resume-commits/{fromCommitId}/branches" })
    .input(forkResumeBranchInputSchema)
    .output(forkResumeBranchOutputSchema),
  finaliseResumeBranch: oc
    .route({ method: "POST", path: "/resume-branches/{revisionBranchId}/finalise" })
    .input(finaliseResumeBranchInputSchema)
    .output(finaliseResumeBranchOutputSchema),
  deleteResumeBranch: oc
    .route({ method: "DELETE", path: "/resume-branches/{branchId}" })
    .input(deleteResumeBranchInputSchema)
    .output(deleteResumeBranchOutputSchema),
  listResumeBranches: oc
    .route({ method: "GET", path: "/resumes/{resumeId}/branches" })
    .input(listResumeBranchesInputSchema)
    .output(listResumeBranchesOutputSchema),
  getResumeBranchHistoryGraph: oc
    .route({ method: "GET", path: "/resumes/{resumeId}/branch-history" })
    .input(getResumeBranchHistoryGraphInputSchema)
    .output(getResumeBranchHistoryGraphOutputSchema),
  listBranchAssignments: oc
    .route({ method: "GET", path: "/resume-branches/{branchId}/assignment-links" })
    .input(listBranchAssignmentsInputSchema)
    .output(listBranchAssignmentsOutputSchema),
  addBranchAssignment: oc
    .route({ method: "POST", path: "/resume-branches/{branchId}/assignments" })
    .input(addBranchAssignmentInputSchema)
    .output(addBranchAssignmentOutputSchema),
  removeBranchAssignment: oc
    .route({ method: "DELETE", path: "/branch-assignments/{id}" })
    .input(removeBranchAssignmentInputSchema)
    .output(removeBranchAssignmentOutputSchema),
  updateBranchAssignment: oc
    .route({ method: "PATCH", path: "/branch-assignments/{id}" })
    .input(updateBranchAssignmentInputSchema)
    .output(updateBranchAssignmentOutputSchema),
  listBranchAssignmentsFull: oc
    .route({ method: "GET", path: "/resume-branches/{branchId}/assignments" })
    .input(listBranchAssignmentsFullInputSchema)
    .output(listBranchAssignmentsFullOutputSchema),
  compareResumeCommits: oc
    .route({ method: "POST", path: "/resume-commits/compare" })
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
    .route({ method: "POST", path: "/ai/conversations/{conversationId}/messages" })
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
    .route({ method: "POST", path: "/ai/conversations/{conversationId}/close" })
    .input(closeAIConversationInputSchema)
    .output(closeAIConversationOutputSchema),
  resolveRevisionSuggestion: oc
    .route({ method: "PATCH", path: "/ai/conversations/{conversationId}/suggestions/{suggestionId}" })
    .input(resolveRevisionSuggestionInputSchema)
    .output(resolveRevisionSuggestionOutputSchema),
});

/** Inferred contract type — used by the frontend to create a typed oRPC client. */
export type AppRouter = typeof contract;
