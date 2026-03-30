import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";

export async function syncLiveResumeFromContent(
  db: Kysely<Database>,
  resumeId: string,
  content: ResumeCommitContent
) {
  await db
    .updateTable("resumes")
    .set({
      title: content.title,
      consultant_title: content.consultantTitle,
      presentation: sql`${JSON.stringify(content.presentation)}::jsonb` as unknown as string[],
      summary: content.summary,
      language: content.language,
    })
    .where("id", "=", resumeId)
    .execute();

  await db.deleteFrom("resume_skills").where("cv_id", "=", resumeId).execute();

  if (content.skills.length > 0) {
    await db
      .insertInto("resume_skills")
      .values(
        content.skills.map((skill) => ({
          cv_id: resumeId,
          name: skill.name,
          level: skill.level,
          category: skill.category,
          sort_order: skill.sortOrder,
        }))
      )
      .execute();
  }
}
