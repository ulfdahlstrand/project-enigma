import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: backfill_resume_branches_and_commits
//
// For every existing resume row that does not yet have a branch, creates:
//   1. A default "main" branch (is_main = true, language from resume row).
//   2. An initial commit capturing the current live state of that resume
//      (fields + skills — assignments are not yet linked via branch_assignments
//      since per-branch assignment linking is introduced in Phase C).
//
// Idempotent: only processes resumes that have no branch yet.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  // Fetch all resumes that have no branch yet
  const resumes = await (db as Parameters<typeof up>[0])
    .selectFrom("resumes as r")
    .leftJoin("resume_branches as rb", "rb.resume_id", "r.id")
    .select([
      "r.id as resume_id",
      "r.title",
      "r.consultant_title",
      "r.presentation",
      "r.summary",
      "r.language",
    ])
    .where("rb.id", "is", null)
    .execute();

  if (resumes.length === 0) return;

  for (const resume of resumes) {
    // Fetch skills for this resume
    const skills = await (db as Parameters<typeof up>[0])
      .selectFrom("resume_skills")
      .select(["name", "level", "category", "sort_order"])
      .where("cv_id", "=", resume.resume_id)
      .orderBy("sort_order", "asc")
      .execute();

    const content = {
      title: resume.title,
      consultantTitle: resume.consultant_title,
      presentation: resume.presentation ?? [],
      summary: resume.summary,
      language: resume.language,
      skills: skills.map((s: { name: string; level: string | null; category: string | null; sort_order: number }) => ({
        name: s.name,
        level: s.level,
        category: s.category,
        sortOrder: s.sort_order,
      })),
      // Assignments are not backfilled here — per-branch assignment linking is
      // introduced in Phase C. Existing assignment data remains queryable via
      // assignments.resume_id until that migration runs.
      assignments: [],
    };

    // Insert the main branch with head_commit_id temporarily null
    const branch = await (db as Parameters<typeof up>[0])
      .insertInto("resume_branches")
      .values({
        resume_id: resume.resume_id,
        name: "main",
        language: resume.language,
        is_main: true,
        head_commit_id: null,
        forked_from_commit_id: null,
        created_by: null,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    // Insert the initial commit
    const commit = await (db as Parameters<typeof up>[0])
      .insertInto("resume_commits")
      .values({
        resume_id: resume.resume_id,
        branch_id: branch.id,
        parent_commit_id: null,
        content: JSON.stringify(content),
        message: "Initial version",
        created_by: null,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    // Point the branch HEAD at the initial commit
    await (db as Parameters<typeof up>[0])
      .updateTable("resume_branches")
      .set({ head_commit_id: commit.id })
      .where("id", "=", branch.id)
      .execute();
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Remove all backfilled commits and branches (those with message = "Initial version"
  // and no created_by). This is safe because Phase B introduces no user-created commits.
  await (db as Parameters<typeof up>[0])
    .deleteFrom("resume_commits")
    .where("message", "=", "Initial version")
    .where("created_by", "is", null)
    .execute();

  await (db as Parameters<typeof up>[0])
    .deleteFrom("resume_branches")
    .where("name", "=", "main")
    .where("created_by", "is", null)
    .execute();
}
