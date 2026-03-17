import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import { healthHandler } from "./procedures/health.js";
import { listTestEntriesHandler } from "./procedures/list-test-entries.js";
import { listEmployeesHandler } from "./procedures/list-employees.js";
import { getEmployeeHandler } from "./procedures/get-employee.js";
import { createEmployeeHandler } from "./procedures/create-employee.js";
import { updateEmployeeHandler } from "./procedures/update-employee.js";
import { listResumesHandler } from "./procedures/list-resumes.js";
import { getResumeHandler } from "./procedures/get-resume.js";
import { createResumeHandler } from "./procedures/create-resume.js";
import { updateResumeHandler } from "./procedures/update-resume.js";
import { deleteResumeHandler } from "./procedures/delete-resume.js";
import { listAssignmentsHandler } from "./procedures/list-assignments.js";
import { getAssignmentHandler } from "./procedures/get-assignment.js";
import { createAssignmentHandler } from "./procedures/create-assignment.js";
import { updateAssignmentHandler } from "./procedures/update-assignment.js";
import { deleteAssignmentHandler } from "./procedures/delete-assignment.js";
import { listEducationHandler } from "./procedures/list-education.js";
import { createEducationHandler } from "./procedures/create-education.js";
import { deleteEducationHandler } from "./procedures/delete-education.js";
import { importCvHandler } from "./procedures/import-cv.js";

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
  listTestEntries: listTestEntriesHandler,
  listEmployees: listEmployeesHandler,
  getEmployee: getEmployeeHandler,
  createEmployee: createEmployeeHandler,
  updateEmployee: updateEmployeeHandler,
  listResumes: listResumesHandler,
  getResume: getResumeHandler,
  createResume: createResumeHandler,
  updateResume: updateResumeHandler,
  deleteResume: deleteResumeHandler,
  listAssignments: listAssignmentsHandler,
  getAssignment: getAssignmentHandler,
  createAssignment: createAssignmentHandler,
  updateAssignment: updateAssignmentHandler,
  deleteAssignment: deleteAssignmentHandler,
  listEducation: listEducationHandler,
  createEducation: createEducationHandler,
  deleteEducation: deleteEducationHandler,
  importCv: importCvHandler,
});

/** AppRouter type — re-exported for use in tests and future tooling. */
export type AppRouter = typeof router;
