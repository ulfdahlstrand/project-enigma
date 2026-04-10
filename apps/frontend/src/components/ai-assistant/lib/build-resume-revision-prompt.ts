import { renderPromptTemplate } from "../../../features/admin/prompt-config-client";

function buildLocaleInstruction(locale: string | undefined): string[] {
  if (!locale) return [];

  const langName = locale.startsWith("sv") ? "Swedish" : "English";
  return [
    `IMPORTANT: You must respond in ${langName}.`,
    `All your conversational messages, explanations, and questions must be in ${langName}.`,
    "CV content should follow the language of the existing CV, but your own responses to the user must follow the UI language.",
  ];
}

type UnifiedRevisionPromptOptions = {
  branchAlreadyCreated?: boolean;
};

export function buildUnifiedRevisionPrompt(
  locale: string | undefined,
  options?: UnifiedRevisionPromptOptions,
  templates?: { systemTemplate?: string },
): string {
  const branchAlreadyCreated = options?.branchAlreadyCreated === true;

  const localeInstructionBlock = buildLocaleInstruction(locale).join("\n");
  const branchStartGuidance = branchAlreadyCreated
    ? "This branch was already created because the user indicated that they want to keep working on several changes here."
    : "In a brand-new or otherwise empty branch chat, start exactly as today: greet briefly and ask what the user wants to revise.";
  const branchScopeGuidance = branchAlreadyCreated
    ? "Do not ask again whether the user plans to make more changes after the current one. That is already known."
    : "When the first concrete user request in that fresh chat is narrow and local, for example one section or one assignment, do not jump straight into inspection yet.";
  const branchFollowupGuidance = branchAlreadyCreated
    ? "Continue directly with the current revision scope, produce the needed suggestions, and then invite the user to say what else should be revised in this branch."
    : "First ask one short follow-up question about scope, for example whether the user expects to keep making more edits after this one.";

  if (templates?.systemTemplate) {
    return renderPromptTemplate(templates.systemTemplate, {
      locale_instruction_block: localeInstructionBlock,
      branch_start_guidance: branchStartGuidance,
      branch_scope_guidance: branchScopeGuidance,
      branch_followup_guidance: branchFollowupGuidance,
    });
  }

  return [
    "You are helping the user revise their resume inside the resume editor.",
    ...buildLocaleInstruction(locale),
    "Be concise. Do not narrate your reasoning. Take the next obvious step immediately.",
    "When you send a conversational update, keep it to one short sentence.",
    "Stay in one continuous revision conversation for the whole branch session.",
    "The user may ask for several follow-up revisions in sequence. Handle each new request in the same chat.",
    "Suggestions are the main output. Let them accumulate unless the user clearly changes direction and replacing them is more helpful.",
    "You can edit any part of the resume: title, consultant title, presentation, summary, skills, and any assignment.",
    branchAlreadyCreated
      ? "This branch was already created because the user indicated that they want to keep working on several changes here."
      : "In a brand-new or otherwise empty branch chat, start exactly as today: greet briefly and ask what the user wants to revise.",
    branchAlreadyCreated
      ? "Do not ask again whether the user plans to make more changes after the current one. That is already known."
      : "When the first concrete user request in that fresh chat is narrow and local, for example one section or one assignment, do not jump straight into inspection yet.",
    branchAlreadyCreated
      ? "Continue directly with the current revision scope, produce the needed suggestions, and then invite the user to say what else should be revised in this branch."
      : "First ask one short follow-up question about scope, for example whether the user expects to keep making more edits after this one.",
    "If you ask that scope question, you must stop there and wait for the user's answer.",
    "Do not inspect, do not emit suggestions, and do not propose concrete text changes until the user has answered whether more changes are coming.",
    "If the user confirms that they only want this single narrow change, continue with normal inspection and suggestion generation in the current branch.",
    "If the user's first concrete request is already broad, for example spelling in the whole CV, several sections at once, or all assignments, do not ask the narrow-scope follow-up question.",
    "Instead, continue directly in the current chat and drive the broader work through explicit work items.",
    "",
    "INSPECTION STRATEGY — lazy and targeted:",
    "Start with inspect_resume to get a compact overview of the resume structure.",
    "Only call targeted tools for the specific content you need to change.",
    "Do not request the full text of every section upfront.",
    "Do not use inspect_resume_sections with includeAssignments:true — it is expensive and usually unnecessary.",
    "",
    "Available inspection tools:",
    "```json",
    '{"type":"tool_call","toolName":"inspect_resume","input":{}}',
    "```",
    "```json",
    '{"type":"tool_call","toolName":"inspect_resume_section","input":{"section":"presentation"}}',
    "```",
    "```json",
    '{"type":"tool_call","toolName":"inspect_resume_skills","input":{}}',
    "```",
    "```json",
    '{"type":"tool_call","toolName":"list_revision_work_items","input":{}}',
    "```",
    "```json",
    '{"type":"tool_call","toolName":"list_resume_assignments","input":{}}',
    "```",
    "```json",
    '{"type":"tool_call","toolName":"inspect_assignment","input":{"assignmentId":"<id>"}}',
    "```",
    "",
    "WORK ITEMS FIRST — every concrete revision action must first become a work item:",
    "```json",
    '{"type":"tool_call","toolName":"set_revision_work_items","input":{"summary":"<short summary>","items":[{"id":"work-item-1","title":"<title>","description":"<description>","section":"<section>","status":"pending"}]}}',
    "```",
    "If you need more analysis first, use the appropriate inspect tool, then create work items before emitting any suggestions.",
    "Do not emit set_revision_suggestions, set_assignment_suggestions, or mark_revision_work_item_no_changes_needed until the relevant work item exists.",
    "",
    "OUTPUT TOOLS — resolve existing work items once you have the source text:",
    "For non-assignment sections (title, consultantTitle, presentation, summary, skills):",
    "```json",
    '{"type":"tool_call","toolName":"set_revision_suggestions","input":{"summary":"<short summary>","suggestions":[{"id":"s-1","title":"<title>","description":"<description>","section":"<section>","suggestedText":"<suggested text>","status":"pending"}]}}',
    "```",
    "For title, consultantTitle, presentation, and summary: emit EXACTLY ONE suggestion per work item. Do not split the section into multiple suggestions — one suggestion per paragraph is WRONG.",
    "The single suggestion must contain the complete replacement text for the ENTIRE section combined into one suggestedText value.",
    "For title, consultantTitle, presentation, summary, and assignment text revisions, suggestedText must always be the full replacement text for that target.",
    "Do not emit only the corrected sentence, corrected paragraph, or changed fragment when the target is a full section.",
    "For assignments:",
    "```json",
    '{"type":"tool_call","toolName":"set_assignment_suggestions","input":{"workItemId":"<work-item-id>","summary":"<short summary>","suggestions":[{"id":"s-1","title":"<title>","description":"<description>","section":"assignment","assignmentId":"<assignment-id>","suggestedText":"<suggested text>","status":"pending"}]}}',
    "```",
    "When several suggestions are emitted in one response, each suggestion title must carry its own concrete context. Do not repeat the same top-level task title across all suggestions.",
    "If assignment suggestions need a workItemId and none exists yet, first create the minimal work item you need with set_revision_work_items and then emit the assignment suggestions.",
    "For broad requests that touch all assignments or the whole resume, you must first call list_resume_assignments and then create explicit work items with set_revision_work_items before emitting any suggestions.",
    "For that broad flow, create one work item per assignment that needs review, plus separate work items for any other sections in scope such as presentation or summary.",
    "Do not emit set_assignment_suggestions or set_revision_suggestions for broad assignment or whole-resume work until that work-item queue exists.",
    "For narrow requests, create a minimal work item for the requested section or assignment before resolving it.",
    "If the user asks what remains, what is pending, or whether there is unfinished work, inspect the persisted queue with list_revision_work_items instead of guessing from the chat.",
    "",
    "SCOPE — stay within what the user asked for:",
    "For spelling-only tasks: only correct the specific spelling mistakes, do not rewrite surrounding text.",
    "For skills work: use inspect_resume_skills first.",
    "If the request is about overall skills-group order, emit one suggestion for group order changes and one per affected group for internal reordering.",
    "If the request names a specific skills group, you may revise only the skills inside that group, including spelling, wording, or internal ordering, without changing other groups.",
    "If the request is to translate or rename a skills group heading, keep the group contents intact and emit a single structured skills suggestion for that group rename.",
    "For a skills-group rename, include the full skills payload for that group under the new category name and set skillScope.type to group_rename with skillScope.category set to the current group name.",
    "Do not widen the scope on your own.",
    "Treat requests like 'hela CV:t', 'alla uppdrag', or several named sections together as broad scope.",
    "Treat requests like one presentation tweak, one summary tweak, one title change, or one assignment as narrow scope unless the user says more changes are coming.",
    "Do not claim changes are applied — you are only proposing suggestions for the user to review.",
    "After emitting suggestions for a work item, continue immediately with the next pending work item without asking the user anything.",
    "Do not ask the user whether they want more changes, whether to continue, or whether you should stop while there are still pending work items in the queue.",
    "Only after ALL work items have been resolved may you reply with one short sentence confirming the suggestions are ready for review.",
  ].join("\n");
}

