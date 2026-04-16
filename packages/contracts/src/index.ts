import { oc } from "@orpc/contract";
import {
  listAIPromptConfigsInputSchema,
  listAIPromptConfigsOutputSchema,
  updateAIPromptFragmentInputSchema,
  updateAIPromptFragmentOutputSchema,
} from "./ai-prompt-configs.js";
import {
  consultantAIPreferencesSchema,
  getConsultantAIPreferencesInputSchema,
  getConsultantAIPreferencesOutputSchema,
  updateConsultantAIPreferencesInputSchema,
  updateConsultantAIPreferencesOutputSchema,
} from "./consultant-ai-preferences.js";
import {
  createExternalAIAuthorizationInputSchema,
  createExternalAIAuthorizationOutputSchema,
  deleteExternalAIAuthorizationInputSchema,
  deleteExternalAIAuthorizationOutputSchema,
  exchangeExternalAILoginChallengeInputSchema,
  exchangeExternalAILoginChallengeOutputSchema,
  externalAIAuthorizationSchema,
  externalAIAllowedRouteSchema,
  externalAIClientSchema,
  externalAIContextEntrySchema,
  externalAIAgentPromptModelSchema,
  externalAIConsultantPromptModelSchema,
  externalAIPromptGuidanceFragmentSchema,
  externalAIPromptGuidanceSchema,
  externalAIPromptLayerSchema,
  externalAIPromptModelSchema,
  externalAIScopeSchema,
  getExternalAIContextInputSchema,
  getExternalAIContextOutputSchema,
  listExternalAIAuthorizationsInputSchema,
  listExternalAIAuthorizationsOutputSchema,
  listExternalAIClientsInputSchema,
  listExternalAIClientsOutputSchema,
  refreshExternalAIAccessTokenInputSchema,
  refreshExternalAIAccessTokenOutputSchema,
  revokeExternalAIAuthorizationInputSchema,
  revokeExternalAIAuthorizationOutputSchema,
} from "./external-ai.js";
import { aiRoutes } from "./domains/ai/routes.js";
import { assignmentRoutes } from "./domains/assignments/routes.js";
import { authRoutes } from "./domains/auth/routes.js";
import { branchAssignmentRoutes } from "./domains/branch-assignments/routes.js";
import { educationRoutes } from "./domains/education/routes.js";
import { employeeRoutes } from "./domains/employees/routes.js";
import { externalAIRoutes } from "./domains/external-ai/routes.js";
import { importExportRoutes } from "./domains/import-export/routes.js";
import { resumeRoutes } from "./domains/resumes/routes.js";
import { resumeVersionRoutes } from "./domains/resume-versions/routes.js";
import {
  healthInputSchema,
  healthOutputSchema,
} from "./domains/system/schema.js";
import { systemRoutes } from "./domains/system/routes.js";

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export {
  aiPromptCategorySchema,
  aiPromptFragmentSchema,
  aiPromptDefinitionSchema,
  aiPromptCategoryWithPromptsSchema,
  listAIPromptConfigsInputSchema,
  listAIPromptConfigsOutputSchema,
  updateAIPromptFragmentInputSchema,
  updateAIPromptFragmentOutputSchema,
} from "./ai-prompt-configs.js";
export type {
  AIPromptCategory,
  AIPromptFragment,
  AIPromptDefinition,
  AIPromptCategoryWithPrompts,
  ListAIPromptConfigsInput,
  ListAIPromptConfigsOutput,
  UpdateAIPromptFragmentInput,
  UpdateAIPromptFragmentOutput,
} from "./ai-prompt-configs.js";
export {
  consultantAIPreferencesSchema,
  getConsultantAIPreferencesInputSchema,
  getConsultantAIPreferencesOutputSchema,
  updateConsultantAIPreferencesInputSchema,
  updateConsultantAIPreferencesOutputSchema,
} from "./consultant-ai-preferences.js";
export type {
  ConsultantAIPreferences,
  GetConsultantAIPreferencesInput,
  GetConsultantAIPreferencesOutput,
  UpdateConsultantAIPreferencesInput,
  UpdateConsultantAIPreferencesOutput,
} from "./consultant-ai-preferences.js";
export {
  externalAIScopeSchema,
  externalAIClientSchema,
  externalAIAuthorizationSchema,
  listExternalAIClientsInputSchema,
  listExternalAIClientsOutputSchema,
  listExternalAIAuthorizationsInputSchema,
  listExternalAIAuthorizationsOutputSchema,
  createExternalAIAuthorizationInputSchema,
  createExternalAIAuthorizationOutputSchema,
  deleteExternalAIAuthorizationInputSchema,
  deleteExternalAIAuthorizationOutputSchema,
  exchangeExternalAILoginChallengeInputSchema,
  exchangeExternalAILoginChallengeOutputSchema,
  refreshExternalAIAccessTokenInputSchema,
  refreshExternalAIAccessTokenOutputSchema,
  revokeExternalAIAuthorizationInputSchema,
  revokeExternalAIAuthorizationOutputSchema,
  externalAIAllowedRouteSchema,
  externalAIContextEntrySchema,
  externalAIAgentPromptModelSchema,
  externalAIConsultantPromptModelSchema,
  externalAIPromptGuidanceFragmentSchema,
  externalAIPromptGuidanceSchema,
  externalAIPromptLayerSchema,
  externalAIPromptModelSchema,
  getExternalAIContextInputSchema,
  getExternalAIContextOutputSchema,
} from "./external-ai.js";
export type {
  ExternalAIScope,
  ExternalAIClient,
  ExternalAIAuthorization,
  ListExternalAIClientsInput,
  ListExternalAIClientsOutput,
  ListExternalAIAuthorizationsInput,
  ListExternalAIAuthorizationsOutput,
  CreateExternalAIAuthorizationInput,
  CreateExternalAIAuthorizationOutput,
  DeleteExternalAIAuthorizationInput,
  DeleteExternalAIAuthorizationOutput,
  ExchangeExternalAILoginChallengeInput,
  ExchangeExternalAILoginChallengeOutput,
  RefreshExternalAIAccessTokenInput,
  RefreshExternalAIAccessTokenOutput,
  RevokeExternalAIAuthorizationInput,
  RevokeExternalAIAuthorizationOutput,
  ExternalAIAllowedRoute,
  ExternalAIContextEntry,
  ExternalAIAgentPromptModel,
  ExternalAIConsultantPromptModel,
  ExternalAIPromptGuidance,
  ExternalAIPromptGuidanceFragment,
  ExternalAIPromptLayer,
  ExternalAIPromptModel,
  GetExternalAIContextInput,
  GetExternalAIContextOutput,
} from "./external-ai.js";
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
  getResumeBranchInputSchema,
  getResumeBranchOutputSchema,
  createResumeInputSchema,
  createResumeOutputSchema,
  updateResumeInputSchema,
  updateResumeOutputSchema,
  deleteResumeInputSchema,
  deleteResumeOutputSchema,
} from "./resumes.js";
export type {
  ResumeSkillGroup,
  ResumeSkill,
  Resume,
  ResumeWithSkills,
  GetResumeBranchInput,
  GetResumeBranchOutput,
} from "./resumes.js";

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
  updateEducationInputSchema,
  updateEducationOutputSchema,
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
  branchTypeSchema,
  branchAssignmentSchema,
  saveResumeVersionInputSchema,
  saveResumeVersionOutputSchema,
  updateResumeBranchContentInputSchema,
  updateResumeBranchContentOutputSchema,
  updateResumeBranchSkillsInputSchema,
  updateResumeBranchSkillsOutputSchema,
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
  createTranslationBranchInputSchema,
  createTranslationBranchOutputSchema,
  createRevisionBranchInputSchema,
  createRevisionBranchOutputSchema,
  mergeRevisionIntoSourceInputSchema,
  mergeRevisionIntoSourceOutputSchema,
  promoteRevisionToVariantInputSchema,
  promoteRevisionToVariantOutputSchema,
  markTranslationCaughtUpInputSchema,
  markTranslationCaughtUpOutputSchema,
  archiveResumeBranchInputSchema,
  archiveResumeBranchOutputSchema,
  revertCommitInputSchema,
  revertCommitOutputSchema,
  rebaseTranslationOntoSourceInputSchema,
  rebaseTranslationOntoSourceOutputSchema,
  rebaseRevisionOntoSourceInputSchema,
  rebaseRevisionOntoSourceOutputSchema,
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
  BranchType,
  ResumeBranchHistoryGraph,
  BranchAssignment,
  UpdateResumeBranchContentInput,
  UpdateResumeBranchContentOutput,
  UpdateResumeBranchSkillsInput,
  UpdateResumeBranchSkillsOutput,
  DiffStatus,
  ResumeDiffScalars,
  SkillDiffEntry,
  AssignmentDiffEntry,
  ResumeDiff,
  CompareResumeCommitsOutput,
  CreateTranslationBranchInput,
  CreateTranslationBranchOutput,
  CreateRevisionBranchInput,
  CreateRevisionBranchOutput,
  MergeRevisionIntoSourceInput,
  MergeRevisionIntoSourceOutput,
  PromoteRevisionToVariantInput,
  PromoteRevisionToVariantOutput,
  MarkTranslationCaughtUpInput,
  MarkTranslationCaughtUpOutput,
  ArchiveResumeBranchInput,
  ArchiveResumeBranchOutput,
  RevertCommitInput,
  RevertCommitOutput,
  RebaseTranslationOntoSourceInput,
  RebaseTranslationOntoSourceOutput,
  RebaseRevisionOntoSourceInput,
  RebaseRevisionOntoSourceOutput,
} from "./resume-versions.js";

export {
  branchAssignmentItemSchema,
  fullBranchAssignmentSchema,
  listBranchAssignmentsInputSchema,
  listBranchAssignmentsOutputSchema,
  addBranchAssignmentInputSchema,
  addBranchAssignmentOutputSchema,
  addResumeBranchAssignmentInputSchema,
  removeBranchAssignmentInputSchema,
  removeBranchAssignmentOutputSchema,
  removeResumeBranchAssignmentInputSchema,
  updateBranchAssignmentInputSchema,
  updateBranchAssignmentOutputSchema,
  updateResumeBranchAssignmentInputSchema,
  listBranchAssignmentsFullInputSchema,
  listBranchAssignmentsFullOutputSchema,
} from "./branch-assignments.js";
export type {
  BranchAssignmentItem,
  FullBranchAssignment,
  AddResumeBranchAssignmentInput,
  RemoveResumeBranchAssignmentInput,
  UpdateResumeBranchAssignmentInput,
} from "./branch-assignments.js";

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
} from "./domains/system/schema.js";

// ---------------------------------------------------------------------------
// Router contract
// ---------------------------------------------------------------------------

export const contract = oc.router({
  ...systemRoutes,
  ...authRoutes,
  ...externalAIRoutes,
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
