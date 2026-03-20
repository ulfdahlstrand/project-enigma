import crypto from "node:crypto";

const REFRESH_TOKEN_COOKIE = "cv_refresh_token";
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

/** Generates a cryptographically random refresh token (URL-safe base64). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

/** SHA-256 hash of the raw refresh token — only the hash is stored in the DB. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Computes the refresh token expiry date. */
export function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
  return d;
}

/** Serialises the refresh token as an HttpOnly cookie header value. */
export function buildRefreshCookie(token: string, isProduction: boolean): string {
  const expires = refreshTokenExpiresAt().toUTCString();
  const secure = isProduction ? "; Secure" : "";
  return `${REFRESH_TOKEN_COOKIE}=${token}; HttpOnly${secure}; SameSite=Strict; Path=/; Expires=${expires}`;
}

/** Clears the refresh cookie by setting MaxAge=0. */
export function clearRefreshCookie(isProduction: boolean): string {
  const secure = isProduction ? "; Secure" : "";
  return `${REFRESH_TOKEN_COOKIE}=; HttpOnly${secure}; SameSite=Strict; Path=/; MaxAge=0`;
}

/** Parses a raw Cookie header and returns the refresh token value, if present. */
export function parseRefreshToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, value] = part.trim().split("=");
    if (key?.trim() === REFRESH_TOKEN_COOKIE && value) {
      return decodeURIComponent(value.trim());
    }
  }
  return null;
}
