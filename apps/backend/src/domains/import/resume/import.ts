import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import { parsePeriod } from "../lib/parse-period.js";
import type { importCvInputSchema } from "@cv-tool/contracts";
import { readBranchAssignmentContent } from "../../resume/lib/branch-assignment-content.js";
import { upsertBranchContentFromLive } from "../../resume/lib/upsert-branch-content-from-live.js";

type ImportCvInput = z.infer<typeof importCvInputSchema>;

export async function importCv(db: Kysely<Database>, input: ImportCvInput) {
  const { employeeId, language, cvJson } = input;
  const { consultant, education, assignments } = cvJson;

  // ---------------------------------------------------------------------------
  // 1. Resolve or create the main resume
  //    - If a main resume exists: keep using it
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
    await db
      .updateTable("resumes")
      .set({ language })
      .where("id", "=", resumeId)
      .execute();
  } else {
    const newResume = await db
      .insertInto("resumes")
      .values({
        employee_id: employeeId,
        title: `${consultant.name} CV`,
        language,
        is_main: true,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    resumeId = newResume.id;
    resumeCreated = true;

    // Create the main branch for the new resume so assignments can be linked
    await db
      .insertInto("resume_branches")
      .values({
        resume_id: resumeId,
        name: "default",
        language,
        is_main: true,
      })
      .execute();
  }

  // ---------------------------------------------------------------------------
  // 2. Resolve the main branch for this resume (needed to link assignments)
  // ---------------------------------------------------------------------------

  const mainBranch = await db
    .selectFrom("resume_branches")
    .select("id")
    .where("resume_id", "=", resumeId)
    .where("is_main", "=", true)
    .executeTakeFirstOrThrow();

  // ---------------------------------------------------------------------------
  // 3. Import assignments — skip duplicates (same employee + client + role + start)
  //    Persist imported content into the main branch tree.
  // ---------------------------------------------------------------------------

  let assignmentsCreated = 0;
  let assignmentsSkipped = 0;
  const existingBranchContent = await readBranchAssignmentContent(db, mainBranch.id);
  const nextAssignments = [...(existingBranchContent?.content.assignments ?? [])];

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

    const duplicate = nextAssignments.some((assignment) =>
      assignment.clientName === clientName
      && assignment.role === a.role.trim()
      && assignment.startDate.slice(0, 10) === startDate.toISOString().slice(0, 10),
    );

    if (duplicate) {
      assignmentsSkipped++;
      continue;
    }

    const description = a.description ?? "";

    const technologies = a.technologies.map((t) => t.trim()).filter(Boolean);
    const keywords = a.keywords.join(", ") || null;

    const newAssignment = await db
      .insertInto("assignments")
      .values({ employee_id: employeeId })
      .returning("id")
      .executeTakeFirstOrThrow();

    nextAssignments.push({
      assignmentId: newAssignment.id,
      clientName,
      role: a.role.trim(),
      description,
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() ?? null,
      technologies,
      isCurrent: isCurrent,
      keywords,
      type: a.type ?? null,
      highlight: a.highlight ?? false,
      sortOrder: null,
    });

    assignmentsCreated++;
  }

  // ---------------------------------------------------------------------------
  // 4. Import education — skip duplicates (same employee + type + value)
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
  // 5. Import skills — parse from skills section and write to tree via commit
  // ---------------------------------------------------------------------------

  const importedSkillGroups: Array<{ name: string; sortOrder: number }> = [];
  const importedSkills: Array<{ name: string; category: string | null; sortOrder: number }> = [];

  if (cvJson.skills) {
    let groupOrder = 0;
    for (const [category, value] of Object.entries(cvJson.skills)) {
      const names: string[] = Array.isArray(value)
        ? (value as unknown[]).filter((v): v is string => typeof v === "string")
        : typeof value === "string"
        ? [value]
        : [];

      importedSkillGroups.push({ name: category, sortOrder: groupOrder++ });

      let skillOrder = 0;
      for (const name of names) {
        if (!name.trim()) continue;
        importedSkills.push({ name: name.trim(), category, sortOrder: skillOrder++ });
      }
    }
  }

  await upsertBranchContentFromLive(db, {
    resumeId,
    branchId: mainBranch.id,
    userId: null,
    consultantTitle: consultant.title || null,
    presentation: consultant.presentation,
    assignments: nextAssignments,
    ...(importedSkills.length > 0 ? { skills: importedSkills, skillGroups: importedSkillGroups } : {}),
  });

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
