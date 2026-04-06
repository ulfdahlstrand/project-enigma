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

  await db.deleteFrom("resume_skills").where("resume_id", "=", resumeId).execute();
  await db.deleteFrom("resume_skill_groups").where("resume_id", "=", resumeId).execute();

  if (content.skills.length > 0) {
    const orderedGroups = (content.skillGroups.length > 0
      ? content.skillGroups
      : content.skills.reduce<Array<{ name: string; sortOrder: number }>>((acc, skill, index) => {
          const name = skill.category?.trim() || "Other";
          const existing = acc.find((group) => group.name === name);
          if (existing) {
            return acc;
          }
          return [...acc, { name, sortOrder: index }];
        }, []))
      .map((group) => ({
        name: group.name.trim() || "Other",
        sortOrder: group.sortOrder,
      }));

    const insertedGroups = await db
      .insertInto("resume_skill_groups")
      .values(orderedGroups.map((group) => ({
        resume_id: resumeId,
        name: group.name,
        sort_order: group.sortOrder,
      })))
      .returning(["id", "name"])
      .execute();

    const groupIds = new Map(insertedGroups.map((group) => [group.name, group.id]));

    await db
      .insertInto("resume_skills")
      .values(
        content.skills.map((skill) => ({
          resume_id: resumeId,
          group_id: groupIds.get(skill.category?.trim() || "Other")!,
          name: skill.name,
          sort_order: skill.sortOrder,
        }))
      )
      .execute();
  }
}
