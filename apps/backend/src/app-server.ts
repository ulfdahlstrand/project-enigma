import { createServer } from "node:http";
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
import { resolveUser } from "./auth/resolve-user.js";
import type { User } from "./db/types.js";
import { getDb } from "./db/client.js";
import { logger } from "./infra/logger.js";

export type AppContext = { user: User | null };

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
        logger.error("Unhandled backend error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }),
    ],
  });

  const server = createServer(async (req, res) => {
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
      await loginHandler(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/auth/test-login") {
      await testLoginHandler(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/auth/refresh") {
      await refreshHandler(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/auth/logout") {
      await logoutHandler(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/openapi.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(specJson);
      return;
    }

    const user = await resolveUser(getDb(), req.headers["authorization"] ?? "", req.headers["cookie"]);
    const result = await handler.handle(req, res, { context: { user } });

    if (!result.matched) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Not Found" }));
    }
  });

  return { server, specJson };
}
