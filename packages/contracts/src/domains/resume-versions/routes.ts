import { oc } from "@orpc/contract";
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
} from "../../resume-versions.js";

export const resumeVersionRoutes = {
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
  compareResumeCommits: oc
    .route({ method: "POST", path: "/resume-commits/compare" })
    .input(compareResumeCommitsInputSchema)
    .output(compareResumeCommitsOutputSchema),
};
