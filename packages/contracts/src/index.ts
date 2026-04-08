import { oc } from "@orpc/contract";
import { aiRoutes } from "./domains/ai/routes.js";
import { assignmentRoutes } from "./domains/assignments/routes.js";
import { authRoutes } from "./domains/auth/routes.js";
import { branchAssignmentRoutes } from "./domains/branch-assignments/routes.js";
import { educationRoutes } from "./domains/education/routes.js";
import { employeeRoutes } from "./domains/employees/routes.js";
import { importExportRoutes } from "./domains/import-export/routes.js";
import { resumeRoutes } from "./domains/resumes/routes.js";
import { resumeVersionRoutes } from "./domains/resume-versions/routes.js";
import {
  healthInputSchema,
  healthOutputSchema,
  listTestEntriesInputSchema,
  listTestEntriesOutputSchema,
  testEntrySchema,
} from "./domains/system/schema.js";
import { systemRoutes } from "./domains/system/routes.js";

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
  resumeSkillGroupSchema,
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
  createResumeSkillGroupInputSchema,
  createResumeSkillGroupOutputSchema,
  updateResumeSkillGroupInputSchema,
  updateResumeSkillGroupOutputSchema,
  createResumeSkillInputSchema,
  createResumeSkillOutputSchema,
  updateResumeSkillInputSchema,
  updateResumeSkillOutputSchema,
  deleteResumeSkillInputSchema,
  deleteResumeSkillOutputSchema,
} from "./resumes.js";
export type { ResumeSkillGroup, ResumeSkill, Resume, ResumeWithSkills } from "./resumes.js";

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
  resumeCommitListItemSchema,
  resumeCommitGraphNodeSchema,
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
  ResumeCommitListItem,
  ResumeCommitGraphNode,
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
export {
  healthInputSchema,
  healthOutputSchema,
  listTestEntriesInputSchema,
  listTestEntriesOutputSchema,
  testEntrySchema,
} from "./domains/system/schema.js";
export type { TestEntry } from "./domains/system/schema.js";

// ---------------------------------------------------------------------------
// Router contract
// ---------------------------------------------------------------------------

export const contract = oc.router({
  ...systemRoutes,
  ...authRoutes,
  ...employeeRoutes,
  ...resumeRoutes,
  ...assignmentRoutes,
  ...educationRoutes,
  ...importExportRoutes,
  ...resumeVersionRoutes,
  ...branchAssignmentRoutes,
  ...aiRoutes,
});

/** Inferred contract type — used by the frontend to create a typed oRPC client. */
export type AppRouter = typeof contract;
