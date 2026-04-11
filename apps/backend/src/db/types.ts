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
  profile_image_data_url: string | null;
  profile_image_original_data_url: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type UserRole = "admin" | "consultant";

export interface UserTable {
  id: Generated<string>;
  azure_oid: string | null;
  email: string;
  name: string;
  role: UserRole;
  created_at: Generated<Date>;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;

export type ExternalAIAuthorizationStatus = "pending" | "active" | "revoked" | "expired";

export interface ResumeTable {
  id: Generated<string>;
  employee_id: string;
  title: string;
  language: Generated<string>;
  is_main: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Resume = Selectable<ResumeTable>;
export type NewResume = Insertable<ResumeTable>;
export type ResumeUpdate = Updateable<ResumeTable>;


/** Identity-only record. Branch-specific content lives in resume snapshots. */
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
  education: Array<{
    type: EducationType;
    value: string;
    sortOrder: number;
  }>;
  skillGroups: Array<{
    name: string;
    sortOrder: number;
  }>;
  skills: Array<{
    name: string;
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
  /** Points to the commit's immutable tree in the Git-inspired content model. */
  tree_id: string | null;
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
  pending_decision: string | null;
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

export type AIRevisionSuggestionStatus =
  | "pending"
  | "accepted"
  | "dismissed"
  | "applied";

export interface AIRevisionSuggestionTable {
  id: Generated<string>;
  conversation_id: string;
  branch_id: string;
  work_item_id: string | null;
  suggestion_id: string;
  summary: string | null;
  title: string;
  description: string;
  section: string;
  assignment_id: string | null;
  suggested_text: string;
  status: AIRevisionSuggestionStatus;
  skills: unknown | null;
  skill_scope: unknown | null;
  payload: unknown | null;
  resolved_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type AIRevisionSuggestion = Selectable<AIRevisionSuggestionTable>;
export type NewAIRevisionSuggestion = Insertable<AIRevisionSuggestionTable>;
export type AIRevisionSuggestionUpdate = Updateable<AIRevisionSuggestionTable>;

// ---------------------------------------------------------------------------
// AI prompt configuration tables
// ---------------------------------------------------------------------------

export interface AIPromptCategoryTable {
  id: Generated<string>;
  key: string;
  title: string;
  description: string | null;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AIPromptDefinitionTable {
  id: Generated<string>;
  category_id: string;
  key: string;
  title: string;
  description: string | null;
  source_file: string;
  is_editable: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AIPromptFragmentTable {
  id: Generated<string>;
  prompt_definition_id: string;
  key: string;
  label: string;
  content: string;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ConsultantAIPreferencesTable {
  id: Generated<string>;
  employee_id: string;
  prompt: string | null;
  rules: string | null;
  validators: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ExternalAIClientTable {
  id: Generated<string>;
  key: string;
  title: string;
  description: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ExternalAIAuthorizationTable {
  id: Generated<string>;
  user_id: string;
  client_id: string;
  title: string | null;
  scopes: ColumnType<string[], string[], string[]>;
  status: ExternalAIAuthorizationStatus;
  last_used_at: Date | null;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ExternalAILoginChallengeTable {
  id: Generated<string>;
  authorization_id: string;
  challenge_code_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Generated<Date>;
}

export interface ExternalAIAccessTokenTable {
  id: Generated<string>;
  authorization_id: string;
  token_hash: string;
  refresh_token_hash: string | null;
  scopes: ColumnType<string[], string[], string[]>;
  expires_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
  created_at: Generated<Date>;
}

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
export type AIPromptCategory = Selectable<AIPromptCategoryTable>;
export type NewAIPromptCategory = Insertable<AIPromptCategoryTable>;
export type AIPromptCategoryUpdate = Updateable<AIPromptCategoryTable>;
export type AIPromptDefinition = Selectable<AIPromptDefinitionTable>;
export type NewAIPromptDefinition = Insertable<AIPromptDefinitionTable>;
export type AIPromptDefinitionUpdate = Updateable<AIPromptDefinitionTable>;
export type AIPromptFragment = Selectable<AIPromptFragmentTable>;
export type NewAIPromptFragment = Insertable<AIPromptFragmentTable>;
export type AIPromptFragmentUpdate = Updateable<AIPromptFragmentTable>;
export type ConsultantAIPreferences = Selectable<ConsultantAIPreferencesTable>;
export type NewConsultantAIPreferences = Insertable<ConsultantAIPreferencesTable>;
export type ConsultantAIPreferencesUpdate = Updateable<ConsultantAIPreferencesTable>;
export type ExternalAIClient = Selectable<ExternalAIClientTable>;
export type NewExternalAIClient = Insertable<ExternalAIClientTable>;
export type ExternalAIClientUpdate = Updateable<ExternalAIClientTable>;
export type ExternalAIAuthorization = Selectable<ExternalAIAuthorizationTable>;
export type NewExternalAIAuthorization = Insertable<ExternalAIAuthorizationTable>;
export type ExternalAIAuthorizationUpdate = Updateable<ExternalAIAuthorizationTable>;
export type ExternalAILoginChallenge = Selectable<ExternalAILoginChallengeTable>;
export type NewExternalAILoginChallenge = Insertable<ExternalAILoginChallengeTable>;
export type ExternalAIAccessToken = Selectable<ExternalAIAccessTokenTable>;
export type NewExternalAIAccessToken = Insertable<ExternalAIAccessTokenTable>;
export type ExternalAIAccessTokenUpdate = Updateable<ExternalAIAccessTokenTable>;


// ---------------------------------------------------------------------------
// Git-inspired content model — tree layer
// ---------------------------------------------------------------------------

export interface ResumeEntryTypeTable {
  id: Generated<string>;
  name: string;
  revision_table: string;
}

export interface ResumeTreeTable {
  id: Generated<string>;
  created_at: Generated<Date>;
}

export interface ResumeTreeEntryTable {
  id: Generated<string>;
  tree_id: string;
  entry_type: string;
  position: number;
}

export interface ResumeTreeEntryContentTable {
  entry_id: string;
  revision_id: string;
  revision_type: string;
}

// ---------------------------------------------------------------------------
// Git-inspired content model — revision tables
// ---------------------------------------------------------------------------

export interface ResumeMetadataRevisionTable {
  id: Generated<string>;
  title: string;
  language: string;
  created_at: Generated<Date>;
}

export interface ConsultantTitleRevisionTable {
  id: Generated<string>;
  value: string;
  created_at: Generated<Date>;
}

export interface PresentationRevisionTable {
  id: Generated<string>;
  paragraphs: string[];
  created_at: Generated<Date>;
}

export interface SummaryRevisionTable {
  id: Generated<string>;
  content: string;
  created_at: Generated<Date>;
}

export interface HighlightedItemRevisionTable {
  id: Generated<string>;
  items: string[];
  created_at: Generated<Date>;
}

export interface SkillGroupRevisionTable {
  id: Generated<string>;
  name: string;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
}

export interface SkillRevisionTable {
  id: Generated<string>;
  name: string;
  group_revision_id: string;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
}

export interface AssignmentRevisionTable {
  id: Generated<string>;
  assignment_id: string;
  client_name: string;
  role: string;
  description: Generated<string>;
  technologies: ColumnType<string[], string[], string[]>;
  keywords: string | null;
  start_date: Date;
  end_date: Date | null;
  is_current: Generated<boolean>;
  sort_order: number | null;
  created_at: Generated<Date>;
}

export interface EducationRevisionTable {
  id: Generated<string>;
  employee_id: string;
  type: EducationType;
  value: string;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
}

export type ResumeEntryType = Selectable<ResumeEntryTypeTable>;
export type ResumeTree = Selectable<ResumeTreeTable>;
export type NewResumeTree = Insertable<ResumeTreeTable>;
export type ResumeTreeEntry = Selectable<ResumeTreeEntryTable>;
export type NewResumeTreeEntry = Insertable<ResumeTreeEntryTable>;
export type ResumeTreeEntryContent = Selectable<ResumeTreeEntryContentTable>;
export type NewResumeTreeEntryContent = Insertable<ResumeTreeEntryContentTable>;
export type ResumeMetadataRevision = Selectable<ResumeMetadataRevisionTable>;
export type NewResumeMetadataRevision = Insertable<ResumeMetadataRevisionTable>;
export type ConsultantTitleRevision = Selectable<ConsultantTitleRevisionTable>;
export type NewConsultantTitleRevision = Insertable<ConsultantTitleRevisionTable>;
export type PresentationRevision = Selectable<PresentationRevisionTable>;
export type NewPresentationRevision = Insertable<PresentationRevisionTable>;
export type SummaryRevision = Selectable<SummaryRevisionTable>;
export type NewSummaryRevision = Insertable<SummaryRevisionTable>;
export type HighlightedItemRevision = Selectable<HighlightedItemRevisionTable>;
export type NewHighlightedItemRevision = Insertable<HighlightedItemRevisionTable>;
export type SkillGroupRevision = Selectable<SkillGroupRevisionTable>;
export type NewSkillGroupRevision = Insertable<SkillGroupRevisionTable>;
export type SkillRevision = Selectable<SkillRevisionTable>;
export type NewSkillRevision = Insertable<SkillRevisionTable>;
export type AssignmentRevision = Selectable<AssignmentRevisionTable>;
export type NewAssignmentRevision = Insertable<AssignmentRevisionTable>;
export type EducationRevision = Selectable<EducationRevisionTable>;
export type NewEducationRevision = Insertable<EducationRevisionTable>;

export interface Database {
  employees: EmployeeTable;
  users: UserTable;
  resumes: ResumeTable;
  resume_commits: ResumeCommitTable;
  resume_commit_parents: ResumeCommitParentTable;
  resume_branches: ResumeBranchTable;
  assignments: AssignmentTable;
  education: EducationTable;
  export_records: ExportRecordTable;
  ai_conversations: AIConversationTable;
  ai_messages: AIMessageTable;
  ai_message_deliveries: AIMessageDeliveryTable;
  ai_revision_work_items: AIRevisionWorkItemTable;
  ai_revision_suggestions: AIRevisionSuggestionTable;
  ai_prompt_categories: AIPromptCategoryTable;
  ai_prompt_definitions: AIPromptDefinitionTable;
  ai_prompt_fragments: AIPromptFragmentTable;
  consultant_ai_preferences: ConsultantAIPreferencesTable;
  external_ai_clients: ExternalAIClientTable;
  external_ai_authorizations: ExternalAIAuthorizationTable;
  external_ai_login_challenges: ExternalAILoginChallengeTable;
  external_ai_access_tokens: ExternalAIAccessTokenTable;
  user_sessions: UserSessionTable;
  // Git-inspired content model
  resume_entry_types: ResumeEntryTypeTable;
  resume_trees: ResumeTreeTable;
  resume_tree_entries: ResumeTreeEntryTable;
  resume_tree_entry_content: ResumeTreeEntryContentTable;
  resume_revision_metadata: ResumeMetadataRevisionTable;
  resume_revision_consultant_title: ConsultantTitleRevisionTable;
  resume_revision_presentation: PresentationRevisionTable;
  resume_revision_summary: SummaryRevisionTable;
  resume_revision_highlighted_item: HighlightedItemRevisionTable;
  resume_revision_skill_group: SkillGroupRevisionTable;
  resume_revision_skill: SkillRevisionTable;
  resume_revision_assignment: AssignmentRevisionTable;
  resume_revision_education: EducationRevisionTable;
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
