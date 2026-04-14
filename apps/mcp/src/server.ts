import type { IncomingMessage } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { ExternalAIMcpClient, buildExternalAIMcpServer } from "./adapter.js";
import {
  buildOAuthMetadata,
  buildProtectedResourceMetadata,
  buildOpenIdConfiguration,
  resolveClientKeyFromRegistration,
  decodeAuthCode,
  verifyPkce,
} from "./oauth.js";

// ---------------------------------------------------------------------------
// Config helpers — public URL is read from env at startup, with per-request
// override via X-Forwarded-Proto / X-Forwarded-Host headers for reverse-proxy
// setups (ngrok, etc.).
// ---------------------------------------------------------------------------

function resolveBaseUrl() {
  return (process.env["EXTERNAL_AI_MCP_BASE_URL"] ?? "http://localhost:3001").replace(/\/+$/, "");
}

function resolvePublicUrl() {
  const port = process.env["EXTERNAL_AI_MCP_PORT"] ?? "8787";
  const host = process.env["EXTERNAL_AI_MCP_HOST"] ?? "127.0.0.1";
  return (process.env["EXTERNAL_AI_MCP_PUBLIC_URL"] ?? `http://${host}:${port}`).replace(/\/+$/, "");
}

/**
 * Derive the public base URL from the incoming request headers.
 * When the server is behind a reverse proxy (e.g. ngrok), the
 * X-Forwarded-Proto and X-Forwarded-Host headers carry the real
 * public origin. Falls back to the configured publicUrl.
 */
function resolvePublicUrlFromRequest(req: IncomingMessage, fallback: string): string {
  const proto = Array.isArray(req.headers["x-forwarded-proto"])
    ? req.headers["x-forwarded-proto"][0]
    : req.headers["x-forwarded-proto"];
  const forwardedHost = Array.isArray(req.headers["x-forwarded-host"])
    ? req.headers["x-forwarded-host"][0]
    : req.headers["x-forwarded-host"];
  const host = forwardedHost ?? req.headers["host"];

  if (proto && host) {
    return `${proto}://${host}`;
  }

  return fallback;
}

