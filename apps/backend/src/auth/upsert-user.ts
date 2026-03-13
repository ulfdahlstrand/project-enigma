import type { Kysely } from "kysely";
import { getDb } from "../db/client.js";
import type { AuthUser } from "./verify-google-token.js";
import type { Database, User } from "../db/types.js";

/**
 * Inserts a new user row on first login, or does nothing if the user already
 * exists (identified by google_sub). Always returns the persisted user row.
 *
 * Uses INSERT ... ON CONFLICT (google_sub) DO NOTHING so the operation is
 * idempotent and safe to call on every authenticated request.
 */
export async function upsertUser(
  googleUser: AuthUser,
  db: Kysely<Database> = getDb(),
): Promise<User> {
  return db
    .insertInto("users")
    .values({
      google_sub: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      role: "consultant",
    })
    .onConflict((oc) => oc.column("google_sub").doNothing())
    .returning(["id", "google_sub", "email", "name", "role", "created_at"])
    .executeTakeFirstOrThrow();
}
