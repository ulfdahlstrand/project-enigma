import { createServer } from "node:http";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/node";
import { onError } from "@orpc/server";
import { CORSPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { contract } from "@cv-tool/contracts";
import { router } from "./router.js";
import { verifyGoogleToken, type AuthUser } from "./auth/verify-google-token.js";
import { upsertUser } from "./auth/upsert-user.js";
import type { User } from "./db/types.js";

export type AppContext = { user: User | null };

const port = Number(process.env["BACKEND_PORT"] ?? 3001);

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
      console.error("[backend] unhandled error:", error);
    }),
  ],
});

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/openapi.json") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(specJson);
    return;
  }

  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const googleUser: AuthUser | null = token ? await verifyGoogleToken(token) : null;
  const user: User | null = googleUser ? await upsertUser(googleUser).catch(() => null) : null;

  const result = await handler.handle(req, res, { context: { user } });

  if (!result.matched) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not Found" }));
  }
});

server.listen(port, () => {
  console.log(`[backend] Server listening on port ${port}`);
  console.log(`[backend] OpenAPI spec at http://localhost:${port}/openapi.json`);
});
