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
 * Auth: the access token is read from the module-level token store (set by
 * AuthContext). On a 401 response the client attempts a silent refresh once
 * before propagating the error.
 */
import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { contract, type AppRouter } from "@cv-tool/contracts";
import { getStoredToken, setStoredToken } from "./auth/token-store";

const apiUrl: string = import.meta.env["VITE_API_URL"] ?? "";

async function fetchWithAuth(request: Request, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(request.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await globalThis.fetch(new Request(request, { headers, ...init }));

  // On 401: attempt one silent refresh then retry
  if (res.status === 401) {
    const refreshRes = await globalThis.fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshRes.ok) {
      const data = (await refreshRes.json()) as { accessToken: string };
      setStoredToken(data.accessToken);
      const retryHeaders = new Headers(request.headers);
      retryHeaders.set("Authorization", `Bearer ${data.accessToken}`);
      return globalThis.fetch(new Request(request, { headers: retryHeaders, ...init }));
    }
    // Refresh failed — clear token so UI reflects logged-out state
    setStoredToken(null);
  }

  return res;
}

const link = new OpenAPILink(contract, {
  url: apiUrl,
  fetch: fetchWithAuth,
});

export const orpc = createORPCClient<ContractRouterClient<AppRouter>>(link);
