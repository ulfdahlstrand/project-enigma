import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { z } from "zod";
import type { Database } from "../../db/types.js";
import { getDb } from "../../db/client.js";
import { requireAuth, type AuthContext, type AuthUser } from "../../auth/require-auth.js";
import { resolveEmployeeId } from "../../auth/resolve-employee-id.js";
import type {
  getConsultantAIPreferencesInputSchema,
  getConsultantAIPreferencesOutputSchema,
  updateConsultantAIPreferencesInputSchema,
  updateConsultantAIPreferencesOutputSchema,
} from "@cv-tool/contracts";

type GetConsultantAIPreferencesOutput = z.infer<typeof getConsultantAIPreferencesOutputSchema>;
type UpdateConsultantAIPreferencesInput = z.infer<typeof updateConsultantAIPreferencesInputSchema>;
type UpdateConsultantAIPreferencesOutput = z.infer<typeof updateConsultantAIPreferencesOutputSchema>;

function mapPreferences(row: {
  employee_id: string;
  prompt: string | null;
  rules: string | null;
  validators: string | null;
  updated_at: Date;
}) {
  return {
    employeeId: row.employee_id,
    prompt: row.prompt,
    rules: row.rules,
    validators: row.validators,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getConsultantAIPreferencesForUser(
  db: Kysely<Database>,
  user: AuthUser,
): Promise<GetConsultantAIPreferencesOutput> {
  const employeeId = await resolveEmployeeId(db, user);
  if (!employeeId) {
    return { preferences: null };
  }

  const row = await db
    .selectFrom("consultant_ai_preferences")
    .select(["employee_id", "prompt", "rules", "validators", "updated_at"])
    .where("employee_id", "=", employeeId)
    .executeTakeFirst();

  return {
    preferences: row ? mapPreferences(row) : null,
  };
}

export async function getConsultantAIPreferencesForEmployee(
  db: Kysely<Database>,
  employeeId: string | null,
) {
  if (!employeeId) return null;

  const row = await db
    .selectFrom("consultant_ai_preferences")
    .select(["employee_id", "prompt", "rules", "validators", "updated_at"])
    .where("employee_id", "=", employeeId)
    .executeTakeFirst();

  return row ? mapPreferences(row) : null;
}

export async function updateConsultantAIPreferences(
  db: Kysely<Database>,
  user: AuthUser,
  input: UpdateConsultantAIPreferencesInput,
): Promise<UpdateConsultantAIPreferencesOutput> {
  const employeeId = await resolveEmployeeId(db, user);
  if (!employeeId) {
    throw new ORPCError("FORBIDDEN", { message: "No employee record is linked to this user." });
  }

  const existing = await db
    .selectFrom("consultant_ai_preferences")
    .select(["id"])
    .where("employee_id", "=", employeeId)
    .executeTakeFirst();

  const nextValues = {
    ...(input.prompt !== undefined ? { prompt: input.prompt?.trim() || null } : {}),
    ...(input.rules !== undefined ? { rules: input.rules?.trim() || null } : {}),
    ...(input.validators !== undefined ? { validators: input.validators?.trim() || null } : {}),
    updated_at: new Date(),
  };

  const row = existing
    ? await db
        .updateTable("consultant_ai_preferences")
        .set(nextValues)
        .where("id", "=", existing.id)
        .returning(["employee_id", "prompt", "rules", "validators", "updated_at"])
        .executeTakeFirstOrThrow()
    : await db
        .insertInto("consultant_ai_preferences")
        .values({
          employee_id: employeeId,
          prompt: input.prompt?.trim() || null,
          rules: input.rules?.trim() || null,
          validators: input.validators?.trim() || null,
        })
        .returning(["employee_id", "prompt", "rules", "validators", "updated_at"])
        .executeTakeFirstOrThrow();

  return {
    preferences: mapPreferences(row),
  };
}

export const getConsultantAIPreferencesHandler = implement(contract.getConsultantAIPreferences).handler(
  async ({ context }) => {
    const user = requireAuth(context as AuthContext);
    return getConsultantAIPreferencesForUser(getDb(), user);
  },
);

export const updateConsultantAIPreferencesHandler = implement(contract.updateConsultantAIPreferences).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return updateConsultantAIPreferences(getDb(), user, input);
  },
);
