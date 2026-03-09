import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import { healthHandler } from "./procedures/health.js";
import { listTestEntriesHandler } from "./procedures/list-test-entries.js";
import { listEmployeesHandler } from "./procedures/list-employees.js";
import { getEmployeeHandler } from "./procedures/get-employee.js";
import { createEmployeeHandler } from "./procedures/create-employee.js";
import { updateEmployeeHandler } from "./procedures/update-employee.js";

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
});

/** AppRouter type — re-exported for use in tests and future tooling. */
export type AppRouter = typeof router;
