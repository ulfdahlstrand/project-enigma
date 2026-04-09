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
};
