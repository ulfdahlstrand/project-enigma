import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export type EducationType = "degree" | "certification" | "language";

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

export interface ResumeTable {
  id: Generated<string>;
  employee_id: string;
  title: string;
  consultant_title: string | null;
  presentation: Generated<string[]>;
  summary: string | null;
  language: Generated<string>;
  is_main: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Resume = Selectable<ResumeTable>;
export type NewResume = Insertable<ResumeTable>;
export type ResumeUpdate = Updateable<ResumeTable>;

export interface ResumeSkillTable {
  id: Generated<string>;
  cv_id: string;
  name: string;
  level: string | null;
  category: string | null;
  sort_order: Generated<number>;
}

export type ResumeSkill = Selectable<ResumeSkillTable>;
export type NewResumeSkill = Insertable<ResumeSkillTable>;
export type ResumeSkillUpdate = Updateable<ResumeSkillTable>;

/** Identity-only record. All mutable content lives in branch_assignments. */
export interface AssignmentTable {
  id: Generated<string>;
  employee_id: string;
  created_at: Generated<Date>;
  /** Soft-delete timestamp. Non-null means the assignment is deleted. */
  deleted_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

export interface EducationTable {
  id: Generated<string>;
  employee_id: string;
  type: EducationType;
  value: string;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Assignment = Selectable<AssignmentTable>;
export type NewAssignment = Insertable<AssignmentTable>;

export type Education = Selectable<EducationTable>;
export type NewEducation = Insertable<EducationTable>;
export type EducationUpdate = Updateable<EducationTable>;

export interface ExportRecordTable {
  id: Generated<string>;
  resume_id: string;
  employee_id: string;
  format: string;
  filename: string;
  exported_at: Generated<Date>;
  commit_id: string | null;
}

export type ExportRecord = Selectable<ExportRecordTable>;
export type NewExportRecord = Insertable<ExportRecordTable>;

// ---------------------------------------------------------------------------
// Resume versioning tables
// ---------------------------------------------------------------------------

/**
 * Full content snapshot stored in resume_commits.content (JSONB).
 * Captures everything needed to render or export the resume at a point in time.
 */
export interface ResumeCommitContent {
  title: string;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedItems: string[];
  language: string;
  skills: Array<{
    name: string;
    level: string | null;
    category: string | null;
    sortOrder: number;
  }>;
  assignments: Array<{
    assignmentId: string;
    clientName: string;
    role: string;
    description: string;
    startDate: string;
    endDate: string | null;
    technologies: string[];
    isCurrent: boolean;
    keywords: string | null;
    type: string | null;
    highlight: boolean;
    sortOrder: number | null;
  }>;
}

/**
 * Immutable snapshot of a resume branch at a point in time — analogous to a
 * git commit. Once inserted, a row is never updated.
 */
export interface ResumeCommitTable {
  id: Generated<string>;
  resume_id: string;
  /** Which branch this commit belongs to. SET NULL if the branch is deleted. */
  branch_id: string | null;
  /** Full resume snapshot. Read type is the parsed object; insert/update accept JSON string. */
  content: ColumnType<ResumeCommitContent, string, string>;
  message: Generated<string>;
  /** Short human-readable title for this commit (e.g. "ai(suggestion): …"). */
  title: Generated<string>;
  /** Optional extended description; empty string for most automated commits. */
  description: Generated<string>;
  created_by: string | null;
  created_at: Generated<Date>;
}

export type ResumeCommit = Selectable<ResumeCommitTable>;
export type NewResumeCommit = Insertable<ResumeCommitTable>;

export interface ResumeCommitParentTable {
  commit_id: string;
  parent_commit_id: string;
  /** Ordered parent list, Git-style. parent_order=0 is the primary parent. */
  parent_order: number;
  created_at: Generated<Date>;
}

export type ResumeCommitParent = Selectable<ResumeCommitParentTable>;
export type NewResumeCommitParent = Insertable<ResumeCommitParentTable>;

/**
 * Named variant of a resume — analogous to a git branch. Holds a pointer to
 * the HEAD commit and optionally the commit it was forked from.
 */
export interface ResumeBranchTable {
  id: Generated<string>;
  resume_id: string;
  name: string;
  language: string;
  is_main: Generated<boolean>;
  /** Latest commit on this branch. NULL for a freshly created empty branch. */
  head_commit_id: string | null;
  /** The commit this branch was forked from. NULL for the original main branch. */
  forked_from_commit_id: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
}

export type ResumeBranch = Selectable<ResumeBranchTable>;
export type NewResumeBranch = Insertable<ResumeBranchTable>;
export type ResumeBranchUpdate = Updateable<ResumeBranchTable>;

/**
 * Per-branch assignment content. Each row owns the full content for one
 * assignment on one branch — editing is branch-specific.
 */
export interface BranchAssignmentTable {
  id: Generated<string>;
  branch_id: string;
  assignment_id: string;
  // Content columns (branch-specific)
  client_name: string;
  role: string;
  description: Generated<string>;
  start_date: Date;
  end_date: Date | null;
  technologies: ColumnType<string[], string[], string[]>;
  is_current: Generated<boolean>;
  keywords: string | null;
  type: string | null;
  // Curation columns
  highlight: Generated<boolean>;
  sort_order: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type BranchAssignment = Selectable<BranchAssignmentTable>;
export type NewBranchAssignment = Insertable<BranchAssignmentTable>;
export type BranchAssignmentUpdate = Updateable<BranchAssignmentTable>;

// ---------------------------------------------------------------------------
// AI assistant tables
// ---------------------------------------------------------------------------

export type AIMessageRole = "user" | "assistant";
export type AIMessageDeliveryKind =
  | "visible_message"
  | "internal_message"
  | "tool_call"
  | "tool_result";
export type AIRevisionWorkItemStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "no_changes_needed"
  | "failed"
  | "blocked";

export interface AIConversationTable {
  id: Generated<string>;
  created_by: string;
  entity_type: string;
  entity_id: string;
  system_prompt: Generated<string>;
  title: string | null;
  is_closed: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type AIConversation = Selectable<AIConversationTable>;
export type NewAIConversation = Insertable<AIConversationTable>;

export interface AIMessageTable {
  id: Generated<string>;
  conversation_id: string;
  role: AIMessageRole;
  content: string;
  created_at: Generated<Date>;
}

export type AIMessage = Selectable<AIMessageTable>;
export type NewAIMessage = Insertable<AIMessageTable>;

export interface AIMessageDeliveryTable {
  id: Generated<string>;
  conversation_id: string;
  ai_message_id: string | null;
  kind: AIMessageDeliveryKind;
  role: string | null;
  content: string | null;
  tool_name: string | null;
  payload: unknown | null;
  created_at: Generated<Date>;
}

export type AIMessageDelivery = Selectable<AIMessageDeliveryTable>;
export type NewAIMessageDelivery = Insertable<AIMessageDeliveryTable>;

export interface AIRevisionWorkItemTable {
  id: Generated<string>;
  conversation_id: string;
  branch_id: string;
  work_item_id: string;
  title: string;
  description: string;
  section: string;
  assignment_id: string | null;
  status: AIRevisionWorkItemStatus;
  note: string | null;
  position: number;
  attempt_count: Generated<number>;
  last_error: string | null;
  payload: unknown | null;
  completed_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type AIRevisionWorkItem = Selectable<AIRevisionWorkItemTable>;
export type NewAIRevisionWorkItem = Insertable<AIRevisionWorkItemTable>;
export type AIRevisionWorkItemUpdate = Updateable<AIRevisionWorkItemTable>;

// ---------------------------------------------------------------------------
// user_sessions table
// ---------------------------------------------------------------------------

export interface UserSessionTable {
  id: Generated<string>;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  logged_in_at: Generated<Date>;
  last_seen_at: Generated<Date>;
  expires_at: Date;
  refresh_token_hash: string | null;
  revoked_at: Date | null;
}

export type UserSession = Selectable<UserSessionTable>;
export type NewUserSession = Insertable<UserSessionTable>;
export type UserSessionUpdate = Updateable<UserSessionTable>;

export interface ResumeHighlightedItemTable {
  id: Generated<string>;
  resume_id: string;
  text: string;
  sort_order: Generated<number>;
}

export type ResumeHighlightedItem = Selectable<ResumeHighlightedItemTable>;
export type NewResumeHighlightedItem = Insertable<ResumeHighlightedItemTable>;

export interface Database {
  employees: EmployeeTable;
  resume_highlighted_items: ResumeHighlightedItemTable;
  users: UserTable;
  resumes: ResumeTable;
  resume_skills: ResumeSkillTable;
  resume_commits: ResumeCommitTable;
  resume_commit_parents: ResumeCommitParentTable;
  resume_branches: ResumeBranchTable;
  branch_assignments: BranchAssignmentTable;
  assignments: AssignmentTable;
  education: EducationTable;
  export_records: ExportRecordTable;
  ai_conversations: AIConversationTable;
  ai_messages: AIMessageTable;
  ai_message_deliveries: AIMessageDeliveryTable;
  ai_revision_work_items: AIRevisionWorkItemTable;
  user_sessions: UserSessionTable;
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
