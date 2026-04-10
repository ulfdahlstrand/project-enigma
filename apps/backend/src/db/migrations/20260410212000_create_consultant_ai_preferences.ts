import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("consultant_ai_preferences")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("employee_id", "uuid", (col) =>
      col.notNull().references("employees.id").onDelete("cascade").unique())
    .addColumn("prompt", "text")
    .addColumn("rules", "text")
    .addColumn("validators", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("consultant_ai_preferences").ifExists().execute();
}
