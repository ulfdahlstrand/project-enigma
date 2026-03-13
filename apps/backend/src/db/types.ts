import type { Generated, Insertable, Selectable, Updateable } from "kysely";

// ---------------------------------------------------------------------------
// Database interface
//
// Maps each PostgreSQL table name to its Kysely row type. This is the single
// source of truth for the TypeScript compiler — it is updated manually when
// migrations add, remove, or alter columns.
// ---------------------------------------------------------------------------

export interface EmployeeTable {
  id: Generated<string>;
  name: string;
  email: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type UserRole = "admin" | "consultant";

export interface UserTable {
  id: Generated<string>;
  google_sub: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: Generated<Date>;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;

export interface CvTable {
  id: Generated<string>;
  employee_id: string;
  title: string;
  summary: string | null;
  language: Generated<string>;
  is_main: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Cv = Selectable<CvTable>;
export type NewCv = Insertable<CvTable>;
export type CvUpdate = Updateable<CvTable>;

export interface CvSkillTable {
  id: Generated<string>;
  cv_id: string;
  name: string;
  level: string | null;
  category: string | null;
  sort_order: Generated<number>;
}

export type CvSkill = Selectable<CvSkillTable>;
export type NewCvSkill = Insertable<CvSkillTable>;
export type CvSkillUpdate = Updateable<CvSkillTable>;

export interface Database {
  employees: EmployeeTable;
  users: UserTable;
  cvs: CvTable;
  cv_skills: CvSkillTable;
}

// ---------------------------------------------------------------------------
// Utility types
//
// Derived from table interfaces using Kysely's built-in helpers:
//   - Selectable<T>  — shape of a row returned by SELECT
//   - Insertable<T>  — shape accepted by INSERT (omits Generated columns)
//   - Updateable<T>  — shape accepted by UPDATE (all fields optional)
// ---------------------------------------------------------------------------

export type Employee = Selectable<EmployeeTable>;
export type NewEmployee = Insertable<EmployeeTable>;
export type EmployeeUpdate = Updateable<EmployeeTable>;
