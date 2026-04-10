import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import { healthHandler } from "./infra/index.js";
import {
  listEmployeesHandler,
  getEmployeeHandler,
  createEmployeeHandler,
  updateEmployeeHandler,
  deleteEmployeeHandler,
} from "./domains/employee/index.js";
import {
  listResumesHandler,
  getResumeHandler,
  createResumeHandler,
  updateResumeHandler,
  deleteResumeHandler,
  forkResumeBranchHandler,
  updateResumeBranchSkillsHandler,
  finaliseResumeBranchHandler,
  deleteResumeBranchHandler,
  listResumeBranchesHandler,
  getResumeBranchHistoryGraphHandler,
  saveResumeVersionHandler,
  getResumeCommitHandler,
  listResumeCommitsHandler,
  compareResumeCommitsHandler,
  addBranchAssignmentHandler,
  removeBranchAssignmentHandler,
  updateBranchAssignmentHandler,
  listBranchAssignmentsHandler,
  listBranchAssignmentsFullHandler,
  createAssignmentHandler,
  deleteAssignmentHandler,
} from "./domains/resume/index.js";
import {
  listEducationHandler,
  createEducationHandler,
  updateEducationHandler,
  deleteEducationHandler,
} from "./domains/education/index.js";
import { importCvHandler, parseCvDocxHandler } from "./domains/import/index.js";
import {
  improveDescriptionHandler,
  createAIConversationHandler,
  sendAIMessageHandler,
  getAIConversationHandler,
  listAIConversationsHandler,
  closeAIConversationHandler,
  resolveRevisionSuggestionHandler,
} from "./domains/ai/index.js";
import {
  exportResumePdfHandler,
  exportResumeDocxHandler,
  exportResumeMarkdownHandler,
} from "./domains/export/index.js";
import {
  getCurrentSessionHandler,
  listExternalAIClientsHandler,
  listExternalAIAuthorizationsHandler,
  createExternalAIAuthorizationHandler,
  exchangeExternalAILoginChallengeHandler,
  revokeExternalAIAuthorizationHandler,
} from "./domains/auth/index.js";
import {
  getExternalAIContextHandler,
  listAIPromptConfigsHandler,
  updateAIPromptFragmentHandler,
} from "./domains/system/index.js";

/**
 * The oRPC router — implements every procedure defined in the @cv-tool/contracts
 * package. Adding a new procedure requires: (1) adding it to the contract, and
 * (2) adding its handler here.
 *
 * CRUD handlers use getDb() internally at request time (not at module-load time),
 * keeping unit tests that import individual handler files free from DATABASE_URL
 * requirements (ADR-011 DI pattern).
 */
export const router = implement(contract).router({
  health: healthHandler,
  listExternalAIClients: listExternalAIClientsHandler,
  listExternalAIAuthorizations: listExternalAIAuthorizationsHandler,
  createExternalAIAuthorization: createExternalAIAuthorizationHandler,
  exchangeExternalAILoginChallenge: exchangeExternalAILoginChallengeHandler,
  revokeExternalAIAuthorization: revokeExternalAIAuthorizationHandler,
  getExternalAIContext: getExternalAIContextHandler,
  listAIPromptConfigs: listAIPromptConfigsHandler,
  updateAIPromptFragment: updateAIPromptFragmentHandler,
  getCurrentSession: getCurrentSessionHandler,
  listEmployees: listEmployeesHandler,
  getEmployee: getEmployeeHandler,
  createEmployee: createEmployeeHandler,
  updateEmployee: updateEmployeeHandler,
  deleteEmployee: deleteEmployeeHandler,
  listResumes: listResumesHandler,
  getResume: getResumeHandler,
  createResume: createResumeHandler,
  updateResume: updateResumeHandler,
  deleteResume: deleteResumeHandler,
  createAssignment: createAssignmentHandler,
  deleteAssignment: deleteAssignmentHandler,
  listEducation: listEducationHandler,
  createEducation: createEducationHandler,
  updateEducation: updateEducationHandler,
  deleteEducation: deleteEducationHandler,
  importCv: importCvHandler,
  parseCvDocx: parseCvDocxHandler,
  exportResumeMarkdown: exportResumeMarkdownHandler,
  exportResumePdf: exportResumePdfHandler,
  exportResumeDocx: exportResumeDocxHandler,
  saveResumeVersion: saveResumeVersionHandler,
  updateResumeBranchSkills: updateResumeBranchSkillsHandler,
  getResumeCommit: getResumeCommitHandler,
  listResumeCommits: listResumeCommitsHandler,
  forkResumeBranch: forkResumeBranchHandler,
  finaliseResumeBranch: finaliseResumeBranchHandler,
  deleteResumeBranch: deleteResumeBranchHandler,
  listResumeBranches: listResumeBranchesHandler,
  getResumeBranchHistoryGraph: getResumeBranchHistoryGraphHandler,
  listBranchAssignments: listBranchAssignmentsHandler,
  listBranchAssignmentsFull: listBranchAssignmentsFullHandler,
  addBranchAssignment: addBranchAssignmentHandler,
  removeBranchAssignment: removeBranchAssignmentHandler,
  updateBranchAssignment: updateBranchAssignmentHandler,
  compareResumeCommits: compareResumeCommitsHandler,
  improveDescription: improveDescriptionHandler,
  createAIConversation: createAIConversationHandler,
  sendAIMessage: sendAIMessageHandler,
  getAIConversation: getAIConversationHandler,
  listAIConversations: listAIConversationsHandler,
  closeAIConversation: closeAIConversationHandler,
  resolveRevisionSuggestion: resolveRevisionSuggestionHandler,
});

/** AppRouter type — re-exported for use in tests and future tooling. */
export type AppRouter = typeof router;
