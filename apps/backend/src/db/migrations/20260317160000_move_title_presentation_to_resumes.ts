import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: move_title_presentation_to_resumes
//
// Moves consultant_title and presentation from the employees table to resumes,
// since these fields are per-resume (different variants/languages can have
// different titles and bios).
//
// resumes
//   consultant_title  — the consultant's professional title, e.g. "Tech Lead"
//   presentation      — array of bio paragraphs stored as JSONB
//
// employees
//   title             — DROPPED (moved to resumes.consultant_title)
//   presentation      — DROPPED (moved to resumes.presentation)
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resumes")
    .addColumn("consultant_title", "text")
    .execute();

  await db.schema
    .alterTable("resumes")
    .addColumn("presentation", "jsonb", (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`)
    )
    .execute();

  await db.schema
    .alterTable("employees")
    .dropColumn("title")
    .execute();

  await db.schema
    .alterTable("employees")
    .dropColumn("presentation")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("employees")
    .addColumn("title", "text")
    .execute();

  await db.schema
    .alterTable("employees")
    .addColumn("presentation", "jsonb", (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`)
    )
    .execute();

  await db.schema
    .alterTable("resumes")
    .dropColumn("presentation")
    .execute();

  await db.schema
    .alterTable("resumes")
    .dropColumn("consultant_title")
    .execute();
}
