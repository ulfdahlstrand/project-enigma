import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { buildExportData } from "../lib/build-export-data.js";
import { getPdfTranslations } from "./pdf-translations.js";
import { toQuarter } from "@cv-tool/utils";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  Document,
  Footer,
  ImageRun,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  Packer,
  ShadingType,
  AlignmentType,
  PageBreak,
  WidthType,
  BorderStyle,
  SectionType,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PNG = readFileSync(join(__dirname, "sthlmtech_logo.png"));

// ---------------------------------------------------------------------------
// Design constants — mirror pdf-styles.ts values
//
// Fonts: Calibri (headings) + Cambria (body) replace Josefin Sans / Constantia
// because those fonts are not bundled on most systems and fall back to serifs.
// Calibri and Cambria ship with Microsoft Office on every platform.
// ---------------------------------------------------------------------------

const F_HEAD       = "Josefin Sans";       // headings, role titles, labels
const F_HEAD_LIGHT = "Josefin Sans Light"; // consultant title, Konsultprofil
const F_BODY       = "Constantia";         // presentation, assignment subtitles
const F_SANS       = "Calibri";            // skill lists, description, tech box values

const C_DARK = "111111";
const C_GRAY = "555555";
const C_SHADING = "F5F5F5";

// Font sizes in half-points (1 pt = 2 units)
const SZ_NAME = 48;  // 24 pt  (reference: name on cover)
const SZ_H2   = 44;  // 22 pt
const SZ_ROLE = 28;  // 14 pt
const SZ_SUB  = 24;  // 12 pt
const SZ_BODY = 20;  // 10 pt
const SZ_BODY2 = 22; // 11 pt  (reference: Calibri body/description)
const SZ_SM   = 18;  //  9 pt
const SZ_XS   = 16;  //  8 pt

// Spacing helper: points → twips (1 pt = 20 twips)
const SP = (pt: number) => pt * 20;

// PDF cover top space: 112px page-margin + 288px section padding → ≈ 228 pt
// (Puppeteer renders at 96 dpi: px / 96 × 72 = pt)
const COVER_TOP_SPACING = SP(228);

// ---------------------------------------------------------------------------
// Styled paragraph helpers — each mirrors a CSS class in pdf-styles.ts
// ---------------------------------------------------------------------------

/** .name-h1 — 28 pt Calibri bold, large top space to mirror PDF cover padding */
function nameH1(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: F_HEAD, size: SZ_NAME, bold: true, color: C_DARK })],
    spacing: { before: COVER_TOP_SPACING, after: SP(6) },
  });
}

/** .title-h3 — 22 pt Josefin Sans Light */
function titleH3(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: F_HEAD_LIGHT, size: SZ_H2, color: C_DARK })],
    spacing: { after: SP(20) },
  });
}

/** .contact — 9 pt gray */
function contactLine(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: F_BODY, size: SZ_SM, color: C_GRAY })],
    spacing: { after: SP(16) },
  });
}

/** .presentation — Calibri 11 pt */
function presentationPara(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: F_SANS, size: SZ_BODY2 })],
    alignment: AlignmentType.BOTH,
    spacing: { after: SP(8) },
  });
}

/** No-border style for table borders — removes all visible lines */
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;

/**
 * Info box — single-cell table with gray background.
 * Mirrors the PDF .info-box (background: #f5f5f5, padding: 16px 20px).
 * Using a table ensures all content shares one continuous gray rectangle.
 */
