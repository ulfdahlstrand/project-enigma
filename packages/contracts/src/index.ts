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
  deleteResumeSkillInputSchema,
  deleteResumeSkillOutputSchema,
} from "./resumes.js";
import {
  listAssignmentsInputSchema,
  listAssignmentsOutputSchema,
  getAssignmentInputSchema,
  getAssignmentOutputSchema,
  createAssignmentInputSchema,
  createAssignmentOutputSchema,
  updateAssignmentInputSchema,
  updateAssignmentOutputSchema,
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
  listResumeBranchesInputSchema,
  listResumeBranchesOutputSchema,
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
} from "./branch-assignments.js";

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
//
// These schemas back the `listTestEntries` procedure, which queries the
// `test_entries` table created by the initial migration. They exist solely
// to validate the full end-to-end stack (database → oRPC → TanStack Query →
// React route) and carry no CV-specific business logic.
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
// Employee schemas — re-exported from ./employees
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
} from "./employees.js";
export type { Employee } from "./employees.js";

// ---------------------------------------------------------------------------
// Resume schemas — re-exported from ./resumes
// ---------------------------------------------------------------------------

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
  deleteResumeSkillInputSchema,
  deleteResumeSkillOutputSchema,
} from "./resumes.js";
export type { ResumeSkill, Resume, ResumeWithSkills } from "./resumes.js";

// ---------------------------------------------------------------------------
// Assignment schemas — re-exported from ./assignments
// ---------------------------------------------------------------------------

export {
  assignmentSchema,
  listAssignmentsInputSchema,
  listAssignmentsOutputSchema,
  getAssignmentInputSchema,
  getAssignmentOutputSchema,
  createAssignmentInputSchema,
  createAssignmentOutputSchema,
  updateAssignmentInputSchema,
  updateAssignmentOutputSchema,
  deleteAssignmentInputSchema,
  deleteAssignmentOutputSchema,
} from "./assignments.js";
export type { Assignment } from "./assignments.js";

// ---------------------------------------------------------------------------
// Education schemas — re-exported from ./education
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// CV import schemas — re-exported from ./import-cv
// ---------------------------------------------------------------------------

export {
  cvJsonSchema,
  importCvInputSchema,
  importCvOutputSchema,
} from "./import-cv.js";
export type { CvJson } from "./import-cv.js";

// ---------------------------------------------------------------------------
// Export schemas — re-exported from ./export-resume
// ---------------------------------------------------------------------------

export {
  exportResumeMarkdownInputSchema,
  exportResumeMarkdownOutputSchema,
  exportResumePdfInputSchema,
  exportResumePdfOutputSchema,
  exportResumeDocxInputSchema,
  exportResumeDocxOutputSchema,
} from "./export-resume.js";

// ---------------------------------------------------------------------------
// Resume versioning schemas — re-exported from ./resume-versions
// ---------------------------------------------------------------------------

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
  listResumeBranchesInputSchema,
  listResumeBranchesOutputSchema,
} from "./resume-versions.js";
export type {
  ResumeCommitContent,
  ResumeCommit,
  ResumeCommitSummary,
  ResumeBranch,
  BranchAssignment,
} from "./resume-versions.js";

// ---------------------------------------------------------------------------
// Branch assignment schemas — re-exported from ./branch-assignments
// ---------------------------------------------------------------------------

export {
  branchAssignmentItemSchema,
  listBranchAssignmentsInputSchema,
  listBranchAssignmentsOutputSchema,
  addBranchAssignmentInputSchema,
  addBranchAssignmentOutputSchema,
  removeBranchAssignmentInputSchema,
  removeBranchAssignmentOutputSchema,
  updateBranchAssignmentInputSchema,
  updateBranchAssignmentOutputSchema,
} from "./branch-assignments.js";
export type { BranchAssignmentItem } from "./branch-assignments.js";

// ---------------------------------------------------------------------------
// Router contract
//
// Defines the shape of every procedure (input + output schemas) without any
// implementation. The backend imports this contract and attaches handlers;
// the frontend imports the inferred AppRouter type for a fully-typed client.
// ---------------------------------------------------------------------------

