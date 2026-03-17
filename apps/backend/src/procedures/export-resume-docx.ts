import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  BorderStyle,
  AlignmentType,
} from "docx";

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

function heading1(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
}

function heading2(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
}

function heading3(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3 });
}

function body(text: string): Paragraph {
  return new Paragraph({ text });
}

function boldLabel(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  });
}

function divider(): Paragraph {
  return new Paragraph({
    text: "",
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } },
  });
}

function empty(): Paragraph {
  return new Paragraph({ text: "" });
}

// ---------------------------------------------------------------------------
// Core export logic
// ---------------------------------------------------------------------------

export async function exportResumeDocx(
  db: Kysely<Database>,
  user: AuthUser,
  resumeId: string
): Promise<{ docx: string; filename: string; referenceId: string }> {
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

  const paragraphs: Paragraph[] = [];

  // --- Header ---
  const headerText = consultantTitle ? `${name} — ${consultantTitle}` : name;
  paragraphs.push(heading1(headerText));

  if (employee?.email) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: employee.email, color: "555555" })],
      })
    );
  }

  paragraphs.push(empty());

  // --- Presentation ---
  if (presentation.length > 0) {
    paragraphs.push(heading2("About"));
    for (const para of presentation) {
      paragraphs.push(body(para));
      paragraphs.push(empty());
    }
  }

  // --- Summary ---
  if (resume.summary) {
    paragraphs.push(heading2("Summary"));
    paragraphs.push(body(resume.summary));
    paragraphs.push(empty());
  }

  // --- Skills ---
  if (skills.length > 0) {
    paragraphs.push(heading2("Skills"));
    const byCategory = new Map<string, string[]>();
    for (const s of skills) {
      const cat = s.category ?? "General";
      const existing = byCategory.get(cat) ?? [];
      existing.push(s.name);
      byCategory.set(cat, existing);
    }
    for (const [cat, names] of byCategory) {
      paragraphs.push(boldLabel(cat, names.join(", ")));
    }
    paragraphs.push(empty());
  }

  // --- Experience ---
  if (assignments.length > 0) {
    paragraphs.push(heading2("Experience"));
    for (const a of assignments) {
      const period = `${fmtDate(a.start_date)} – ${a.is_current ? "present" : fmtDate(a.end_date)}`;
      paragraphs.push(heading3(`${a.role} @ ${a.client_name}`));
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: period, color: "555555", italics: true })],
        })
      );
      if (a.type) paragraphs.push(boldLabel("Type", a.type));
      const techs = (a.technologies as string[]) ?? [];
      if (techs.length > 0) paragraphs.push(boldLabel("Technologies", techs.join(", ")));
      if (a.keywords) paragraphs.push(boldLabel("Keywords", a.keywords));
      if (a.description) paragraphs.push(body(a.description));
      paragraphs.push(empty());
    }
  }

  // --- Education ---
  const degrees = education.filter((e) => e.type === "degree").map((e) => e.value);
  const certs = education.filter((e) => e.type === "certification").map((e) => e.value);
  const langs = education.filter((e) => e.type === "language").map((e) => e.value);

  if (degrees.length > 0 || certs.length > 0 || langs.length > 0) {
    paragraphs.push(heading2("Education"));
    if (degrees.length > 0) {
      paragraphs.push(heading3("Degrees"));
      for (const d of degrees) paragraphs.push(body(`• ${d}`));
      paragraphs.push(empty());
    }
    if (certs.length > 0) {
      paragraphs.push(heading3("Certifications"));
      for (const c of certs) paragraphs.push(body(`• ${c}`));
      paragraphs.push(empty());
    }
    if (langs.length > 0) {
      paragraphs.push(heading3("Languages"));
      for (const l of langs) paragraphs.push(body(`• ${l}`));
      paragraphs.push(empty());
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `${slug(name)}-${language}-cv.docx`;

  const record = await db
    .insertInto("export_records")
    .values({
      resume_id: resume.id,
      employee_id: resume.employee_id,
      format: "docx",
      filename,
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
  return exportResumeDocx(getDb(), user, input.resumeId);
});

export function createExportResumeDocxHandler(db: Kysely<Database>) {
  return implement(contract.exportResumeDocx).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return exportResumeDocx(db, user, input.resumeId);
    }
  );
}
