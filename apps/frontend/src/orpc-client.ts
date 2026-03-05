/**
 * oRPC client singleton.
 *
 * Typed against the AppRouter type exported from @cv-tool/contracts so that
 * every procedure call is fully type-safe — input validation, output inference,
 * and IDE autocomplete all work without a separate codegen step.
 *
 * Integration pattern: exported singleton.
 * Components import `orpc` directly from this module. An alternative would be
 * to expose this via React context; the singleton pattern was chosen for
 * simplicity. Future tasks may wrap this in a context if injection is needed
 * for testing.
 *
 * The backend API base URL is read exclusively from the VITE_API_URL
 * environment variable. No URL is hardcoded. If VITE_API_URL is unset,
 * the client is created with an empty base URL — API calls will fail with a
 * network error, but the application will not crash on startup.
 */
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouter } from "@cv-tool/contracts";

const apiUrl: string = import.meta.env["VITE_API_URL"] ?? "";

const link = new RPCLink({
  url: apiUrl,
});

export const orpc = createORPCClient<AppRouter>(link);
