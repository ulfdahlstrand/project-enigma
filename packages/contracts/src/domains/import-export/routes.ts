import { oc } from "@orpc/contract";
import {
  importCvInputSchema,
  importCvOutputSchema,
  parseCvDocxInputSchema,
  parseCvDocxOutputSchema,
} from "../../import-cv.js";
import {
  exportResumeMarkdownInputSchema,
  exportResumeMarkdownOutputSchema,
  exportResumePdfInputSchema,
  exportResumePdfOutputSchema,
  exportResumeDocxInputSchema,
  exportResumeDocxOutputSchema,
} from "../../export-resume.js";

export const importExportRoutes = {
  importCv: oc
    .route({ method: "POST", path: "/employees/{employeeId}/resumes/import" })
    .input(importCvInputSchema)
    .output(importCvOutputSchema),
  parseCvDocx: oc
    .route({ method: "POST", path: "/resume/import/docx" })
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
};