export const contract = oc.router({
  health: oc.input(healthInputSchema).output(healthOutputSchema),
  listTestEntries: oc
    .input(listTestEntriesInputSchema)
    .output(listTestEntriesOutputSchema),
  listEmployees: oc
    .input(z.object({}))
    .output(listEmployeesOutputSchema),
  getEmployee: oc
    .input(getEmployeeInputSchema)
    .output(getEmployeeOutputSchema),
  createEmployee: oc
    .input(createEmployeeInputSchema)
    .output(createEmployeeOutputSchema),
  updateEmployee: oc
    .input(updateEmployeeInputSchema)
    .output(updateEmployeeOutputSchema),
  listResumes: oc.input(listResumesInputSchema).output(listResumesOutputSchema),
  getResume: oc.input(getResumeInputSchema).output(getResumeOutputSchema),
  createResume: oc.input(createResumeInputSchema).output(createResumeOutputSchema),
  updateResume: oc.input(updateResumeInputSchema).output(updateResumeOutputSchema),
  deleteResume: oc.input(deleteResumeInputSchema).output(deleteResumeOutputSchema),
  createResumeSkill: oc.input(createResumeSkillInputSchema).output(createResumeSkillOutputSchema),
  deleteResumeSkill: oc.input(deleteResumeSkillInputSchema).output(deleteResumeSkillOutputSchema),
  listAssignments: oc.input(listAssignmentsInputSchema).output(listAssignmentsOutputSchema),
  getAssignment: oc.input(getAssignmentInputSchema).output(getAssignmentOutputSchema),
  createAssignment: oc.input(createAssignmentInputSchema).output(createAssignmentOutputSchema),
  updateAssignment: oc.input(updateAssignmentInputSchema).output(updateAssignmentOutputSchema),
  deleteAssignment: oc.input(deleteAssignmentInputSchema).output(deleteAssignmentOutputSchema),
  listEducation: oc.input(listEducationInputSchema).output(listEducationOutputSchema),
  createEducation: oc.input(createEducationInputSchema).output(createEducationOutputSchema),
  deleteEducation: oc.input(deleteEducationInputSchema).output(deleteEducationOutputSchema),
  importCv: oc.input(importCvInputSchema).output(importCvOutputSchema),
  exportResumeMarkdown: oc
    .input(exportResumeMarkdownInputSchema)
    .output(exportResumeMarkdownOutputSchema),
  exportResumePdf: oc
    .input(exportResumePdfInputSchema)
    .output(exportResumePdfOutputSchema),
  exportResumeDocx: oc
    .input(exportResumeDocxInputSchema)
    .output(exportResumeDocxOutputSchema),
  saveResumeVersion: oc
    .input(saveResumeVersionInputSchema)
    .output(saveResumeVersionOutputSchema),
  getResumeCommit: oc
    .input(getResumeCommitInputSchema)
    .output(getResumeCommitOutputSchema),
  listResumeCommits: oc
    .input(listResumeCommitsInputSchema)
    .output(listResumeCommitsOutputSchema),
  forkResumeBranch: oc
    .input(forkResumeBranchInputSchema)
    .output(forkResumeBranchOutputSchema),
  listResumeBranches: oc
    .input(listResumeBranchesInputSchema)
    .output(listResumeBranchesOutputSchema),
  listBranchAssignments: oc
    .input(listBranchAssignmentsInputSchema)
    .output(listBranchAssignmentsOutputSchema),
  addBranchAssignment: oc
    .input(addBranchAssignmentInputSchema)
    .output(addBranchAssignmentOutputSchema),
  removeBranchAssignment: oc
    .input(removeBranchAssignmentInputSchema)
    .output(removeBranchAssignmentOutputSchema),
  updateBranchAssignment: oc
    .input(updateBranchAssignmentInputSchema)
    .output(updateBranchAssignmentOutputSchema),
});

/** Inferred contract type — used by the frontend to create a typed oRPC client. */
export type AppRouter = typeof contract;