function buildInfoBox(params: {
  summary: string | null | undefined;
  highlights: string[];
  t: { specialSkillsHeading: string; experienceSummaryHeading: string };
}): Table {
  const cellChildren: Paragraph[] = [];

  if (params.summary) {
    cellChildren.push(
      new Paragraph({
        children: [new TextRun({ text: params.t.specialSkillsHeading, font: F_HEAD, size: SZ_SM, bold: true, color: C_DARK })],
        spacing: { after: SP(6) },
      })
    );
    cellChildren.push(
      new Paragraph({
        children: [new TextRun({ text: params.summary, font: F_SANS, size: SZ_BODY, color: C_DARK })],
        spacing: { after: SP(14) },
      })
    );
  }

  if (params.highlights.length > 0) {
    cellChildren.push(
      new Paragraph({
        children: [new TextRun({ text: params.t.experienceSummaryHeading, font: F_HEAD, size: SZ_SM, bold: true, color: C_DARK })],
        spacing: { after: SP(4) },
      })
    );
    for (const item of params.highlights) {
      cellChildren.push(
        new Paragraph({
          children: [new TextRun({ text: `\u2022  ${item}`, font: F_SANS, size: SZ_BODY, color: C_DARK })],
          spacing: { after: SP(2) },
          indent: { left: SP(6) },
        })
      );
    }
  }

  // Ensure at least one paragraph exists (required by TableCell)
  if (cellChildren.length === 0) {
    cellChildren.push(new Paragraph({ children: [] }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, fill: C_SHADING, color: C_SHADING },
            margins: { top: SP(8), bottom: SP(8), left: SP(10), right: SP(10) },
            children: cellChildren,
          }),
        ],
      }),
    ],
  });
}

/** .name-h2 — 22 pt bold heading at top of Skills page (no page break; section handles it) */
function sectionNameH2(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: F_HEAD, size: SZ_H2, bold: true, color: C_DARK })],
    spacing: { after: SP(0) },
  });
}

/** .profile-h3 — 22 pt Josefin Sans Light subtitle "Consultant profile" */
function profileSubtitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: F_HEAD_LIGHT, size: SZ_H2, color: C_DARK })],
    spacing: { after: SP(12) },
  });
}

/** .category-header — single-cell table with gray background */
function categoryHeader(cat: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, fill: "EFEFEF", color: "EFEFEF" },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cat.toUpperCase(),
                    font: F_HEAD,
                    size: SZ_SUB,
                    bold: true,
                    smallCaps: true,
                    color: C_DARK,
                  }),
                ],
                spacing: { before: SP(3), after: 0 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** .skill-list — 10 pt skill names joined by comma */
function skillList(names: string[]): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: names.join(", "), font: F_SANS, size: SZ_BODY, color: "333333" })],
    spacing: { after: SP(0) },
  });
}

/** .section-h4 — large education heading (Övrigt) */
function eduHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: F_HEAD, size: SZ_H2, bold: true, color: C_DARK })],
    spacing: { before: SP(40), after: SP(12) },
  });
}

/** .edu-label — 12 pt bold subgroup label (DEGREES / CERTIFICATIONS / LANGUAGES) */
function eduLabel(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: F_HEAD, size: SZ_SUB, bold: true, color: C_DARK })],
    spacing: { before: SP(8), after: SP(4) },
  });
}

/** .edu-value — 10 pt education item */
function eduValue(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: F_SANS, size: SZ_BODY, color: "333333" })],
    spacing: { after: SP(4) },
  });
}

/** .assignments-heading — 22 pt bold heading (no page break; section handles it) */
function assignmentsHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: F_HEAD, size: SZ_H2, bold: true, color: C_DARK })],
    spacing: { after: SP(16) },
  });
}

/** .role-heading — 14 pt bold uppercase */
function roleHeading(text: string, keepNext = false): Paragraph {
  return new Paragraph({
    keepNext,
    children: [new TextRun({ text: text.toUpperCase(), font: F_HEAD, size: SZ_ROLE, bold: true, color: C_DARK })],
    spacing: { before: SP(36), after: SP(4) },
  });
}

/** .subtitle — Josefin Sans 12 pt "Client Q3 2025 – Pågående" */
function assignmentSubtitle(text: string, keepNext = false): Paragraph {
  return new Paragraph({
    keepNext,
    children: [new TextRun({ text, font: F_HEAD, size: SZ_SUB, color: C_DARK })],
    spacing: { after: SP(10) },
  });
}

