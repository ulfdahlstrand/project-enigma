import { OAuth2Client, type LoginTicket } from "google-auth-library";

export type AuthUser = {
  sub: string;
  email: string;
  name: string;
};

/** Injected verify function — swap out in tests without touching OAuth2Client. */
export type VerifyFn = (token: string) => Promise<LoginTicket>;

/**
 * Verifies a Google ID token and returns the extracted user, or null if invalid.
 *
 * @param token  - The raw ID token from the Authorization header.
 * @param verify - The verification function (defaults to OAuth2Client.verifyIdToken).
 */
export async function verifyGoogleToken(
  token: string,
  verify: VerifyFn = defaultVerifyFn,
): Promise<AuthUser | null> {
  try {
    const ticket = await verify(token);
    const payload = ticket.getPayload();

    if (!payload?.sub) return null;

    return {
      sub: payload.sub,
      email: payload.email ?? "",
      name: payload.name ?? "",
    };
  } catch {
    return null;
  }
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const defaultVerifyFn: VerifyFn = (token) =>
  client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
