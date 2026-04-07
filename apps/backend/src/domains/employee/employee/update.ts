import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

// ---------------------------------------------------------------------------
// updateEmployee — query logic
// ---------------------------------------------------------------------------

/**
 * Updates an existing employee's name and/or email, returning the updated row.
 * Throws ORPCError({ code: 'NOT_FOUND' }) if no row is found.
 *
 * @param db      - Kysely instance (real or mock).
 * @param id      - UUID of the employee to update.
 * @param updates - Object with optional `name` and/or `email` fields to update.
 */
export async function updateEmployee(
  db: Kysely<Database>,
  id: string,
  updates: {
    name?: string;
    email?: string;
    profileImageDataUrl?: string | null;
    profileImageOriginalDataUrl?: string | null;
  }
): Promise<{
  id: string;
  name: string;
  email: string;
  profileImageDataUrl: string | null;
  profileImageOriginalDataUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  const set: {
    name?: string;
    email?: string;
    profile_image_data_url?: string | null;
    profile_image_original_data_url?: string | null;
  } = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.email !== undefined) set.email = updates.email;
  if (updates.profileImageDataUrl !== undefined) set.profile_image_data_url = updates.profileImageDataUrl;
  if (updates.profileImageOriginalDataUrl !== undefined) {
    set.profile_image_original_data_url = updates.profileImageOriginalDataUrl;
  }

  const row = await db
    .updateTable("employees")
    .set(set)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    profileImageDataUrl: row.profile_image_data_url,
    profileImageOriginalDataUrl: row.profile_image_original_data_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const updateEmployeeHandler = implement(contract.updateEmployee).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return updateEmployee(getDb(), input.id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.profileImageDataUrl !== undefined && { profileImageDataUrl: input.profileImageDataUrl }),
      ...(input.profileImageOriginalDataUrl !== undefined && {
        profileImageOriginalDataUrl: input.profileImageOriginalDataUrl,
      }),
    });
  }
);
