/**
 * Module-level token store.
 *
 * The access token lives in React state (AuthContext) but the oRPC client
 * singleton is created outside the React tree. This module bridges the gap:
 * AuthContext writes here whenever the token changes; the oRPC client reads
 * from here on every request.
 *
 * Using a plain mutable variable is intentional — it avoids the complexity of
 * passing the token through every layer while keeping it out of localStorage.
 */

let currentToken: string | null = null;

export function setStoredToken(token: string | null): void {
  currentToken = token;
}

export function getStoredToken(): string | null {
  return currentToken;
}
