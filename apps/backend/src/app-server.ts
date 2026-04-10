import { createServer } from "node:http";
import { inspect } from "node:util";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/node";
import { onError } from "@orpc/server";
import { CORSPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { contract } from "@cv-tool/contracts";
import { router } from "./router.js";
import { loginHandler } from "./auth/login-handler.js";
import { testLoginHandler } from "./auth/test-login-handler.js";
import { refreshHandler } from "./auth/refresh-handler.js";
import { logoutHandler } from "./auth/logout-handler.js";
import { resolveAuthContext } from "./auth/resolve-auth-context.js";
import type { User } from "./db/types.js";
import { getDb } from "./db/client.js";
import { logger } from "./infra/logger.js";
import { beginRequestLogging } from "./infra/request-logging.js";
import {
  e2eBootstrapRevisionHandler,
  e2eResetHandler,
  e2eRevisionStateHandler,
  e2eScriptedAIHandler,
} from "./test-helpers/e2e-handlers.js";

export type AppContext = {
  user: User | null;
  externalAI?: {
    tokenId: string;
    authorizationId: string;
    clientId: string;
    clientKey: string;
    clientTitle: string;
    clientDescription: string | null;
    scopes: string[];
  } | null;
};

function isAllowedExternalAIRequest(method: string | undefined, url: string | undefined): boolean {
  return method === "GET" && url === "/external-ai/context";
}

function buildErrorMeta(error: unknown) {
  if (error instanceof Error) {
    const candidate = error as Error & {
      cause?: unknown;
      issues?: unknown;
      code?: unknown;
      status?: unknown;
    };

    return {
      error: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
      ...(candidate.code !== undefined ? { code: candidate.code } : {}),
      ...(candidate.status !== undefined ? { status: candidate.status } : {}),
      ...(candidate.cause !== undefined
        ? { cause: inspect(candidate.cause, { depth: 6, breakLength: 120 }) }
        : {}),
      ...(candidate.issues !== undefined
        ? { issues: inspect(candidate.issues, { depth: 6, breakLength: 120 }) }
        : {}),
      errorType: error.constructor.name,
      errorInspect: inspect(error, { depth: 6, breakLength: 120 }),
    };
  }

  return {
    error: String(error),
    errorType: typeof error,
    errorInspect: inspect(error, { depth: 6, breakLength: 120 }),
  };
}

export async function createAppServer() {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const spec = await generator.generate(contract, {
    info: { title: "cv-tool API", version: "0.0.0" },
  });
  const specJson = JSON.stringify(spec);

  const handler = new OpenAPIHandler(router, {
    plugins: [new CORSPlugin()],
    interceptors: [
      onError((error) => {
        logger.error("Unhandled backend error", buildErrorMeta(error));
      }),
    ],
  });

  const server = createServer(async (req, res) => {
    const requestLogging = beginRequestLogging(req, res);
    await requestLogging.run(async () => {
      const origin = req.headers["origin"] ?? "*";
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Credentials", "true");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === "POST" && req.url === "/auth/login") {
        requestLogging.setOperationName("auth.login");
        await loginHandler(req, res);
        return;
      }
      if (req.method === "POST" && req.url === "/auth/test-login") {
        requestLogging.setOperationName("auth.test-login");
        await testLoginHandler(req, res);
        return;
      }
      if (req.method === "POST" && req.url === "/test/e2e/scripted-ai") {
        requestLogging.setOperationName("test.e2e.scripted-ai");
        await e2eScriptedAIHandler(req, res);
        return;
      }
      if (req.method === "POST" && req.url === "/test/e2e/reset") {
        requestLogging.setOperationName("test.e2e.reset");
        await e2eResetHandler(req, res);
        return;
      }
      if (req.method === "POST" && req.url === "/test/e2e/bootstrap-revision") {
        requestLogging.setOperationName("test.e2e.bootstrap-revision");
        await e2eBootstrapRevisionHandler(req, res);
        return;
      }
      if (req.method === "GET" && req.url?.startsWith("/test/e2e/revision-state")) {
        requestLogging.setOperationName("test.e2e.revision-state");
        await e2eRevisionStateHandler(req, res);
        return;
      }
      if (req.method === "POST" && req.url === "/auth/refresh") {
        requestLogging.setOperationName("auth.refresh");
        await refreshHandler(req, res);
        return;
      }
      if (req.method === "POST" && req.url === "/auth/logout") {
        requestLogging.setOperationName("auth.logout");
        await logoutHandler(req, res);
        return;
      }

      if (req.method === "GET" && req.url === "/openapi.json") {
        requestLogging.setOperationName("openapi.spec");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(specJson);
        return;
      }

      requestLogging.setOperationName(requestLogging.path);
      const authContext = await resolveAuthContext(
        getDb(),
        req.headers["authorization"] ?? "",
        req.headers["cookie"],
      );
      requestLogging.setUserId(authContext.user?.id ?? null);
      if (authContext.externalAI && !isAllowedExternalAIRequest(req.method, req.url)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "External AI token is not allowed for this route" }));
        return;
      }
      let result;
      try {
        result = await handler.handle(req, res, {
          context: {
            user: authContext.user,
            externalAI: authContext.externalAI,
            requestId: requestLogging.requestId,
          },
        });
      } catch (error) {
        logger.error("Backend request handler crashed", {
          requestId: requestLogging.requestId,
          method: req.method ?? "UNKNOWN",
          path: requestLogging.path,
          ...buildErrorMeta(error),
        });
        throw error;
      }

      if (!result.matched) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not Found" }));
      }
    });
  });

  return { server, specJson };
}
