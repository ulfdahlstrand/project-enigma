import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { buildExportData } from "../lib/build-export-data.js";
import { PDF_CSS, PDF_FONT_LINKS } from "./pdf-styles.js";
import { getPdfTranslations } from "./pdf-translations.js";
import { toQuarter } from "@cv-tool/utils";
import puppeteer from "puppeteer";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_DATA_URI = `data:image/svg+xml;base64,${readFileSync(join(__dirname, "sthlmtech_logo.svg")).toString("base64")}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  profileImageDataUrl: string | null;
  presentation: string[];
  summary: string | null | undefined;
  highlightedItems: string[];
  skills: Array<{ name: string; category: string | null }>;
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
  language?: string;
}): string {
  const t = getPdfTranslations(data.language);

  // ---------------------------------------------------------------------------
  // Page 1 — Cover
  // ---------------------------------------------------------------------------

  const presentationHtml = data.presentation
    .map((p) => `<p class="presentation">${escapeHtml(p)}</p>`)
    .join("\n");


  // ---------------------------------------------------------------------------
  // Page 2 — Skills + Education (two-column)
  // ---------------------------------------------------------------------------

  const byCategory = new Map<string, string[]>();
  for (const s of data.skills) {
    const cat = s.category ?? "General";
    const existing = byCategory.get(cat) ?? [];
    existing.push(s.name);
    byCategory.set(cat, existing);
  }

  const skillBlocksHtml = [...byCategory.entries()]
    .map(
      ([cat, names]) => `
      <div class="category-block">
        <div class="category-header"><span class="category-title">${escapeHtml(cat).toUpperCase()}</span></div>
        <p class="skill-list">${names.map(escapeHtml).join(", ")}</p>
      </div>`
    )
    .join("\n");

  const degrees = data.education.filter((e) => e.type === "degree").map((e) => e.value);
  const certs = data.education.filter((e) => e.type === "certification").map((e) => e.value);
  const langs = data.education.filter((e) => e.type === "language").map((e) => e.value);
  const eduItems: string[] = [];
  if (degrees.length > 0)
    eduItems.push(`<div class="edu-group"><p class="edu-label">${t.degrees}</p>${degrees.map((d) => `<p class="edu-value">${escapeHtml(d)}</p>`).join("")}</div>`);
  if (certs.length > 0)
    eduItems.push(`<div class="edu-group"><p class="edu-label">${t.certifications}</p>${certs.map((c) => `<p class="edu-value">${escapeHtml(c)}</p>`).join("")}</div>`);
  if (langs.length > 0)
    eduItems.push(`<div class="edu-group"><p class="edu-label">${t.languages}</p>${langs.map((l) => `<p class="edu-value">${escapeHtml(l)}</p>`).join("")}</div>`);
  const educationHtml = eduItems.length > 0
    ? `<div class="edu-section"><h4 class="section-h4">${t.educationHeading}</h4>${eduItems.join("")}</div>`
    : "";

  const skillsPageHtml = byCategory.size > 0 || eduItems.length > 0
    ? `<div class="section section-break">
          <h2 class="name-h2">${escapeHtml(data.name)}</h2>
          <h3 class="profile-h3">${t.consultantProfile}</h3>
          <div class="skills-columns">
            ${skillBlocksHtml}
            ${educationHtml}
          </div>
      </div>`
    : "";

  // ---------------------------------------------------------------------------
  // Page 3 — Assignments
  // ---------------------------------------------------------------------------

  const assignmentsHtml = data.assignments.length > 0
    ? `<div class="section section-break assignments-section">
          <h6 class="assignments-heading">${t.experienceHeading}</h6>
          <div class="assignments-list">
            ${data.assignments.map((a) => {
              const startQ = toQuarter(a.start_date);
              const endQ = a.is_current ? t.present : (a.end_date ? toQuarter(a.end_date) : null);
              const period = endQ && endQ !== startQ
                ? `${escapeHtml(startQ)} – ${escapeHtml(endQ)}`
                : escapeHtml(startQ);
              const subtitle = `${escapeHtml(a.client_name)} ${period}`;
              const descHtml = a.description
                ? a.description.split(/\n+/).filter(Boolean).map((p) => `<p class="body2 justified">${escapeHtml(p)}</p>`).join("")
                : "";
              const hasTech = a.technologies.length > 0;
              const hasKeywords = Boolean(a.keywords);
              const techBoxHtml = hasTech || hasKeywords
                ? `<div class="tech-box">
                    ${hasTech ? `<p class="tech-line"><span class="tech-label">${t.technologies}</span> <span class="body2">${a.technologies.map(escapeHtml).join(", ")}</span></p>` : ""}
                    ${hasKeywords ? `<p class="tech-line"><span class="tech-label">${t.keywords}</span> <span class="body2">${escapeHtml(a.keywords!)}</span></p>` : ""}
                   </div>`
                : "";
              return `<div class="assignment">
                <h3 class="role-heading">${escapeHtml(a.role).toUpperCase()}</h3>
                <p class="subtitle">${subtitle}</p>
                ${descHtml}
                ${techBoxHtml}
              </div>`;
            }).join("\n")}
          </div>
      </div>`
    : "";

  // ---------------------------------------------------------------------------
  // Full HTML document
  // ---------------------------------------------------------------------------

  return `<!DOCTYPE html>
