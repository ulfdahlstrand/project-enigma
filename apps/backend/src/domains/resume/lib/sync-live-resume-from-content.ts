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
      summary: content.summary,
      language: content.language,
    })
    .where("id", "=", resumeId)
    .execute();
}
