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
  const { employeeId, language, cvJson } = input;
  const { consultant, education, assignments } = cvJson;

  // ---------------------------------------------------------------------------
  // 1. Resolve or create the main resume
  //    - If a main resume exists: update consultant_title and presentation
  //    - If none exists: create one (is_main=true) with data from the CV JSON
  // ---------------------------------------------------------------------------

  let resumeId: string;
  let resumeCreated = false;

  const existingMainResume = await db
    .selectFrom("resumes")
    .select("id")
    .where("employee_id", "=", employeeId)
    .where("is_main", "=", true)
    .where("language", "=", language)
    .executeTakeFirst();

  if (existingMainResume) {
    resumeId = existingMainResume.id;
    const resumeUpdates: Array<Promise<unknown>> = [];
    if (consultant.title) {
      resumeUpdates.push(
        db
          .updateTable("resumes")
          .set({ consultant_title: consultant.title, language })
          .where("id", "=", resumeId)
          .execute()
      );
    }
    if (consultant.presentation.length > 0) {
      resumeUpdates.push(
        db
          .updateTable("resumes")
          .set({ presentation: sql`${JSON.stringify(consultant.presentation)}::jsonb` as unknown as string[] })
          .where("id", "=", resumeId)
          .execute()
      );
    }
    await Promise.all(resumeUpdates);
  } else {
    const newResume = await db
      .insertInto("resumes")
      .values({
        employee_id: employeeId,
        title: `${consultant.name} CV`,
        consultant_title: consultant.title || null,
        presentation: sql`${JSON.stringify(consultant.presentation)}::jsonb` as unknown as string[],
        language,
        is_main: true,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    resumeId = newResume.id;
    resumeCreated = true;
  }

  // ---------------------------------------------------------------------------
  // 2. Import assignments — skip duplicates (same employee + client + role + start)
  // ---------------------------------------------------------------------------

  let assignmentsCreated = 0;
  let assignmentsSkipped = 0;

  for (const a of assignments) {
    const clientName = a.client.trim() || "Unknown";

    // Resolve dates — use explicit start_date/end_date if present, fall back to period
    let startDate: Date;
    let endDate: Date | null;
    let isCurrent: boolean;

    if (a.start_date) {
      startDate = new Date(a.start_date);
      endDate = a.end_date ? new Date(a.end_date) : null;
      isCurrent = a.end_date === null;
    } else {
      const period = parsePeriod(a.period ?? "");
      if (!period) {
        assignmentsSkipped++;
        continue;
      }
      startDate = period.startDate;
      endDate = period.endDate;
      isCurrent = period.isCurrent;
    }

    // Duplicate check
    const existing = await db
      .selectFrom("assignments")
      .select("id")
      .where("employee_id", "=", employeeId)
      .where("client_name", "=", clientName)
      .where("role", "=", a.role.trim())
      .where("start_date", "=", startDate)
      .executeTakeFirst();

    if (existing) {
      assignmentsSkipped++;
      continue;
    }

    const description = [a.context, a.responsibilities, a.result]
      .filter(Boolean)
      .join("\n\n");

    const technologies = a.technologies.map((t) => t.trim()).filter(Boolean);
    const keywords = a.keywords.join(", ") || null;

    await db
      .insertInto("assignments")
      .values({
        employee_id: employeeId,
        resume_id: resumeId,
        client_name: clientName,
        role: a.role.trim(),
        description,
        start_date: startDate,
        end_date: endDate,
        is_current: isCurrent,
        technologies,
        keywords,
        type: a.type ?? null,
        highlight: a.highlight ?? false,
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

  // ---------------------------------------------------------------------------
  // 4. Import skills — clear existing and reimport from skills section
  // ---------------------------------------------------------------------------

  if (cvJson.skills) {
    await db.deleteFrom("resume_skills").where("cv_id", "=", resumeId).execute();

    let skillOrder = 0;
    for (const [category, value] of Object.entries(cvJson.skills)) {
      const names: string[] = Array.isArray(value)
        ? (value as unknown[]).filter((v): v is string => typeof v === "string")
        : typeof value === "string"
        ? [value]
        : [];

      for (const name of names) {
        if (!name.trim()) continue;
        await db
          .insertInto("resume_skills")
          .values({
            cv_id: resumeId,
            name: name.trim(),
            category,
            sort_order: skillOrder++,
          })
          .execute();
      }
    }
  }

  return {
    resumeCreated,
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
