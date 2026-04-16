import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { buildExportData } from "../lib/build-export-data.js";
import { buildExportFilename } from "../lib/build-export-filename.js";
import { getPdfTranslations } from "./pdf-translations.js";
import { toQuarter } from "@cv-tool/utils";

// ---------------------------------------------------------------------------
// Core export logic
// ---------------------------------------------------------------------------

export async function exportResumeMarkdown(
  db: Kysely<Database>,
  user: AuthUser,
  resumeId: string,
  commitId?: string,
  branchId?: string,
): Promise<{ markdown: string; filename: string; referenceId: string }> {
  const data = await buildExportData(db, user, resumeId, commitId, branchId);

  const { name, email, consultantTitle, language, presentation, summary, highlightedItems, skills, assignments, education } = data;
  const t = getPdfTranslations(language);
  const exportedAt = new Date().toISOString();
  const filename = buildExportFilename({
    consultantName: name,
    company: "SthlmTech",
    language,
    branchName: data.branchName,
    extension: "md",
  });

  const record = await db
    .insertInto("export_records")
    .values({
      resume_id: resumeId,
      employee_id: data.employeeId,
      format: "markdown",
      filename,
      ...(data.commitId !== null ? { commit_id: data.commitId } : {}),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  const referenceId = record.id;
  const lines: string[] = [];

  // --- Frontmatter ---
  lines.push("---");
  lines.push(`reference_id: ${referenceId}`);
  lines.push(`language: ${language}`);
  lines.push(`exported_at: ${exportedAt}`);
  if (data.commitId) lines.push(`commit_id: ${data.commitId}`);
  lines.push("---");
  lines.push("");

  // --- Header ---
  lines.push(`# ${name}`);
  if (consultantTitle) {
    lines.push(`## ${consultantTitle}`);
  }
  lines.push("");

  // --- Presentation ---
  if (presentation.length > 0) {
    for (const para of presentation) {
      if (para) {
        lines.push(para);
        lines.push("");
      }
    }
  }

  // --- Info box: Special skills + highlighted experience ---
  const highlights = highlightedItems.length > 0
    ? highlightedItems
    : assignments.slice(0, 5).map((a) => `${a.role} ${t.atClient} ${a.client_name}`);

  if (summary) {
    lines.push(`### ${t.specialSkillsHeading}`);
    lines.push("");
    lines.push(summary);
    lines.push("");
  }

  if (highlights.length > 0) {
    lines.push(`### ${t.experienceSummaryHeading}`);
    lines.push("");
    for (const item of highlights) lines.push(`- ${item}`);
    lines.push("");
  }

  // --- Skills ---
  if (skills.length > 0) {
    lines.push(`## ${t.consultantProfile}`);
    lines.push("");
    const byCategory = new Map<string, string[]>();
    for (const s of skills) {
      const cat = s.category ?? "General";
      const existing = byCategory.get(cat) ?? [];
      byCategory.set(cat, [...existing, s.name]);
    }
    for (const [cat, names] of byCategory) {
      lines.push(`### ${cat}`);
      lines.push(names.join(", "));
      lines.push("");
    }
  }

  // --- Experience ---
  if (assignments.length > 0) {
    lines.push(`## ${t.experienceHeading}`);
    lines.push("");
    for (const a of assignments) {
      const startQ = toQuarter(a.start_date);
      const endQ = a.is_current ? t.present : (a.end_date ? toQuarter(a.end_date) : null);
      const period = endQ && endQ !== startQ ? `${startQ} – ${endQ}` : startQ;
      lines.push(`### ${a.role.toUpperCase()}`);
      lines.push(`**${a.client_name}** ${period}`);
      lines.push("");
      if (a.description) {
        lines.push(a.description);
        lines.push("");
      }
      if (a.technologies.length > 0) {
        lines.push(`**${t.technologies}** ${a.technologies.join(", ")}`);
      }
      if (a.keywords) {
        lines.push(`**${t.keywords}** ${a.keywords}`);
      }
      if (a.technologies.length > 0 || a.keywords) lines.push("");
    }
  }

  // --- Education ---
  const degrees = education.filter((e) => e.type === "degree").map((e) => e.value);
  const certs = education.filter((e) => e.type === "certification").map((e) => e.value);
  const langs = education.filter((e) => e.type === "language").map((e) => e.value);

  if (degrees.length > 0 || certs.length > 0 || langs.length > 0) {
    lines.push(`## ${t.educationHeading}`);
    lines.push("");
    if (degrees.length > 0) {
      lines.push(`### ${t.degrees}`);
      for (const d of degrees) lines.push(`- ${d}`);
      lines.push("");
    }
    if (certs.length > 0) {
      lines.push(`### ${t.certifications}`);
      for (const c of certs) lines.push(`- ${c}`);
      lines.push("");
    }
    if (langs.length > 0) {
      lines.push(`### ${t.languages}`);
      for (const l of langs) lines.push(`- ${l}`);
      lines.push("");
    }
  }

  const markdown = lines.join("\n").trimEnd() + "\n";

  return { markdown, filename, referenceId };
}

// ---------------------------------------------------------------------------
// oRPC handlers
// ---------------------------------------------------------------------------

export const exportResumeMarkdownHandler = implement(
  contract.exportResumeMarkdown
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  const exportInput = input as typeof input & { branchId?: string };
  return exportResumeMarkdown(getDb(), user, exportInput.resumeId, exportInput.commitId, exportInput.branchId);
});
