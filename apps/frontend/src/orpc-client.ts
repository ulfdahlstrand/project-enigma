/**
 * oRPC client singleton.
 *
 * Typed against the AppRouter type exported from @cv-tool/contracts so that
 * every procedure call is fully type-safe — input validation, output inference,
 * and IDE autocomplete all work without a separate codegen step.
 *
 * Transport: OpenAPILink — communicates with the backend via its OpenAPI-compatible
 * HTTP endpoint (exposed via OpenAPIHandler). The OpenAPILink derives HTTP method
 * and path from the contract definition, rather than using the plain RPC protocol.
 *
 * The backend API base URL is read exclusively from the VITE_API_URL environment
 * variable. No URL is hardcoded. If VITE_API_URL is unset, the client is created
 * with an empty base URL — API calls will fail with a network error, but the
 * application will not crash on startup.
 *
 * Auth: requests rely on the backend-managed HttpOnly cookie session.
 * The client always includes credentials and clears the frontend session
 * snapshot on 401 so route guards can react consistently.
 */
import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { contract, type AppRouter } from "@cv-tool/contracts";
import { clearAuthSession } from "./auth/session-store";

const rawApiUrl: string = import.meta.env["VITE_API_URL"] ?? "";
const apiUrl =
  typeof window !== "undefined" && rawApiUrl.startsWith("/")
    ? new URL(rawApiUrl, window.location.origin).toString()
    : rawApiUrl;

async function fetchWithAuth(request: Request, init?: RequestInit): Promise<Response> {
  const res = await globalThis.fetch(new Request(request, {
    ...init,
    credentials: "include",
  }));

  if (res.status === 401) {
    clearAuthSession();
  }

  return res;
}

const link = new OpenAPILink(contract, {
  url: apiUrl,
  fetch: fetchWithAuth,
});

export const orpc = createORPCClient<ContractRouterClient<AppRouter>>(link);
