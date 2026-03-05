import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import { queryTestEntries } from "../db/test-entries.js";

/**
 * Implements the `listTestEntries` procedure defined in @cv-tool/contracts.
 *
 * Queries all rows from the `test_entries` table and returns them as a typed
 * array. This procedure exists solely to validate end-to-end stack connectivity
 * and carries no CV-specific business logic.
 */
export const listTestEntriesHandler = implement(
  contract.listTestEntries
).handler(async () => {
  const entries = await queryTestEntries();
  return { entries };
});
