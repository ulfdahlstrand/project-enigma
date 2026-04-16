import { oc } from "@orpc/contract";
import {
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
} from "../../resume-versions.js";

export const resumeVersionRoutes = {
  saveResumeVersion: oc
    .route({ method: "POST", path: "/resume-branches/{branchId}/commits" })
    .input(saveResumeVersionInputSchema)
    .output(saveResumeVersionOutputSchema),
  updateResumeBranchContent: oc
    .route({ method: "PATCH", path: "/resume-branches/{branchId}/content" })
    .input(updateResumeBranchContentInputSchema)
    .output(updateResumeBranchContentOutputSchema),
  updateResumeBranchSkills: oc
    .route({ method: "PATCH", path: "/resume-branches/{branchId}/skills" })
    .input(updateResumeBranchSkillsInputSchema)
    .output(updateResumeBranchSkillsOutputSchema),
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
  compareResumeCommits: oc
    .route({ method: "POST", path: "/resume-commits/compare" })
    .input(compareResumeCommitsInputSchema)
    .output(compareResumeCommitsOutputSchema),
  createTranslationBranch: oc
    .route({ method: "POST", path: "/resume-branches/{sourceBranchId}/translations" })
    .input(createTranslationBranchInputSchema)
    .output(createTranslationBranchOutputSchema),
  createRevisionBranch: oc
    .route({ method: "POST", path: "/resume-branches/{sourceBranchId}/revisions" })
    .input(createRevisionBranchInputSchema)
    .output(createRevisionBranchOutputSchema),
  mergeRevisionIntoSource: oc
    .route({ method: "POST", path: "/resume-branches/{branchId}/merge" })
    .input(mergeRevisionIntoSourceInputSchema)
    .output(mergeRevisionIntoSourceOutputSchema),
  promoteRevisionToVariant: oc
    .route({ method: "POST", path: "/resume-branches/{branchId}/promote" })
    .input(promoteRevisionToVariantInputSchema)
    .output(promoteRevisionToVariantOutputSchema),
  markTranslationCaughtUp: oc
    .route({ method: "POST", path: "/resume-branches/{branchId}/mark-caught-up" })
    .input(markTranslationCaughtUpInputSchema)
    .output(markTranslationCaughtUpOutputSchema),
  archiveResumeBranch: oc
    .route({ method: "PATCH", path: "/resume-branches/{branchId}/archive" })
    .input(archiveResumeBranchInputSchema)
    .output(archiveResumeBranchOutputSchema),
};