function resolveAppUrl() {
  return (process.env["EXTERNAL_AI_MCP_APP_URL"] ?? "http://localhost:5173").replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Body helpers
// ---------------------------------------------------------------------------

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readRawBody(req);
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Backend API helpers
// ---------------------------------------------------------------------------

async function callApi<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let payload: unknown = null;

  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Non-JSON response — surface raw text as error message downstream
    }
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as Record<string, unknown>)["message"])
        : text || `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return payload as T;
}

type ChallengeExchangeResult = {
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  scopes: string[];
};

type RefreshResult = {
  accessToken: string;
  expiresAt: string;
  scopes: string[];
};

async function exchangeChallenge(
  baseUrl: string,
  challengeId: string,
  challengeCode: string,
): Promise<ChallengeExchangeResult> {
  return callApi<ChallengeExchangeResult>("POST", `${baseUrl}/auth/external-ai/token`, {
    challengeId,
    challengeCode,
  });
}

async function doRefreshToken(baseUrl: string, refreshToken: string): Promise<RefreshResult> {
  return callApi<RefreshResult>("POST", `${baseUrl}/auth/external-ai/token/refresh`, { refreshToken });
}

function expiresIn(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const port = Number(process.env["EXTERNAL_AI_MCP_PORT"] ?? 8787);
  const host = process.env["EXTERNAL_AI_MCP_HOST"] ?? "127.0.0.1";
  const baseUrl = resolveBaseUrl();
  const publicUrl = resolvePublicUrl();
  const appUrl = resolveAppUrl();

  const app = createMcpExpressApp({ host });

  // -------------------------------------------------------------------------
  // OAuth 2.0 Protected Resource Metadata — RFC 9728
  // -------------------------------------------------------------------------
  app.get("/.well-known/oauth-protected-resource", (req, res) => {
    res.json(buildProtectedResourceMetadata(resolvePublicUrlFromRequest(req, publicUrl)));
  });

  // -------------------------------------------------------------------------
  // OAuth 2.0 Authorization Server Metadata — RFC 8414
  // -------------------------------------------------------------------------
  app.get("/.well-known/oauth-authorization-server", (req, res) => {
    res.json(buildOAuthMetadata(resolvePublicUrlFromRequest(req, publicUrl), appUrl));
  });

  // -------------------------------------------------------------------------
  // OpenID Connect Discovery 1.0 — fallback checked by some clients
  // -------------------------------------------------------------------------
  app.get("/.well-known/openid-configuration", (req, res) => {
    res.json(buildOpenIdConfiguration(resolvePublicUrlFromRequest(req, publicUrl), appUrl));
  });

  // -------------------------------------------------------------------------
  // Dynamic Client Registration — RFC 7591
  // -------------------------------------------------------------------------
  app.post("/register", async (req, res) => {
    const body = await readJsonBody(req);
    const clientId = resolveClientKeyFromRegistration(body);
    const now = Math.floor(Date.now() / 1000);

    res.status(201).json({
      client_id: clientId,
      client_id_issued_at: now,
      client_name: body["client_name"] ?? clientId,
      redirect_uris: body["redirect_uris"] ?? [],
      grant_types: body["grant_types"] ?? ["authorization_code"],
      response_types: body["response_types"] ?? ["code"],
      token_endpoint_auth_method: "none",
      application_type: body["application_type"] ?? "native",
    });
  });

  // -------------------------------------------------------------------------
  // OAuth 2.0 Token Endpoint
  // -------------------------------------------------------------------------
  app.post("/oauth/token", async (req, res) => {
    let params: URLSearchParams;

    try {
      const raw = await readRawBody(req);
      const contentType = String(req.headers["content-type"] ?? "");

      if (contentType.includes("application/json")) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        params = new URLSearchParams(Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)])));
      } else {
        params = new URLSearchParams(raw);
      }
    } catch {
      res.status(400).json({ error: "invalid_request", error_description: "Unreadable request body" });
      return;
    }

    const grantType = params.get("grant_type");

    try {
      if (grantType === "authorization_code") {
        const code = params.get("code");
        const codeVerifier = params.get("code_verifier");
        const redirectUri = params.get("redirect_uri");

        if (!code || !codeVerifier || !redirectUri) {
          res.status(400).json({
            error: "invalid_request",
            error_description: "Missing required parameters: code, code_verifier, redirect_uri",
          });
          return;
        }

        const payload = decodeAuthCode(code);

        if (!payload) {
          res.status(400).json({ error: "invalid_grant", error_description: "Invalid authorization code" });
          return;
        }

        if (Math.floor(Date.now() / 1000) > payload.exp) {
          res.status(400).json({ error: "invalid_grant", error_description: "Authorization code expired" });
          return;
        }

        if (payload.ru !== redirectUri) {
          res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch" });
          return;
        }

        if (!verifyPkce(codeVerifier, payload.cc, payload.cm)) {
          res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
          return;
        }

        const tokens = await exchangeChallenge(baseUrl, payload.id, payload.code);

        res.json({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: "Bearer",
          expires_in: expiresIn(tokens.expiresAt),
          scope: tokens.scopes.join(" "),
        });
      } else if (grantType === "refresh_token") {
        const refreshToken = params.get("refresh_token");

        if (!refreshToken) {
          res.status(400).json({ error: "invalid_request", error_description: "Missing refresh_token" });
          return;
        }

        const tokens = await doRefreshToken(baseUrl, refreshToken);

        res.json({
          access_token: tokens.accessToken,
          token_type: "Bearer",
          expires_in: expiresIn(tokens.expiresAt),
          scope: tokens.scopes.join(" "),
        });
      } else {
        res.status(400).json({ error: "unsupported_grant_type" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: "invalid_grant", error_description: message });
    }
  });

  // -------------------------------------------------------------------------
  // MCP endpoint — requires Bearer token via OAuth2
  // -------------------------------------------------------------------------
  app.post("/mcp", async (req, res) => {
    const authHeader = (req.headers["authorization"] ?? "") as string;
    let accessToken: string | null = null;

    if (authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.slice(7).trim() || null;
    }

    if (!accessToken) {
      const reqPublicUrl = resolvePublicUrlFromRequest(req, publicUrl);
      res
        .status(401)
        .header(
          "WWW-Authenticate",
          `Bearer realm="Project Enigma MCP", resource_metadata="${reqPublicUrl}/.well-known/oauth-protected-resource"`,
        )
        .json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unauthorized — obtain a Bearer token via OAuth2" },
          id: null,
        });
      return;
    }

    const client = new ExternalAIMcpClient({ baseUrl, accessToken });
    const server = await buildExternalAIMcpServer(client);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error handling remote MCP request", error);

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }

    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  });

  for (const method of ["get", "delete"] as const) {
    app[method]("/mcp", (_req, res) => {
      res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    });
  }

  app.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`Project Enigma MCP server listening on http://${host}:${port}/mcp`);
    // eslint-disable-next-line no-console
    console.log(`OAuth2 protected resource: ${publicUrl}/.well-known/oauth-protected-resource`);
    // eslint-disable-next-line no-console
    console.log(`OAuth2 AS metadata:        ${publicUrl}/.well-known/oauth-authorization-server`);
    // eslint-disable-next-line no-console
    console.log(`OAuth2 authorize:          ${appUrl}/oauth/authorize`);
  });
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(message);
  process.exitCode = 1;
});
