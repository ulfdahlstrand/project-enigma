import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { contract, type AppRouter } from "@cv-tool/contracts";

export function createIntegrationOrpcClient(baseUrl: string, authHeader: string) {
  const link = new OpenAPILink(contract, {
    url: baseUrl,
    fetch: async (request, init) => {
      const requestInit = init as RequestInit | undefined;
      const headers = new Headers(request.headers);

      if (requestInit?.headers) {
        new Headers(requestInit.headers).forEach((value, key) => {
          headers.set(key, value);
        });
      }

      headers.set("Authorization", authHeader);

      return globalThis.fetch(new Request(request, {
        ...requestInit,
        headers,
      }));
    },
  });

  return createORPCClient<ContractRouterClient<AppRouter>>(link);
}
