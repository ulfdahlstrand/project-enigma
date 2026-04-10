import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("azure_oid", "varchar(255)")
    .execute();

  await sql`
    create unique index users_azure_oid_unique
    on users (azure_oid)
    where azure_oid is not null
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("users_azure_oid_unique").ifExists().execute();
  await db.schema.alterTable("users").dropColumn("azure_oid").execute();
}
