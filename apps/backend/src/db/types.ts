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
  /** Points to the previous commit on this branch. NULL for the initial commit. */
  parent_commit_id: string | null;
  /** Full resume snapshot. Read type is the parsed object; insert/update accept JSON string. */
  content: ColumnType<ResumeCommitContent, string, string>;
  message: Generated<string>;
  created_by: string | null;
  created_at: Generated<Date>;
}

export type ResumeCommit = Selectable<ResumeCommitTable>;
export type NewResumeCommit = Insertable<ResumeCommitTable>;

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

// ---------------------------------------------------------------------------
// Resume revision workflow tables
// ---------------------------------------------------------------------------

export type ResumeRevisionWorkflowStatus = "active" | "completed" | "abandoned";

export type ResumeRevisionStepSection =
  | "discovery"
  | "consultant_title"
  | "presentation_summary"
  | "skills"
  | "assignments"
  | "highlighted_experience"
  | "consistency_polish";

export type ResumeRevisionStepStatus =
  | "pending"
  | "generating"
  | "reviewing"
  | "approved"
  | "needs_rework";

export interface ResumeRevisionWorkflowTable {
  id: Generated<string>;
  resume_id: string;
  /** Branch the workflow is revising from. */
  base_branch_id: string;
  /** Dedicated branch created to hold revision commits. NULL until first step starts. */
  revision_branch_id: string | null;
  created_by: string;
  status: Generated<ResumeRevisionWorkflowStatus>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type ResumeRevisionWorkflow = Selectable<ResumeRevisionWorkflowTable>;
export type NewResumeRevisionWorkflow = Insertable<ResumeRevisionWorkflowTable>;
export type ResumeRevisionWorkflowUpdate = Updateable<ResumeRevisionWorkflowTable>;

export interface ResumeRevisionWorkflowStepTable {
  id: Generated<string>;
  workflow_id: string;
  section: ResumeRevisionStepSection;
  step_order: number;
  status: Generated<ResumeRevisionStepStatus>;
  /** The proposal message the user accepted. NULL until the step is approved. */
  approved_message_id: string | null;
  /** Commit written to the revision branch on approval. NULL until approved. */
  commit_id: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type ResumeRevisionWorkflowStep = Selectable<ResumeRevisionWorkflowStepTable>;
export type NewResumeRevisionWorkflowStep = Insertable<ResumeRevisionWorkflowStepTable>;
export type ResumeRevisionWorkflowStepUpdate = Updateable<ResumeRevisionWorkflowStepTable>;

export interface ResumeRevisionMessageTable {
  id: Generated<string>;
  step_id: string;
  role: AIMessageRole;
  /** "text" for plain replies; "proposal" for AI-generated section proposals. */
  message_type: Generated<string>;
  content: string;
  /** Non-null on proposal messages — carries { originalContent, proposedContent, reasoning, changeSummary }. */
  structured_content: ColumnType<unknown, string, string> | null;
  created_at: Generated<Date>;
}

export type ResumeRevisionMessage = Selectable<ResumeRevisionMessageTable>;
export type NewResumeRevisionMessage = Insertable<ResumeRevisionMessageTable>;

/**
 * Typed payload stored in resume_revision_messages.structured_content (JSONB)
 * for proposal messages.
 */
export interface ResumeRevisionProposalContent {
  originalContent: unknown;
  proposedContent: unknown;
  reasoning: string | null;
  changeSummary: string | null;
}

/**
 * Typed payload stored when the discovery step is approved.
 * Passed as context to every subsequent step's AI prompt.
 */
export interface ResumeRevisionDiscoveryOutput {
  targetRole: string;
  tone: string;
  strengthsToEmphasise: string[];
  thingsToDownplay: string[];
  languagePreferences: string;
  additionalNotes: string;
}

export interface Database {
  employees: EmployeeTable;
  users: UserTable;
  resumes: ResumeTable;
  resume_skills: ResumeSkillTable;
  resume_commits: ResumeCommitTable;
  resume_branches: ResumeBranchTable;
  branch_assignments: BranchAssignmentTable;
  assignments: AssignmentTable;
  education: EducationTable;
  export_records: ExportRecordTable;
  ai_conversations: AIConversationTable;
  ai_messages: AIMessageTable;
  user_sessions: UserSessionTable;
  resume_revision_workflows: ResumeRevisionWorkflowTable;
  resume_revision_workflow_steps: ResumeRevisionWorkflowStepTable;
  resume_revision_messages: ResumeRevisionMessageTable;
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
