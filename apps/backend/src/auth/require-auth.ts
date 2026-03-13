import { ORPCError } from "@orpc/server";
import type { User } from "../db/types.js";

export type AuthContext = { user: User | null };

/**
 * Asserts that the request context contains an authenticated user.
 * Throws an UNAUTHORIZED ORPCError (HTTP 401) if not.
 *
 * Usage inside an oRPC handler:
 *   const user = requireAuth(context);
 */
export function requireAuth(context: AuthContext): User {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return context.user;
}
