import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
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

function toQuarter(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
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
// Static translations
// ---------------------------------------------------------------------------

interface PdfTranslations {
  experienceHeading: string;
  experienceSummaryHeading: string;
  specialSkillsHeading: string;
  atClient: string;
  consultantProfile: string;
  present: string;
  technologies: string;
  keywords: string;
  educationHeading: string;
  degrees: string;
  certifications: string;
  languages: string;
}

const PDF_TRANSLATIONS: Record<string, PdfTranslations> = {
  en: {
    experienceHeading: "Experience",
    experienceSummaryHeading: "EXAMPLES OF EXPERIENCE",
    specialSkillsHeading: "SPECIAL SKILLS",
    atClient: "at",
    consultantProfile: "Consultant profile",
    present: "Present",
    technologies: "TECHNOLOGIES",
    keywords: "KEYWORDS",
    educationHeading: "Övrigt",
    degrees: "DEGREES",
    certifications: "CERTIFICATIONS",
    languages: "LANGUAGES",
  },
  sv: {
    experienceHeading: "Urval av kvalifikationer",
    experienceSummaryHeading: "EXEMPEL PÅ ERFARENHET",
    specialSkillsHeading: "SPECIALKUNSKAPER",
    atClient: "hos",
    consultantProfile: "Konsultprofil",
    present: "Pågående",
    technologies: "TEKNIKER",
    keywords: "NYCKELORD",
    educationHeading: "Övrigt",
    degrees: "UTBILDNING",
    certifications: "CERTIFIERINGAR",
    languages: "SPRÅK",
  },
};

function getPdfTranslations(language: string | null | undefined): PdfTranslations {
  return PDF_TRANSLATIONS[language ?? "en"] ?? (PDF_TRANSLATIONS["en"] as PdfTranslations);
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
    ? `<div class="section section-break">
          <h6 class="assignments-heading">${t.experienceHeading}</h6>
          <div class="assignments-list">
            ${data.assignments.map((a) => {
              const startQ = toQuarter(a.start_date);
              const endQ = a.is_current ? t.present : (a.end_date ? toQuarter(a.end_date) : "—");
              const period = `${escapeHtml(startQ)} – ${escapeHtml(endQ)}`;
              const subtitle = `${escapeHtml(a.client_name)} &nbsp;&nbsp; ${period}`;
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
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;700&family=Open+Sans:wght@400&display=swap" rel="stylesheet" />
<style>
  @page {
    size: A4;
    margin: 104px 80px 80px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: Constantia, "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
    font-size: 10pt;
    color: #111;
  }

  /* Logical sections — each starts on a new page */
  .section { display: block; }
  .section-break { page-break-after: always; }

  /* Cover page */
  .cover-section { padding-top: 320px; }

  /* Cover page — typography */
  .name-h1 { font-family: "Josefin Sans", sans-serif; font-size: 28pt; font-weight: 700; line-height: 1.1; margin-bottom: 6px; }
  .title-h3 { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 700; color: #111; margin-bottom: 20px; }
  .profile-h3 { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 300; color: #111; margin-bottom: 20px; }
  .contact { font-size: 9pt; color: #555; margin-bottom: 16px; }
  .presentation { font-size: 10pt; line-height: 1.6; text-align: justify; margin-bottom: 8px; }

  /* Info box (summary + experience list) */
  .info-box { background: #f5f5f5; padding: 16px 20px; margin-top: 20px; }
  .info-box-label { font-family: "Josefin Sans", sans-serif; font-size: 9pt; font-weight: 700; letter-spacing: 0.08em; color: #111; margin-bottom: 6px; }
  .info-box-body { font-family: "Open Sans", sans-serif; font-size: 10pt; color: #555; line-height: 1.6; margin-bottom: 14px; }
  .exp-summary-heading { margin-top: 4px; }
  .exp-summary-list { list-style: disc; padding-left: 18px; margin: 0; }
  .exp-summary-item { font-family: "Open Sans", sans-serif; font-size: 10pt; color: #555; line-height: 1.8; }

  /* Skills page */
  .name-h2 { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 700; line-height: 1.1; margin-bottom: 0; }
  .profile-h3 { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 300; color: #111; margin-bottom: 12px; }
  .skills-columns {
    column-count: 2;
    column-gap: 32px;
    margin-top: 8px;
  }

  /* Category blocks */
  .category-block { margin-bottom: 12px; page-break-inside: avoid; }
  .category-header { background: #f5f5f5; padding: 4px 10px; margin-bottom: 3px; }
  .category-title { font-family: "Josefin Sans", sans-serif; font-size: 10pt; font-weight: 700; letter-spacing: 0.04em; color: #111; }
  .skill-list { font-family: "Open Sans", sans-serif; font-size: 8pt; color: #333; line-height: 1.6; }

  /* Education */
  .section-h4 { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 700; margin-bottom: 12px; margin-top: 24px; }
  .edu-group { margin-bottom: 12px; page-break-inside: avoid; }
  .edu-label { font-family: "Josefin Sans", sans-serif; font-size: 12pt; font-weight: 700; color: #111; margin-bottom: 4px; }
  .edu-value { font-family: "Open Sans", sans-serif; font-size: 10pt; color: #333; line-height: 1.6; }

  /* Assignments page */
  .assignments-heading { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 700; margin-bottom: 16px; }
  .divider { border: none; border-top: 1px solid #e0e0e0; margin-bottom: 24px; }
  .assignments-list { display: flex; flex-direction: column; gap: 36px; }
  .assignment { page-break-inside: avoid; break-inside: avoid; padding-top: 4px; }
  .role-heading {
    font-family: "Josefin Sans", sans-serif;
    font-size: 14pt;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .subtitle { font-family: "Josefin Sans", sans-serif; font-size: 12pt; font-weight: 400; color: #111; margin-bottom: 10px; }
  .tech-box { background: #f5f5f5; padding: 10px 14px; margin-top: 14px; }
  .tech-line { margin-bottom: 6px; }
  .tech-line:last-child { margin-bottom: 0; }
  .tech-label { font-size: 8pt; font-weight: 700; letter-spacing: 0.05em; margin-right: 8px; }

  /* Utilities */
  .body2 { font-size: 10pt; line-height: 1.65; }
  .secondary { color: #555; }
  .justified { text-align: justify; margin-bottom: 10px; }
  .justified:last-of-type { margin-bottom: 0; }
</style>
</head>
<body>
  <!-- Page 1: Cover -->
  <div class="section section-break cover-section">
    <h1 class="name-h1">${escapeHtml(data.name)}</h1>
    ${data.consultantTitle ? `<h3 class="title-h3">${escapeHtml(data.consultantTitle)}</h3>` : ""}
    ${presentationHtml}
    ${(() => {
      const sorted = [...data.assignments].sort((a, b) => {
        if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
        return (b.start_date ?? "").toString().localeCompare((a.start_date ?? "").toString());
      });
      const highlighted = sorted.slice(0, 5);
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
          ${highlighted.map((a) => `<li class="exp-summary-item">${escapeHtml(a.role)} ${t.atClient} ${escapeHtml(a.client_name)}</li>`).join("")}
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
