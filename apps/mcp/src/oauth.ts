import crypto from "node:crypto";

const SUPPORTED_SCOPES = [
  "ai:context:read",
  "resume:read",
  "resume-branch:read",
  "resume-branch:write",
  "resume-commit:read",
  "resume-commit:write",
  "branch-assignment:read",
  "branch-assignment:write",
  "branch-skill:write",
  "education:read",
  "education:write",
];

export interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
}

/** OAuth 2.0 Authorization Server Metadata (RFC 8414). */
export function buildOAuthMetadata(publicMcpUrl: string, appUrl: string): OAuthMetadata {
  const base = publicMcpUrl.replace(/\/+$/, "");
  const app = appUrl.replace(/\/+$/, "");

  return {
    issuer: base,
    authorization_endpoint: `${app}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/register`,
    scopes_supported: SUPPORTED_SCOPES,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

/** OAuth 2.0 Protected Resource Metadata (RFC 9728). */
export function buildProtectedResourceMetadata(publicMcpUrl: string): Record<string, unknown> {
  const base = publicMcpUrl.replace(/\/+$/, "");

  return {
    resource: base,
    authorization_servers: [base],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ["header"],
  };
}

/**
 * OpenID Connect Discovery 1.0 metadata.
 * Claude Code checks this endpoint as a fallback.
 * We serve the same fields as the AS metadata plus minimal OIDC additions.
 */
export function buildOpenIdConfiguration(publicMcpUrl: string, appUrl: string): Record<string, unknown> {
  const base = publicMcpUrl.replace(/\/+$/, "");

  return {
    ...buildOAuthMetadata(publicMcpUrl, appUrl),
    // Minimal OIDC fields that satisfy code_challenge_methods_supported requirement
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
  };
}

/**
 * Map a dynamic registration request to a known external AI client key.
 * Inspects client_name / client_uri to pick the best match.
 * Falls back to "anthropic_claude" since that is the primary MCP client.
 */
export function resolveClientKeyFromRegistration(body: Record<string, unknown>): string {
  const name = String(body["client_name"] ?? body["client_uri"] ?? "").toLowerCase();

  if (name.includes("openai") || name.includes("chatgpt") || name.includes("gpt")) {
    return "openai_chatgpt";
  }

  // Claude Code / Anthropic — default for all unrecognised clients
  return "anthropic_claude";
}

export interface AuthCodePayload {
  /** challengeId */
  id: string;
  /** challengeCode */
  code: string;
  /** PKCE code_challenge */
  cc: string;
  /** PKCE code_challenge_method */
  cm: string;
  /** redirect_uri (validated on token exchange) */
  ru: string;
  /** expiry — Unix timestamp in seconds (code is valid for 60 s) */
  exp: number;
}

function encodeAuthCode(payload: AuthCodePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeAuthCode(encoded: string): AuthCodePayload | null {
  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as unknown;

    const p = parsed as Record<string, unknown>;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof p["id"] !== "string" ||
      typeof p["code"] !== "string" ||
      typeof p["cc"] !== "string" ||
      typeof p["cm"] !== "string" ||
      typeof p["ru"] !== "string" ||
      typeof p["exp"] !== "number"
    ) {
      return null;
    }

    return parsed as AuthCodePayload;
  } catch {
    return null;
  }
}

export function verifyPkce(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method !== "S256") {
    return false;
  }

  const computed = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(codeChallenge));
  } catch {
    return false;
  }
}
