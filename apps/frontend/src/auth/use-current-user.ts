/**
 * useCurrentUser — exposes the authenticated user from AuthContext.
 *
 * The backend session bootstrap endpoint is now the source of truth for the
 * visible user identity, so the UI no longer needs to decode JWT payloads.
 */
import { useAuth } from "./auth-context";

export type CurrentUser = {
  name: string;
  email: string;
  picture?: string;
};

export function useCurrentUser(): CurrentUser | null {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return {
    name: user.name,
    email: user.email,
  };
}