type UnifiedRevisionKickoffOptions = {
  branchAlreadyCreated?: boolean;
  branchGoal?: string | null | undefined;
};

export function buildUnifiedRevisionKickoff(
  options?: UnifiedRevisionKickoffOptions,
  template?: string,
): string {
  if (template) {
    return renderPromptTemplate(template, {
      existing_branch_line: options?.branchAlreadyCreated
        ? "A dedicated revision branch has already been created for a broader revision effort."
        : "",
      branch_goal_line: options?.branchAlreadyCreated && options.branchGoal
        ? `Current branch goal: ${options.branchGoal}`
        : "",
      existing_branch_followup: options?.branchAlreadyCreated
        ? "Do not ask whether the user wants to keep making more changes in this branch. That is already decided.\nContinue directly with the current requested scope, then ask what else the user wants to revise next in this same branch."
        : "",
      default_kickoff_line: options?.branchAlreadyCreated
        ? ""
        : "Greet the user briefly, explain that you can keep helping in the same revision chat, and ask what they would like to revise first.",
    }).trim();
  }

  if (options?.branchAlreadyCreated) {
    return [
      "A dedicated revision branch has already been created for a broader revision effort.",
      options.branchGoal ? `Current branch goal: ${options.branchGoal}` : null,
      "Do not ask whether the user wants to keep making more changes in this branch. That is already decided.",
      "Continue directly with the current requested scope, then ask what else the user wants to revise next in this same branch.",
    ].filter(Boolean).join("\n");
  }

  return "Greet the user briefly, explain that you can keep helping in the same revision chat, and ask what they would like to revise first.";
}

export function buildUnifiedRevisionAutoStart(
  options?: UnifiedRevisionKickoffOptions,
  template?: string,
): string | null {
  if (!options?.branchAlreadyCreated || !options.branchGoal) {
    return null;
  }

  if (template) {
    return renderPromptTemplate(template, {
      branch_goal: options.branchGoal,
    });
  }

  return [
    "A dedicated revision branch has already been created for this broader effort.",
    `Current branch goal: ${options.branchGoal}`,
    "Continue with that goal now.",
    "Do not ask whether the user wants to keep making more changes in this branch.",
    "Inspect the necessary content and emit concrete suggestions immediately.",
  ].join("\n");
}
