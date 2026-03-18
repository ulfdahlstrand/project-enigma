import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../auth/require-auth.js";
import { buildExportData } from "../lib/build-export-data.js";
import puppeteer from "puppeteer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "present";
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 7);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

function buildHtml(data: {
  name: string;
  consultantTitle: string;
  email: string | null | undefined;
  presentation: string[];
  summary: string | null | undefined;
  skills: Array<{ name: string; category: string | null; level: string | null }>;
  assignments: Array<{
    role: string;
    client_name: string;
    start_date: Date | string;
    end_date: Date | string | null;
    is_current: boolean;
    type: string | null;
    technologies: string[];
    keywords: string | null;
    description: string | null;
  }>;
  education: Array<{ type: string; value: string }>;
}): string {
  const header = data.consultantTitle
    ? `${escapeHtml(data.name)} — ${escapeHtml(data.consultantTitle)}`
    : escapeHtml(data.name);

  const presentationHtml = data.presentation
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n");

  const summaryHtml = data.summary
    ? `<section><h2>Summary</h2><p>${escapeHtml(data.summary)}</p></section>`
    : "";

  // Skills grouped by category
  const byCategory = new Map<string, string[]>();
  for (const s of data.skills) {
    const cat = s.category ?? "General";
    const existing = byCategory.get(cat) ?? [];
    existing.push(s.name);
    byCategory.set(cat, existing);
  }
  const skillsHtml =
    byCategory.size > 0
      ? `<section><h2>Skills</h2>${[...byCategory.entries()]
          .map(
            ([cat, names]) =>
              `<div class="skill-group"><strong>${escapeHtml(cat)}:</strong> ${names.map(escapeHtml).join(", ")}</div>`
          )
          .join("\n")}</section>`
      : "";

  // Experience
  const experienceHtml =
    data.assignments.length > 0
      ? `<section><h2>Experience</h2>${data.assignments
          .map((a) => {
            const period = `${fmtDate(a.start_date)} – ${a.is_current ? "present" : fmtDate(a.end_date)}`;
            const techLine =
              a.technologies.length > 0
                ? `<p><strong>Technologies:</strong> ${a.technologies.map(escapeHtml).join(", ")}</p>`
                : "";
            const typeLine = a.type
              ? `<p><strong>Type:</strong> ${escapeHtml(a.type)}</p>`
              : "";
            const kwLine = a.keywords
              ? `<p><strong>Keywords:</strong> ${escapeHtml(a.keywords)}</p>`
              : "";
            const descLine = a.description
              ? `<p>${escapeHtml(a.description)}</p>`
              : "";
            return `<div class="assignment">
  <h3>${escapeHtml(a.role)} @ ${escapeHtml(a.client_name)}</h3>
  <p class="period">${period}</p>
  ${typeLine}${techLine}${kwLine}${descLine}
</div>`;
          })
          .join("\n")}</section>`
      : "";

  // Education
  const degrees = data.education.filter((e) => e.type === "degree").map((e) => e.value);
  const certs = data.education.filter((e) => e.type === "certification").map((e) => e.value);
  const langs = data.education.filter((e) => e.type === "language").map((e) => e.value);
  const eduSections: string[] = [];
  if (degrees.length > 0)
    eduSections.push(`<h3>Degrees</h3><ul>${degrees.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`);
  if (certs.length > 0)
    eduSections.push(`<h3>Certifications</h3><ul>${certs.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`);
  if (langs.length > 0)
    eduSections.push(`<h3>Languages</h3><ul>${langs.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`);
  const educationHtml =
    eduSections.length > 0
      ? `<section><h2>Education</h2>${eduSections.join("\n")}</section>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; max-width: 800px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 20pt; margin-bottom: 4px; }
  h2 { font-size: 13pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
  h3 { font-size: 11pt; margin: 12px 0 2px; }
  p { margin: 4px 0; }
  .contact { color: #555; margin-bottom: 8px; }
  .assignment { margin-bottom: 16px; }
  .period { color: #555; font-size: 10pt; margin: 0; }
  .skill-group { margin-bottom: 6px; }
  ul { margin: 4px 0; padding-left: 20px; }
  li { margin-bottom: 2px; }
  section { margin-bottom: 8px; }
</style>
</head>
<body>
  <h1>${header}</h1>
  ${data.email ? `<p class="contact">${escapeHtml(data.email)}</p>` : ""}
  ${presentationHtml}
  ${summaryHtml}
  ${skillsHtml}
  ${experienceHtml}
  ${educationHtml}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Core export logic
// ---------------------------------------------------------------------------

export async function exportResumePdf(
  db: Kysely<Database>,
  user: AuthUser,
  resumeId: string,
  commitId?: string
): Promise<{ pdf: string; filename: string; referenceId: string }> {
  const data = await buildExportData(db, user, resumeId, commitId);

  const { name, language } = data;

  const html = buildHtml({
    name,
    consultantTitle: data.consultantTitle,
    email: data.email,
    presentation: data.presentation,
    summary: data.summary,
    skills: data.skills,
    assignments: data.assignments,
    education: data.education,
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let pdfBuffer: Buffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    pdfBuffer = Buffer.from(
      await page.pdf({ format: "A4", printBackground: true })
    );
  } finally {
    await browser.close();
  }

  const filename = `${slug(name)}-${language}-cv.pdf`;

  const record = await db
    .insertInto("export_records")
    .values({
      resume_id: resumeId,
      employee_id: data.employeeId,
      format: "pdf",
      filename,
      ...(data.commitId !== null ? { commit_id: data.commitId } : {}),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return {
    pdf: pdfBuffer.toString("base64"),
    filename,
    referenceId: record.id,
  };
}

// ---------------------------------------------------------------------------
// oRPC handlers
// ---------------------------------------------------------------------------

export const exportResumePdfHandler = implement(
  contract.exportResumePdf
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return exportResumePdf(getDb(), user, input.resumeId, input.commitId);
});

export function createExportResumePdfHandler(db: Kysely<Database>) {
  return implement(contract.exportResumePdf).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return exportResumePdf(db, user, input.resumeId, input.commitId);
    }
  );
}
