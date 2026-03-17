import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import { sql, type Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthContext } from "../auth/require-auth.js";
import { parsePeriod } from "../lib/parse-period.js";
import type { importCvInputSchema } from "@cv-tool/contracts";

type ImportCvInput = z.infer<typeof importCvInputSchema>;

export async function importCv(db: Kysely<Database>, input: ImportCvInput) {
  const { employeeId, cvJson } = input;
  const { consultant, education, assignments } = cvJson;

  // ---------------------------------------------------------------------------
  // 1. Update employee title and presentation
  // ---------------------------------------------------------------------------

  const updates: Array<Promise<unknown>> = [];
  if (consultant.title) {
    updates.push(
      db.updateTable("employees").set({ title: consultant.title }).where("id", "=", employeeId).execute()
    );
  }
  if (consultant.presentation.length > 0) {
    updates.push(
      db
        .updateTable("employees")
        .set({ presentation: sql`${JSON.stringify(consultant.presentation)}::jsonb` as unknown as string[] })
        .where("id", "=", employeeId)
        .execute()
    );
  }
  await Promise.all(updates);

  // ---------------------------------------------------------------------------
  // 2. Import assignments — skip duplicates (same employee + client + role + start)
  // ---------------------------------------------------------------------------

  let assignmentsCreated = 0;
  let assignmentsSkipped = 0;

  for (const a of assignments) {
    const period = parsePeriod(a.period);
    if (!period) {
      assignmentsSkipped++;
      continue;
    }

    const clientName = a.customer.trim() || "Unknown";

    // Duplicate check
    const existing = await db
      .selectFrom("assignments")
      .select("id")
      .where("employee_id", "=", employeeId)
      .where("client_name", "=", clientName)
      .where("role", "=", a.role.trim())
      .where("start_date", "=", period.startDate)
      .executeTakeFirst();

    if (existing) {
      assignmentsSkipped++;
      continue;
    }

    const description = a.description_raw.filter(Boolean).join("\n\n");
    const technologies = a.tekniker
      ? a.tekniker.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    const keywords = a.nyckelord.trim() || null;

    await db
      .insertInto("assignments")
      .values({
        employee_id: employeeId,
        resume_id: null,
        client_name: clientName,
        role: a.role.trim(),
        description,
        start_date: period.startDate,
        end_date: period.endDate,
        is_current: period.isCurrent,
        technologies,
        keywords,
      })
      .execute();

    assignmentsCreated++;
  }

  // ---------------------------------------------------------------------------
  // 3. Import education — skip duplicates (same employee + type + value)
  // ---------------------------------------------------------------------------

  let educationCreated = 0;
  let educationSkipped = 0;

  const educationItems: Array<{ type: "degree" | "certification" | "language"; value: string }> = [
    ...education.degrees.map((v) => ({ type: "degree" as const, value: v.trim() })),
    ...education.certifications.map((v) => ({ type: "certification" as const, value: v.trim() })),
    ...education.languages.map((v) => ({ type: "language" as const, value: v.trim() })),
  ];

  for (const item of educationItems) {
    if (!item.value) {
      educationSkipped++;
      continue;
    }

    const existing = await db
      .selectFrom("education")
      .select("id")
      .where("employee_id", "=", employeeId)
      .where("type", "=", item.type)
      .where("value", "=", item.value)
      .executeTakeFirst();

    if (existing) {
      educationSkipped++;
      continue;
    }

    await db
      .insertInto("education")
      .values({
        employee_id: employeeId,
        type: item.type,
        value: item.value,
        sort_order: educationCreated,
      })
      .execute();

    educationCreated++;
  }

  return {
    assignmentsCreated,
    assignmentsSkipped,
    educationCreated,
    educationSkipped,
  };
}

export const importCvHandler = implement(contract.importCv).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return importCv(getDb(), input);
  }
);

export function createImportCvHandler(db: Kysely<Database>) {
  return implement(contract.importCv).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return importCv(db, input);
    }
  );
}
