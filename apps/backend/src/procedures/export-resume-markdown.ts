import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "present";
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 7); // YYYY-MM
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
  resumeId: string
): Promise<{ markdown: string; filename: string }> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const resume = await db
    .selectFrom("resumes")
    .selectAll()
    .where("id", "=", resumeId)
    .executeTakeFirst();

  if (!resume) throw new ORPCError("NOT_FOUND");
  if (ownerEmployeeId !== null && resume.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const [employee, assignments, skills, education] = await Promise.all([
    db
      .selectFrom("employees")
      .select(["id", "name", "email"])
      .where("id", "=", resume.employee_id)
      .executeTakeFirst(),
    db
      .selectFrom("assignments")
      .selectAll()
      .where("resume_id", "=", resumeId)
      .orderBy("is_current", "desc")
      .orderBy("end_date", "desc")
      .orderBy("start_date", "desc")
      .execute(),
    db
      .selectFrom("resume_skills")
      .selectAll()
      .where("cv_id", "=", resumeId)
      .orderBy("sort_order", "asc")
      .execute(),
    db
      .selectFrom("education")
      .selectAll()
      .where("employee_id", "=", resume.employee_id)
      .orderBy("sort_order", "asc")
      .execute(),
  ]);

  const name = employee?.name ?? "Unknown";
  const consultantTitle = resume.consultant_title ?? "";
  const presentation: string[] = (resume.presentation as string[] | null) ?? [];
  const language = resume.language ?? "en";
  const exportedAt = new Date().toISOString();

  const lines: string[] = [];

  // --- Frontmatter ---
  lines.push("---");
  lines.push(`resume_id: ${resume.id}`);
  lines.push(`employee_id: ${resume.employee_id}`);
  lines.push(`language: ${language}`);
  lines.push(`exported_at: ${exportedAt}`);
  lines.push("---");
  lines.push("");

  // --- Header ---
  const header = consultantTitle ? `${name} — ${consultantTitle}` : name;
  lines.push(`# ${header}`);
  lines.push("");

  if (employee?.email) {
    lines.push(`**Contact:** ${employee.email}`);
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
  if (resume.summary) {
    lines.push("## Summary");
    lines.push("");
    lines.push(resume.summary);
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
      existing.push(s.name);
      byCategory.set(cat, existing);
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
      const highlight = a.highlight ? " ⭐" : "";
      lines.push(`### ${a.role} @ ${a.client_name} (${period})${highlight}`);
      lines.push("");
      if (a.type) {
        lines.push(`**Type:** ${a.type}`);
        lines.push("");
      }
      if (a.technologies && (a.technologies as string[]).length > 0) {
        lines.push(`**Technologies:** ${(a.technologies as string[]).join(", ")}`);
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
  const filename = `${slug(name)}-${language}-cv.md`;

  return { markdown, filename };
}

// ---------------------------------------------------------------------------
// oRPC handlers
// ---------------------------------------------------------------------------

export const exportResumeMarkdownHandler = implement(
  contract.exportResumeMarkdown
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return exportResumeMarkdown(getDb(), user, input.resumeId);
});

export function createExportResumeMarkdownHandler(db: Kysely<Database>) {
  return implement(contract.exportResumeMarkdown).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return exportResumeMarkdown(db, user, input.resumeId);
    }
  );
}
