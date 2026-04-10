import crypto from "node:crypto";

export const EXTERNAL_AI_CONTEXT_SCOPE = "ai:context:read";
export const DEFAULT_EXTERNAL_AI_SCOPES = [EXTERNAL_AI_CONTEXT_SCOPE] as const;
export const EXTERNAL_AI_CHALLENGE_TTL_MINUTES = 10;
export const EXTERNAL_AI_ACCESS_TOKEN_TTL_HOURS = 8;
export const EXTERNAL_AI_AUTHORIZATION_TTL_DAYS = 30;

export function generateExternalAIChallengeCode(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export function generateExternalAIAccessToken(): string {
  return `eai_${crypto.randomBytes(36).toString("base64url")}`;
}

export function hashExternalAISecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function externalAIChallengeExpiresAt(): Date {
  return new Date(Date.now() + EXTERNAL_AI_CHALLENGE_TTL_MINUTES * 60 * 1000);
}

export function externalAIAccessTokenExpiresAt(): Date {
  return new Date(Date.now() + EXTERNAL_AI_ACCESS_TOKEN_TTL_HOURS * 60 * 60 * 1000);
}

export function externalAIAuthorizationExpiresAt(): Date {
  return new Date(Date.now() + EXTERNAL_AI_AUTHORIZATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}
