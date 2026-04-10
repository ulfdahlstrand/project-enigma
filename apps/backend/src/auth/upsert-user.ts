import { sql, type Kysely } from "kysely";
import { getDb } from "../db/client.js";
import type { AuthUser } from "./verify-entra-token.js";
import type { Database, User } from "../db/types.js";

/**
 * Upserts a user based on the Entra object id. Existing pre-Entra users are
 * linked on first Entra login by normalized email to avoid duplicate accounts.
 */
export async function upsertUser(
  entraUser: AuthUser,
  db: Kysely<Database> = getDb(),
): Promise<User> {
  const existingByOid = await db
    .selectFrom("users")
    .selectAll()
    .where("azure_oid", "=", entraUser.oid)
    .executeTakeFirst();

  if (existingByOid) {
    return db
      .updateTable("users")
      .set({
        email: entraUser.email,
        name: entraUser.name,
      })
      .where("id", "=", existingByOid.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  const normalizedEmail = entraUser.email.trim().toLowerCase();
  const existingByEmail = normalizedEmail
    ? await db
        .selectFrom("users")
        .selectAll()
        .where((eb) => eb(sql`lower(email)`, "=", normalizedEmail))
        .executeTakeFirst()
    : undefined;

  if (existingByEmail) {
    return db
      .updateTable("users")
      .set({
        azure_oid: entraUser.oid,
        email: entraUser.email,
        name: entraUser.name,
      })
      .where("id", "=", existingByEmail.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  return db
    .insertInto("users")
    .values({
      azure_oid: entraUser.oid,
      email: entraUser.email,
      name: entraUser.name,
      role: "consultant",
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
