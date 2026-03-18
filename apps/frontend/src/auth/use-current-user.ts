/**
 * useCurrentUser — decodes the stored Google ID token to extract
 * the logged-in user's display name, email, and avatar picture URL.
 *
 * The Google ID token is a standard JWT whose payload is base64url-encoded.
 * No extra network call is needed — the data is embedded in the token.
 * Returns null when the user is not authenticated.
 */
import { useMemo } from "react";
import { useAuth } from "./auth-context";

export type CurrentUser = {
  name: string;
  email: string;
  /** URL of the Google profile picture, or undefined if not present. */
  picture?: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;
    // base64url → base64 → JSON
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function useCurrentUser(): CurrentUser | null {
  const { token } = useAuth();

  return useMemo(() => {
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    if (!payload) return null;
    return {
      name: typeof payload.name === "string" ? payload.name : "User",
      email: typeof payload.email === "string" ? payload.email : "",
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  }, [token]);
}
