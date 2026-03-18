import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: backfill_resume_branches_and_commits
//
// For every existing resume row that does not yet have a branch, creates:
//   1. A default "main" branch (is_main = true, language from resume row).
//   2. An initial commit capturing the current live state of that resume
//      (fields + skills — assignments are not yet linked via branch_assignments
//      since per-branch assignment linking is introduced in Phase C).
//
// Uses raw SQL throughout to avoid coupling to the Kysely typed query builder
// (migrations accept Kysely<unknown> which has no table type information).
//
// Idempotent: only processes resumes that have no branch yet.
// ---------------------------------------------------------------------------

interface ResumeRow {
  resume_id: string;
  title: string;
  consultant_title: string | null;
  presentation: string[];
  summary: string | null;
  language: string;
}

interface SkillRow {
  name: string;
  level: string | null;
  category: string | null;
  sort_order: number;
}

interface IdRow {
  id: string;
}

export async function up(db: Kysely<unknown>): Promise<void> {
  // Fetch all resumes that have no branch yet
  const resumes = await sql<ResumeRow>`
    SELECT r.id AS resume_id, r.title, r.consultant_title, r.presentation,
           r.summary, r.language
    FROM resumes r
    LEFT JOIN resume_branches rb ON rb.resume_id = r.id
    WHERE rb.id IS NULL
  `.execute(db);

  if (resumes.rows.length === 0) return;

  for (const resume of resumes.rows) {
    const skills = await sql<SkillRow>`
      SELECT name, level, category, sort_order
      FROM resume_skills
      WHERE cv_id = ${resume.resume_id}
      ORDER BY sort_order ASC
    `.execute(db);

    const content = JSON.stringify({
      title: resume.title,
      consultantTitle: resume.consultant_title,
      presentation: resume.presentation ?? [],
      summary: resume.summary,
      language: resume.language,
      skills: skills.rows.map((s) => ({
        name: s.name,
        level: s.level,
        category: s.category,
        sortOrder: s.sort_order,
      })),
      // Assignments are not backfilled here — per-branch assignment linking is
      // introduced in Phase C. Existing assignment data remains queryable via
      // assignments.resume_id until that migration runs.
      assignments: [],
    });

    // Insert branch with head_commit_id temporarily null
    const branchResult = await sql<IdRow>`
      INSERT INTO resume_branches (resume_id, name, language, is_main, head_commit_id, forked_from_commit_id, created_by)
      VALUES (${resume.resume_id}, 'main', ${resume.language}, true, NULL, NULL, NULL)
      RETURNING id
    `.execute(db);

    const branchId = branchResult.rows[0]?.id;
    if (!branchId) throw new Error(`Failed to insert branch for resume ${resume.resume_id}`);

    // Insert initial commit
    const commitResult = await sql<IdRow>`
      INSERT INTO resume_commits (resume_id, branch_id, parent_commit_id, content, message, created_by)
      VALUES (${resume.resume_id}, ${branchId}, NULL, ${content}::jsonb, 'Initial version', NULL)
      RETURNING id
    `.execute(db);

    const commitId = commitResult.rows[0]?.id;
    if (!commitId) throw new Error(`Failed to insert commit for resume ${resume.resume_id}`);

    // Point branch HEAD at the initial commit
    await sql`
      UPDATE resume_branches SET head_commit_id = ${commitId} WHERE id = ${branchId}
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Remove all backfilled commits and branches (message = "Initial version", no created_by).
  await sql`
    DELETE FROM resume_commits WHERE message = 'Initial version' AND created_by IS NULL
  `.execute(db);

  await sql`
    DELETE FROM resume_branches WHERE name = 'main' AND created_by IS NULL
  `.execute(db);
}
