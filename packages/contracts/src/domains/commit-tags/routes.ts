import { oc } from "@orpc/contract";
import {
  listCommitTagsInputSchema,
  listCommitTagsOutputSchema,
  createCommitTagInputSchema,
  createCommitTagOutputSchema,
  deleteCommitTagInputSchema,
  deleteCommitTagOutputSchema,
  getTranslationStatusInputSchema,
  getTranslationStatusOutputSchema,
} from "../../commit-tags.js";

export const commitTagRoutes = {
  listCommitTags: oc
    .route({ method: "GET", path: "/resumes/{resumeId}/commit-tags" })
    .input(listCommitTagsInputSchema)
    .output(listCommitTagsOutputSchema),

  createCommitTag: oc
    .route({ method: "POST", path: "/commit-tags" })
    .input(createCommitTagInputSchema)
    .output(createCommitTagOutputSchema),

  deleteCommitTag: oc
    .route({ method: "DELETE", path: "/commit-tags/{id}" })
    .input(deleteCommitTagInputSchema)
    .output(deleteCommitTagOutputSchema),

  getTranslationStatus: oc
    .route({ method: "GET", path: "/resumes/{resumeId}/translation-status/{targetResumeId}" })
    .input(getTranslationStatusInputSchema)
    .output(getTranslationStatusOutputSchema),
};
