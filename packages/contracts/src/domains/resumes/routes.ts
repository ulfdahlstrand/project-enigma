import { oc } from "@orpc/contract";
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
} from "../../resumes.js";

export const resumeRoutes = {
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
    .route({ method: "POST", path: "/resumes/{resumeId}/skills" })
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
};