<html lang="${escapeHtml(data.language ?? "en")}">
<head>
<meta charset="UTF-8" />
${PDF_FONT_LINKS}
<style>${PDF_CSS}</style>
</head>
<body>
  <!-- Page 1: Cover -->
  <div class="section section-break cover-section">
    <div class="cover-header">
      <div class="cover-header-text">
        <h1 class="name-h1">${escapeHtml(data.name)}</h1>
      </div>
      ${data.profileImageDataUrl ? `<div class="profile-image-wrap"><img class="profile-image" src="${data.profileImageDataUrl}" alt="${escapeHtml(data.name)}" /></div>` : ""}
    </div>
    ${data.consultantTitle ? `<h3 class="title-h3">${escapeHtml(data.consultantTitle)}</h3>` : ""}
    ${presentationHtml}
    ${(() => {
      const sorted = [...data.assignments].sort((a, b) => {
        if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
        return (b.start_date ?? "").toString().localeCompare((a.start_date ?? "").toString());
      });
      const highlighted = data.highlightedItems.length > 0
        ? data.highlightedItems
        : sorted.slice(0, 5).map((a) => `${a.role} ${t.atClient} ${a.client_name}`);
      const showBox = data.summary || highlighted.length > 0;
      if (!showBox) return "";
      return `<div class="info-box">
      ${data.summary ? `
        <p class="info-box-label">${t.specialSkillsHeading}</p>
        <p class="info-box-body">${escapeHtml(data.summary)}</p>
      ` : ""}
      ${highlighted.length > 0 ? `
        <p class="info-box-label exp-summary-heading">${t.experienceSummaryHeading}</p>
        <ul class="exp-summary-list">
          ${highlighted.map((item) => `<li class="exp-summary-item">${escapeHtml(item)}</li>`).join("")}
        </ul>
      ` : ""}
    </div>`;
    })()}
  </div>

  ${skillsPageHtml}
  ${assignmentsHtml}
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
    language,
    consultantTitle: data.consultantTitle,
    email: data.email,
    profileImageDataUrl: data.profileImageDataUrl,
    presentation: data.presentation,
    summary: data.summary,
    highlightedItems: data.highlightedItems,
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
      await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `
          <div style="width:100%;display:flex;align-items:center;justify-content:center;position:relative;padding:0 80px;box-sizing:border-box;">
            <span style="font-size:9pt;font-family:Constantia,'Palatino Linotype',serif;color:#555;" class="pageNumber"></span>
            <img src="${LOGO_DATA_URI}" style="position:absolute;right:80px;bottom:24px;width:80px;height:auto;" />
          </div>`,
        margin: { top: "112px", right: "80px", bottom: "80px", left: "80px" },
      })
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