/** .body2.justified — Calibri 11 pt justified description paragraph (matches reference) */
function descParagraph(text: string, keepNext = false): Paragraph {
  return new Paragraph({
    keepNext,
    children: [new TextRun({ text, font: F_SANS, size: SZ_BODY2 })],
    alignment: AlignmentType.BOTH,
    spacing: { after: SP(10) },
  });
}

/** Tech box — single-cell table containing technologies and keywords rows */
function buildTechBox(rows: Array<{ label: string; value: string }>): Table {
  const cellChildren = rows.map(
    ({ label, value }) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${label} `, font: F_SANS, size: SZ_BODY, bold: true, color: C_DARK }),
          new TextRun({ text: value, font: F_SANS, size: SZ_BODY, color: C_DARK }),
        ],
        spacing: { before: SP(4), after: SP(4) },
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, fill: C_SHADING, color: C_SHADING },
            margins: { top: SP(4), bottom: SP(4), left: SP(8), right: SP(8) },
            children: cellChildren,
          }),
        ],
      }),
    ],
  });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Footer — SthlmTech logo right-aligned (mirrors PDF footer)
// ---------------------------------------------------------------------------

function buildFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new ImageRun({
            type: "png",
            data: LOGO_PNG,
            transformation: { width: 80, height: 60 },
          }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Core export logic
// ---------------------------------------------------------------------------

export async function exportResumeDocx(
  db: Kysely<Database>,
  user: AuthUser,
  resumeId: string,
  commitId?: string
): Promise<{ docx: string; filename: string; referenceId: string }> {
  const data = await buildExportData(db, user, resumeId, commitId);

  const { name, consultantTitle, language, presentation, summary, highlightedItems, skills, assignments, education } = data;
  const t = getPdfTranslations(language);

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Section 1 — Cover (single column, new page)
  // ---------------------------------------------------------------------------

  const coverChildren: Array<Paragraph | Table> = [];

  coverChildren.push(nameH1(name));
  if (consultantTitle) coverChildren.push(titleH3(consultantTitle));

  for (const para of presentation) {
    coverChildren.push(presentationPara(para));
  }

  // Info box — single-cell table, mirrors PDF .info-box
  // assignments is already sorted by buildExportData (is_current desc, start_date desc)
  const highlights = highlightedItems.length > 0
    ? highlightedItems
    : assignments.slice(0, 5).map((a) => `${a.role} ${t.atClient} ${a.client_name}`);

  if (Boolean(summary) || highlights.length > 0) {
    coverChildren.push(buildInfoBox({ summary, highlights, t }));
  }

  // ---------------------------------------------------------------------------
  // Section 2 — Skills page header: Name + "Konsultprofil" (single column, new page)
  // Section 3 — Skills + Education content (two columns, continuous after section 2)
  // ---------------------------------------------------------------------------

  // Pre-filter education groups — mirrors PDF's eduItems logic (only known types)
  const degrees = education.filter((e) => e.type === "degree").map((e) => e.value);
  const certs = education.filter((e) => e.type === "certification").map((e) => e.value);
  const langs = education.filter((e) => e.type === "language").map((e) => e.value);
  const hasEduContent = degrees.length > 0 || certs.length > 0 || langs.length > 0;
  const hasSkillsPage = skills.length > 0 || hasEduContent;

  const skillsHeaderChildren: Paragraph[] = [];
  const skillsContentChildren: Array<Paragraph | Table> = [];

  if (hasSkillsPage) {
    skillsHeaderChildren.push(sectionNameH2(name));
    skillsHeaderChildren.push(profileSubtitle(t.consultantProfile));
  }

  if (skills.length > 0) {
    const byCategory = new Map<string, string[]>();
    for (const s of skills) {
      const cat = s.category ?? "General";
      const existing = byCategory.get(cat) ?? [];
      byCategory.set(cat, [...existing, s.name]);
    }
    for (const [cat, names] of byCategory) {
      skillsContentChildren.push(categoryHeader(cat));
      skillsContentChildren.push(skillList(names));
      skillsContentChildren.push(new Paragraph({ children: [] }));
    }
  }

  if (hasEduContent) {
    skillsContentChildren.push(eduHeading(t.educationHeading));
    if (degrees.length > 0) {
      skillsContentChildren.push(eduLabel(t.degrees));
      for (const d of degrees) skillsContentChildren.push(eduValue(d));
    }
    if (certs.length > 0) {
      skillsContentChildren.push(eduLabel(t.certifications));
      for (const c of certs) skillsContentChildren.push(eduValue(c));
    }
    if (langs.length > 0) {
      skillsContentChildren.push(eduLabel(t.languages));
      for (const l of langs) skillsContentChildren.push(eduValue(l));
    }
  }

  // Ensure non-empty sections (required by docx)
  if (skillsHeaderChildren.length === 0) skillsHeaderChildren.push(new Paragraph({ children: [] }));
  if (skillsContentChildren.length === 0) skillsContentChildren.push(new Paragraph({ children: [] }));

  // ---------------------------------------------------------------------------
  // Section 4 — Assignments (single column, new page)
  // ---------------------------------------------------------------------------

  const assignmentChildren: Array<Paragraph | Table> = [];

  if (assignments.length > 0) {
    assignmentChildren.push(assignmentsHeading(t.experienceHeading));

    for (const a of assignments) {
      const startQ = toQuarter(a.start_date);
      const endQ = a.is_current ? t.present : (a.end_date ? toQuarter(a.end_date) : null);
      const period = endQ && endQ !== startQ ? `${startQ} \u2013 ${endQ}` : startQ;

      const descParas = a.description ? a.description.split(/\n+/).filter(Boolean) : [];
      const techRows: Array<{ label: string; value: string }> = [];
      if (a.technologies.length > 0) techRows.push({ label: t.technologies, value: a.technologies.join(", ") });
      if (a.keywords) techRows.push({ label: t.keywords, value: a.keywords });
      const hasTechBox = techRows.length > 0;

      // keepNext chains all items so the whole assignment stays on one page
      assignmentChildren.push(roleHeading(a.role, true));
      assignmentChildren.push(assignmentSubtitle(`${a.client_name} ${period}`, descParas.length > 0 || hasTechBox));

      for (let i = 0; i < descParas.length; i++) {
        const isLastItem = i === descParas.length - 1 && !hasTechBox;
        assignmentChildren.push(descParagraph(descParas[i]!, !isLastItem));
      }

      if (hasTechBox) assignmentChildren.push(buildTechBox(techRows));
    }
  }

  if (assignmentChildren.length === 0) assignmentChildren.push(new Paragraph({ children: [] }));

  const footer = buildFooter();

  const doc = new Document({
    sections: [
      // Section 1: Cover — single column
      {
        footers: { default: footer },
        properties: {},
        children: coverChildren,
      },
      // Section 2: Skills page header — full-width name + Konsultprofil
      {
        footers: { default: footer },
        properties: {},
        children: skillsHeaderChildren,
      },
      // Section 3: Skills + Education — two columns, continuous (same page as section 2)
      {
        footers: { default: footer },
        properties: {
          type: SectionType.CONTINUOUS,
          column: { count: 2, space: SP(32) },
        },
        children: skillsContentChildren,
      },
      // Section 4: Assignments — single column, new page
      {
        footers: { default: footer },
        properties: {},
        children: assignmentChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `${slug(name)}-${language}-cv.docx`;

  const record = await db
    .insertInto("export_records")
    .values({
      resume_id: resumeId,
      employee_id: data.employeeId,
      format: "docx",
      filename,
      ...(data.commitId !== null ? { commit_id: data.commitId } : {}),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return {
    docx: buffer.toString("base64"),
    filename,
    referenceId: record.id,
  };
}

// ---------------------------------------------------------------------------
// oRPC handlers
// ---------------------------------------------------------------------------

export const exportResumeDocxHandler = implement(
  contract.exportResumeDocx
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return exportResumeDocx(getDb(), user, input.resumeId, input.commitId);
});
