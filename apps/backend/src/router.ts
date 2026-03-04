import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import { healthHandler } from "./procedures/health.js";

/**
 * The oRPC router — implements every procedure defined in the @cv-tool/contracts
 * package. Adding a new procedure requires: (1) adding it to the contract, and
 * (2) adding its handler here.
 */
export const router = implement(contract).router({
  health: healthHandler,
});

/** AppRouter type — re-exported for use in tests and future tooling. */
export type AppRouter = typeof router;
