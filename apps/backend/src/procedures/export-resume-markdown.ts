import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../auth/require-auth.js";
import { buildExportData } from "../lib/build-export-data.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: string | null | undefined): string {
  if (!d) return "present";
  return d.slice(0, 7); // YYYY-MM
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Core export logic
// ---------------------------------------------------------------------------

export async function exportResumeMarkdown(
  db: Kysely<Database>,
  user: AuthUser,
  resumeId: string,
  commitId?: string
): Promise<{ markdown: string; filename: string; referenceId: string }> {
  const data = await buildExportData(db, user, resumeId, commitId);

  const { name, email, consultantTitle, language, presentation, summary, skills, assignments, education } = data;
  const exportedAt = new Date().toISOString();
  const filename = `${slug(name)}-${language}-cv.md`;

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
  const header = consultantTitle ? `${name} — ${consultantTitle}` : name;
  lines.push(`# ${header}`);
  lines.push("");

  if (email) {
    lines.push(`**Contact:** ${email}`);
    lines.push("");
  }

  // --- Presentation ---
  if (presentation.length > 0) {
    lines.push("## About");
    lines.push("");
    for (const para of presentation) {
      lines.push(para);
      lines.push("");
    }
  }

  // --- Summary ---
  if (summary) {
    lines.push("## Summary");
    lines.push("");
    lines.push(summary);
    lines.push("");
  }

  // --- Skills ---
  if (skills.length > 0) {
    lines.push("## Skills");
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
    lines.push("## Experience");
    lines.push("");
    for (const a of assignments) {
      const period = `${fmtDate(a.start_date)} – ${a.is_current ? "present" : fmtDate(a.end_date)}`;
      lines.push(`### ${a.role} @ ${a.client_name} (${period})`);
      lines.push("");
      if (a.type) {
        lines.push(`**Type:** ${a.type}`);
        lines.push("");
      }
      if (a.technologies.length > 0) {
        lines.push(`**Technologies:** ${a.technologies.join(", ")}`);
        lines.push("");
      }
      if (a.keywords) {
        lines.push(`**Keywords:** ${a.keywords}`);
        lines.push("");
      }
      if (a.description) {
        lines.push(a.description);
        lines.push("");
      }
    }
  }

  // --- Education ---
  const degrees = education.filter((e) => e.type === "degree").map((e) => e.value);
  const certs = education.filter((e) => e.type === "certification").map((e) => e.value);
  const langs = education.filter((e) => e.type === "language").map((e) => e.value);

  if (degrees.length > 0 || certs.length > 0 || langs.length > 0) {
    lines.push("## Education");
    lines.push("");
    if (degrees.length > 0) {
      lines.push("### Degrees");
      for (const d of degrees) lines.push(`- ${d}`);
      lines.push("");
    }
    if (certs.length > 0) {
      lines.push("### Certifications");
      for (const c of certs) lines.push(`- ${c}`);
      lines.push("");
    }
    if (langs.length > 0) {
      lines.push("### Languages");
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
  return exportResumeMarkdown(getDb(), user, input.resumeId, input.commitId);
});

export function createExportResumeMarkdownHandler(db: Kysely<Database>) {
  return implement(contract.exportResumeMarkdown).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return exportResumeMarkdown(db, user, input.resumeId, input.commitId);
    }
  );
}
