import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import type OpenAI from "openai";
import { sql } from "kysely";
import { getDb } from "../db/client.js";
import { createResume } from "../domains/resume/resume/create.js";
import { saveResumeVersion } from "../domains/resume/commit/save.js";
import { createScriptedOpenAI } from "./scripted-openai.js";
import { resetOpenAIClientForTests, setOpenAIClientForTests } from "../domains/ai/lib/openai-client.js";

const TEST_AUTH_ENABLED = process.env["ENABLE_TEST_AUTH"] === "true";
const DEFAULT_TEST_USER_ID = "40000000-0000-4000-8000-000000000001";

function getMessageText(
  content: Parameters<OpenAI["chat"]["completions"]["create"]>[0]["messages"][number]["content"] | undefined,
): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");
}

function parseJsonCodeFence(text: string): unknown | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/u);
  if (!match) {
    return null;
  }

  const json = match[1];
  if (!json) {
    return null;
  }

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeSkillCategory(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();
}

async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  return JSON.parse(Buffer.concat(chunks).toString()) as T;
}

function ensureEnabled(res: ServerResponse) {
  if (TEST_AUTH_ENABLED) {
    return true;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
  return false;
}

function buildSingleAssignmentRevisionScenario(assignmentId: string) {
  const calls: Array<Parameters<OpenAI["chat"]["completions"]["create"]>[0]> = [];

  const client = {
    chat: {
      completions: {
        create: async (input: Parameters<OpenAI["chat"]["completions"]["create"]>[0]) => {
          calls.push(input);
          const lastMessage = getMessageText(input.messages.at(-1)?.content);
          const systemMessage = getMessageText(input.messages[0]?.content);

          if (systemMessage.includes("You summarise conversations in 2–4 words")) {
            return {
              id: `chatcmpl-test-${calls.length}`,
              object: "chat.completion",
              created: Date.now(),
              model: typeof input.model === "string" ? input.model : "gpt-4o",
              choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Assignment revision" } }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
          }

          let content = "Assignment revision";

          if (
            lastMessage.includes("Help me plan a revision flow.")
            || lastMessage.includes("Greet the user briefly")
            || lastMessage.includes("what outcome they want from the revision")
          ) {
            content = "Hej! Jag kan hjälpa dig att planera revideringen.";
          } else if (
            lastMessage.includes("Fix spelling in my assignment")
            || lastMessage.includes("use the available tools for this stage")
          ) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume"')) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_revision_plan","input":{"summary":"Fix spelling in the Payer assignment","actions":[{"id":"action-payer","title":"Review Payer assignment","description":"Check the Payer assignment description for spelling issues.","status":"pending","assignmentId":"${assignmentId}"}]}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"set_revision_plan"')) {
            content = "The revision plan is ready for review.";
          } else if (
            lastMessage.includes("[[internal_autostart]]")
            || lastMessage.includes("Process only this work item now:")
          ) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"inspect_assignment","input":{"assignmentId":"${assignmentId}"}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"inspect_assignment"')) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_assignment_suggestions","input":{"workItemId":"action-payer","summary":"Suggested spelling fixes for the Payer assignment","suggestions":[{"id":"suggestion-payer","title":"Fix spelling in Payer assignment","description":"Correct the misspelled phrase in the assignment description.","section":"assignment","assignmentId":"${assignmentId}","suggestedText":"Detta uppdrag innehåller felstavningen faktureringsrelaterade API:ers.","status":"pending"}]}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"set_assignment_suggestions"')) {
            content = "Corrections proposed, ready for review.";
          }

          return {
            id: `chatcmpl-test-${calls.length}`,
            object: "chat.completion",
            created: Date.now(),
            model: typeof input.model === "string" ? input.model : "gpt-4o",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
        },
      },
    },
  } as unknown as OpenAI;

  return { client, calls };
}

function buildSinglePresentationRevisionScenario() {
  const calls: Array<Parameters<OpenAI["chat"]["completions"]["create"]>[0]> = [];

  const client = {
    chat: {
      completions: {
        create: async (input: Parameters<OpenAI["chat"]["completions"]["create"]>[0]) => {
          calls.push(input);
          const lastMessage = getMessageText(input.messages.at(-1)?.content);
          const systemMessage = getMessageText(input.messages[0]?.content);

          if (systemMessage.includes("You summarise conversations in 2–4 words")) {
            return {
              id: `chatcmpl-test-${calls.length}`,
              object: "chat.completion",
              created: Date.now(),
              model: typeof input.model === "string" ? input.model : "gpt-4o",
              choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Presentation revision" } }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
          }

          let content = "Presentation revision";

          if (
            lastMessage.includes("Help me plan a revision flow.")
            || lastMessage.includes("Greet the user briefly")
            || lastMessage.includes("what outcome they want from the revision")
          ) {
            content = "Hej! Jag kan hjälpa dig att planera revideringen.";
          } else if (
            lastMessage.includes("Fix spelling in the presentation")
            || lastMessage.includes("use the available tools for this stage")
          ) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume"')) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_revision_plan","input":{"summary":"Fix spelling in the presentation","actions":[{"id":"action-presentation","title":"Review presentation","description":"Check the presentation text for spelling issues.","status":"pending"}]}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"set_revision_plan"')) {
            content = "The revision plan is ready for review.";
          } else if (
            lastMessage.includes("[[internal_autostart]]")
            || lastMessage.includes("Process only this work item now:")
          ) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume_section","input":{"section":"presentation"}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume_section"')) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_revision_suggestions","input":{"summary":"Suggested spelling fix for the presentation","suggestions":[{"id":"suggestion-presentation","title":"Fix spelling in presentation","description":"Correct the misspelled word in the presentation.","section":"presentation","suggestedText":"Ulf är en teknisk ledare med lång erfarenhet av systemutveckling och avancerade tekniska roller.","status":"pending"}]}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"set_revision_suggestions"')) {
            content = "Corrections proposed, ready for review.";
          }

          return {
            id: `chatcmpl-test-${calls.length}`,
            object: "chat.completion",
            created: Date.now(),
            model: typeof input.model === "string" ? input.model : "gpt-4o",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
        },
      },
    },
  } as unknown as OpenAI;

  return { client, calls };
}

type SupportedSingleSection = "consultantTitle" | "presentation" | "summary" | "assignment";

function buildSingleSectionRevisionScenario(section: SupportedSingleSection, assignmentId?: string) {
  const calls: Array<Parameters<OpenAI["chat"]["completions"]["create"]>[0]> = [];

  const sectionLabelMap: Record<Exclude<SupportedSingleSection, "assignment">, string> = {
    consultantTitle: "consultant title",
    presentation: "presentation",
    summary: "summary",
  };

  const sectionActionMap: Record<Exclude<SupportedSingleSection, "assignment">, {
    actionId: string;
    title: string;
    description: string;
    inspectToolCall: string;
    suggestionTitle: string;
    suggestionDescription: string;
    suggestedText: string;
  }> = {
    consultantTitle: {
      actionId: "action-consultant-title",
      title: "Review consultant title",
      description: "Check the consultant title for spelling issues.",
      inspectToolCall: '{"type":"tool_call","toolName":"inspect_resume_section","input":{"section":"consultantTitle"}}',
      suggestionTitle: "Fix spelling in consultant title",
      suggestionDescription: "Correct the misspelled word in the consultant title.",
      suggestedText: "Tech Lead / Senior Engineer",
    },
    presentation: {
      actionId: "action-presentation",
      title: "Review presentation",
      description: "Check the presentation text for spelling issues.",
      inspectToolCall: '{"type":"tool_call","toolName":"inspect_resume_section","input":{"section":"presentation"}}',
      suggestionTitle: "Fix spelling in presentation",
      suggestionDescription: "Correct the misspelled word in the presentation.",
      suggestedText: "Ulf är en teknisk ledare med lång erfarenhet av systemutveckling och avancerade tekniska roller med felstavningen teknisk.",
    },
    summary: {
      actionId: "action-summary",
      title: "Review summary",
      description: "Check the summary text for spelling issues.",
      inspectToolCall: '{"type":"tool_call","toolName":"inspect_resume_section","input":{"section":"summary"}}',
      suggestionTitle: "Fix spelling in summary",
      suggestionDescription: "Correct the misspelled word in the summary.",
      suggestedText: "Senior engineer with korrekt summary text.",
    },
  };

  const client = {
    chat: {
      completions: {
        create: async (input: Parameters<OpenAI["chat"]["completions"]["create"]>[0]) => {
          calls.push(input);
          const lastMessage = getMessageText(input.messages.at(-1)?.content);
          const systemMessage = getMessageText(input.messages[0]?.content);

          if (systemMessage.includes("You summarise conversations in 2–4 words")) {
            return {
              id: `chatcmpl-test-${calls.length}`,
              object: "chat.completion",
              created: Date.now(),
              model: typeof input.model === "string" ? input.model : "gpt-4o",
              choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Section revision" } }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
          }

          let content = "Section revision";

          if (
            lastMessage.includes("Help me plan a revision flow.")
            || lastMessage.includes("Greet the user briefly")
            || lastMessage.includes("what outcome they want from the revision")
          ) {
            content = "Hej! Jag kan hjälpa dig att planera revideringen.";
          } else if (lastMessage.includes("use the available tools for this stage") || lastMessage.toLowerCase().includes("fix spelling")) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume"')) {
            if (section === "assignment") {
              content = `\`\`\`json
{"type":"tool_call","toolName":"set_revision_plan","input":{"summary":"Fix spelling in the assignment","actions":[{"id":"action-assignment","title":"Review assignment","description":"Check the assignment description for spelling issues.","assignmentId":"${assignmentId}","status":"pending"}]}}
\`\`\``;
            } else {
              const sectionData = sectionActionMap[section];
              content = `\`\`\`json
{"type":"tool_call","toolName":"set_revision_plan","input":{"summary":"Fix spelling in the ${sectionLabelMap[section]}","actions":[{"id":"${sectionData.actionId}","title":"${sectionData.title}","description":"${sectionData.description}","status":"pending"}]}}
\`\`\``;
            }
          } else if (lastMessage.includes('"toolName":"set_revision_plan"')) {
            content = "The revision plan is ready for review.";
          } else if (
            lastMessage.includes("[[internal_autostart]]")
            || lastMessage.includes("Process only this work item now:")
          ) {
            if (section === "assignment") {
              content = `\`\`\`json
{"type":"tool_call","toolName":"inspect_assignment","input":{"assignmentId":"${assignmentId}"}}
\`\`\``;
            } else {
              content = `\`\`\`json
${sectionActionMap[section].inspectToolCall}
\`\`\``;
            }
          } else if (lastMessage.includes('"toolName":"inspect_assignment"')) {
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_assignment_suggestions","input":{"workItemId":"action-assignment","summary":"Suggested spelling fix for the assignment","suggestions":[{"id":"suggestion-assignment","title":"Fix spelling in assignment","description":"Correct the misspelled phrase in the assignment description.","section":"assignment","assignmentId":"${assignmentId}","suggestedText":"Detta uppdrag innehåller felstavningen faktureringsrelaterade API:ers.","status":"pending"}]}}
\`\`\``;
          } else if (lastMessage.includes('"toolName":"inspect_resume_section"')) {
            const sectionData = sectionActionMap[section as Exclude<SupportedSingleSection, "assignment">];
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_revision_suggestions","input":{"summary":"Suggested spelling fix for the ${sectionLabelMap[section as Exclude<SupportedSingleSection, "assignment">]}","suggestions":[{"id":"suggestion-${section}","title":"${sectionData.suggestionTitle}","description":"${sectionData.suggestionDescription}","section":"${section}","suggestedText":"${sectionData.suggestedText}","status":"pending"}]}}
\`\`\``;
          } else if (
            lastMessage.includes('"toolName":"set_revision_suggestions"')
            || lastMessage.includes('"toolName":"set_assignment_suggestions"')
          ) {
            content = "Corrections proposed, ready for review.";
          }

          return {
            id: `chatcmpl-test-${calls.length}`,
            object: "chat.completion",
            created: Date.now(),
            model: typeof input.model === "string" ? input.model : "gpt-4o",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
        },
      },
    },
  } as unknown as OpenAI;

  return { client, calls };
}

function buildWholeCvRevisionScenario(assignmentIds: string[]) {
  const calls: Array<Parameters<OpenAI["chat"]["completions"]["create"]>[0]> = [];

  const actions = [
    { id: "action-consultant-title", title: "Review consultant title", description: "Check the consultant title for spelling issues." },
    { id: "action-presentation", title: "Review presentation", description: "Check the presentation text for spelling issues." },
    { id: "action-summary", title: "Review summary", description: "Check the summary text for spelling issues." },
    ...assignmentIds.map((assignmentId, index) => ({
      id: `action-assignment-${index + 1}`,
      title: `Review assignment ${index + 1}`,
      description: `Check assignment ${index + 1} for spelling issues.`,
      assignmentId,
    })),
  ];

  const client = {
    chat: {
      completions: {
        create: async (input: Parameters<OpenAI["chat"]["completions"]["create"]>[0]) => {
          calls.push(input);
          const lastMessage = getMessageText(input.messages.at(-1)?.content);
          const systemMessage = getMessageText(input.messages[0]?.content);

          if (systemMessage.includes("You summarise conversations in 2–4 words")) {
            return {
              id: `chatcmpl-test-${calls.length}`,
              object: "chat.completion",
              created: Date.now(),
              model: typeof input.model === "string" ? input.model : "gpt-4o",
              choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Whole CV revision" } }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
          }

          let content = "Whole CV revision";

          if (
            lastMessage.includes("Help me plan a revision flow.")
            || lastMessage.includes("Greet the user briefly")
            || lastMessage.includes("what outcome they want from the revision")
          ) {
            content = "Hej! Jag kan hjälpa dig att planera revideringen.";
          } else if (lastMessage.includes("use the available tools for this stage") || lastMessage.toLowerCase().includes("fix all spelling")) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume"')) {
            content = [
              "```json",
              JSON.stringify({
                type: "tool_call",
                toolName: "set_revision_plan",
                input: {
                  summary: "Fix spelling across the whole CV",
                  actions: actions.map((action) => ({ ...action, status: "pending" })),
                },
              }),
              "```",
            ].join("\n");
          } else if (lastMessage.includes('"toolName":"set_revision_plan"')) {
            content = "The revision plan is ready for review.";
          } else if (lastMessage.includes("Process only this work item now: action-consultant-title")) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume_section","input":{"section":"consultantTitle"}}\n```';
          } else if (lastMessage.includes("Process only this work item now: action-presentation")) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume_section","input":{"section":"presentation"}}\n```';
          } else if (lastMessage.includes("Process only this work item now: action-summary")) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume_section","input":{"section":"summary"}}\n```';
          } else if (lastMessage.includes("Process only this work item now: action-assignment-")) {
            const matchedAssignment = actions.find(
              (action): action is (typeof actions)[number] & { assignmentId: string } =>
                "assignmentId" in action && lastMessage.includes(action.id),
            );
            content = `\`\`\`json
{"type":"tool_call","toolName":"inspect_assignment","input":{"assignmentId":"${matchedAssignment?.assignmentId ?? assignmentIds[0]}"}}
\`\`\``;
          } else if (
            lastMessage.includes('"toolName":"set_revision_suggestions"')
            || lastMessage.includes('"toolName":"set_assignment_suggestions"')
          ) {
            content = "Corrections proposed, ready for review.";
          } else if (lastMessage.includes('"section":"consultantTitle"')) {
            content = '```json\n{"type":"tool_call","toolName":"set_revision_suggestions","input":{"summary":"Fix consultant title spelling","suggestions":[{"id":"suggestion-consultant-title","title":"Fix spelling in consultant title","description":"Correct the misspelled word in the consultant title.","section":"consultantTitle","suggestedText":"Tech Lead / Senior Engineer","status":"pending"}]}}\n```';
          } else if (lastMessage.includes('"section":"presentation"')) {
            content = '```json\n{"type":"tool_call","toolName":"set_revision_suggestions","input":{"summary":"Fix presentation spelling","suggestions":[{"id":"suggestion-presentation","title":"Fix spelling in presentation","description":"Correct the misspelled word in the presentation.","section":"presentation","suggestedText":"Ulf är en teknisk ledare med lång erfarenhet av systemutveckling och avancerade tekniska roller med felstavningen teknisk.","status":"pending"}]}}\n```';
          } else if (lastMessage.includes('"section":"summary"')) {
            content = '```json\n{"type":"tool_call","toolName":"set_revision_suggestions","input":{"summary":"Fix summary spelling","suggestions":[{"id":"suggestion-summary","title":"Fix spelling in summary","description":"Correct the misspelled word in the summary.","section":"summary","suggestedText":"Senior engineer with korrekt summary text.","status":"pending"}]}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_assignment"')) {
            const matchedAssignmentId = assignmentIds.find((assignmentId) => lastMessage.includes(assignmentId)) ?? assignmentIds[0];
            const matchedAction = actions.find(
              (action): action is (typeof actions)[number] & { assignmentId: string } =>
                "assignmentId" in action && action.assignmentId === matchedAssignmentId,
            );
            content = `\`\`\`json
{"type":"tool_call","toolName":"set_assignment_suggestions","input":{"workItemId":"${matchedAction?.id ?? "action-assignment-1"}","summary":"Fix assignment spelling","suggestions":[{"id":"suggestion-assignment-${matchedAssignmentId}","title":"Fix spelling in assignment","description":"Correct the misspelled phrase in the assignment description.","section":"assignment","assignmentId":"${matchedAssignmentId}","suggestedText":"Detta uppdrag innehåller felstavningen faktureringsrelaterade API:ers.","status":"pending"}]}}
\`\`\``;
          }

          return {
            id: `chatcmpl-test-${calls.length}`,
            object: "chat.completion",
            created: Date.now(),
            model: typeof input.model === "string" ? input.model : "gpt-4o",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
        },
      },
    },
  } as unknown as OpenAI;

  return { client, calls };
}

function buildSkillsPrioritizationRevisionScenario() {
  const calls: Array<Parameters<OpenAI["chat"]["completions"]["create"]>[0]> = [];

  const groupedSkillsReordered = [
    { name: "Systemarkitektur", level: null, category: "Ledarskap och arkitektur", sortOrder: 0 },
    { name: "Systemintegration", level: null, category: "Ledarskap och arkitektur", sortOrder: 1 },
    { name: "Teknisk projektledning", level: null, category: "Ledarskap och arkitektur", sortOrder: 2 },
    { name: "Testledning", level: null, category: "Ledarskap och arkitektur", sortOrder: 3 },
    { name: "Typescript", level: null, category: "Webbutveckling", sortOrder: 1000 },
    { name: "React", level: null, category: "Webbutveckling", sortOrder: 1001 },
    { name: "NodeJS", level: null, category: "Webbutveckling", sortOrder: 1002 },
    { name: "Tanstack Query", level: null, category: "Webbutveckling", sortOrder: 1003 },
    { name: "Enhetstest", level: null, category: "Test och kvalitet", sortOrder: 2000 },
    { name: "Test-driven development", level: null, category: "Test och kvalitet", sortOrder: 2001 },
    { name: "Acceptanstest", level: null, category: "Test och kvalitet", sortOrder: 2002 },
  ];

  const leadershipReordered = [
    { name: "Teknisk projektledning", level: null, category: "Ledarskap och arkitektur", sortOrder: 0 },
    { name: "Systemarkitektur", level: null, category: "Ledarskap och arkitektur", sortOrder: 1 },
    { name: "Testledning", level: null, category: "Ledarskap och arkitektur", sortOrder: 2 },
    { name: "Systemintegration", level: null, category: "Ledarskap och arkitektur", sortOrder: 3 },
    { name: "Typescript", level: null, category: "Webbutveckling", sortOrder: 1000 },
    { name: "React", level: null, category: "Webbutveckling", sortOrder: 1001 },
    { name: "NodeJS", level: null, category: "Webbutveckling", sortOrder: 1002 },
    { name: "Tanstack Query", level: null, category: "Webbutveckling", sortOrder: 1003 },
    { name: "Enhetstest", level: null, category: "Test och kvalitet", sortOrder: 2000 },
    { name: "Test-driven development", level: null, category: "Test och kvalitet", sortOrder: 2001 },
    { name: "Acceptanstest", level: null, category: "Test och kvalitet", sortOrder: 2002 },
  ];

  const webReordered = [
    { name: "Teknisk projektledning", level: null, category: "Ledarskap och arkitektur", sortOrder: 0 },
    { name: "Systemarkitektur", level: null, category: "Ledarskap och arkitektur", sortOrder: 1 },
    { name: "Testledning", level: null, category: "Ledarskap och arkitektur", sortOrder: 2 },
    { name: "Systemintegration", level: null, category: "Ledarskap och arkitektur", sortOrder: 3 },
    { name: "Typescript", level: null, category: "Webbutveckling", sortOrder: 1000 },
    { name: "NodeJS", level: null, category: "Webbutveckling", sortOrder: 1001 },
    { name: "React", level: null, category: "Webbutveckling", sortOrder: 1002 },
    { name: "Tanstack Query", level: null, category: "Webbutveckling", sortOrder: 1003 },
    { name: "Enhetstest", level: null, category: "Test och kvalitet", sortOrder: 2000 },
    { name: "Test-driven development", level: null, category: "Test och kvalitet", sortOrder: 2001 },
    { name: "Acceptanstest", level: null, category: "Test och kvalitet", sortOrder: 2002 },
  ];

  const reorderedSkills = [
    { name: "Teknisk projektledning", level: null, category: "Ledarskap och arkitektur", sortOrder: 0 },
    { name: "Systemarkitektur", level: null, category: "Ledarskap och arkitektur", sortOrder: 1 },
    { name: "Testledning", level: null, category: "Ledarskap och arkitektur", sortOrder: 2 },
    { name: "Systemintegration", level: null, category: "Ledarskap och arkitektur", sortOrder: 3 },
    { name: "Typescript", level: null, category: "Webbutveckling", sortOrder: 1000 },
    { name: "NodeJS", level: null, category: "Webbutveckling", sortOrder: 1001 },
    { name: "React", level: null, category: "Webbutveckling", sortOrder: 1002 },
    { name: "Tanstack Query", level: null, category: "Webbutveckling", sortOrder: 1003 },
    { name: "Test-driven development", level: null, category: "Test och kvalitet", sortOrder: 2000 },
    { name: "Enhetstest", level: null, category: "Test och kvalitet", sortOrder: 2001 },
    { name: "Acceptanstest", level: null, category: "Test och kvalitet", sortOrder: 2002 },
  ];

  const actionSuggestions = {
    "action-skill-groups": {
      summary: "Move leadership and architecture before the other skill groups",
      suggestion: {
        id: "action-skill-groups",
        title: "Prioritize skill group order",
        description: "Move the leadership and architecture group ahead of web development and test to make the management profile clearer.",
        section: "skills",
        suggestedText: "Ledarskap och arkitektur först, följt av Webbutveckling och Test och kvalitet.",
        skills: groupedSkillsReordered,
        skillScope: {
          type: "group_order",
        },
        status: "pending" as const,
      },
    },
    "action-skills-leadership": {
      summary: "Put the strongest leadership and architecture skills first",
      suggestion: {
        id: "action-skills-leadership",
        title: "Reorder leadership and architecture skills",
        description: "Sort the leadership and architecture group so the most managerial and strategic capabilities are listed first.",
        section: "skills",
        suggestedText: "Ledarskap och arkitektur: Teknisk projektledning, Systemarkitektur, Testledning, Systemintegration",
        skills: leadershipReordered,
        skillScope: {
          type: "group_contents",
          category: "Ledarskap och arkitektur",
        },
        status: "pending" as const,
      },
    },
    "action-skills-web": {
      summary: "Reorder the web development group",
      suggestion: {
        id: "action-skills-web",
        title: "Reorder web development skills",
        description: "Sort the web development group to foreground the strongest backend-leaning stack before the frontend framework details.",
        section: "skills",
        suggestedText: "Webbutveckling: Typescript, NodeJS, React, Tanstack Query",
        skills: webReordered,
        skillScope: {
          type: "group_contents",
          category: "Webbutveckling",
        },
        status: "pending" as const,
      },
    },
    "action-skills-test": {
      summary: "Reorder the test and quality group",
      suggestion: {
        id: "action-skills-test",
        title: "Reorder test and quality skills",
        description: "Sort the test and quality group so the methodology-first signal is clearer.",
        section: "skills",
        suggestedText: "Test och kvalitet: Test-driven development, Enhetstest, Acceptanstest",
        skills: reorderedSkills,
        skillScope: {
          type: "group_contents",
          category: "Test och kvalitet",
        },
        status: "pending" as const,
      },
    },
  } as const;

  const client = {
    chat: {
      completions: {
        create: async (input: Parameters<OpenAI["chat"]["completions"]["create"]>[0]) => {
          calls.push(input);
          const lastMessage = getMessageText(input.messages.at(-1)?.content);
          const systemMessage = getMessageText(input.messages[0]?.content);

          if (systemMessage.includes("You summarise conversations in 2–4 words")) {
            return {
              id: `chatcmpl-test-${calls.length}`,
              object: "chat.completion",
              created: Date.now(),
              model: typeof input.model === "string" ? input.model : "gpt-4o",
              choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Skills prioritization" } }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
          }

          let content = "Skills prioritization";

          if (
            lastMessage.includes("Help me plan a revision flow.")
            || lastMessage.includes("Greet the user briefly")
            || lastMessage.includes("what outcome they want from the revision")
          ) {
            content = "Hej! Jag kan hjälpa dig att prioritera om kompetenserna.";
          } else if (
            lastMessage.includes("use the available tools for this stage")
            || lastMessage.toLowerCase().includes("reorder the skills so management is highlighted before dev and test")
          ) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":false}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume"')) {
            content = '```json\n{"type":"tool_call","toolName":"set_revision_plan","input":{"summary":"Prioritize leadership and architecture skills above web and test","actions":[{"id":"action-skill-groups","title":"Review skill group order","description":"Reorder the skill groups so leadership and architecture comes first.","status":"pending"},{"id":"action-skills-leadership","title":"Review leadership and architecture ordering","description":"Sort the leadership and architecture group internally.","status":"pending"},{"id":"action-skills-web","title":"Review web development ordering","description":"Sort the web development group internally.","status":"pending"},{"id":"action-skills-test","title":"Review test and quality ordering","description":"Sort the test and quality group internally.","status":"pending"}]}}\n```';
          } else if (lastMessage.includes('"toolName":"set_revision_plan"')) {
            content = "The revision plan is ready for review.";
          } else if (
            lastMessage.includes("[[internal_autostart]]")
            || lastMessage.includes("Process only this work item now: action-skill-groups")
            || lastMessage.includes("Process only this work item now: action-skills-leadership")
            || lastMessage.includes("Process only this work item now: action-skills-web")
            || lastMessage.includes("Process only this work item now: action-skills-test")
          ) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume_skills","input":{}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume_skills"')) {
            content = [
              "```json",
              JSON.stringify({
                type: "tool_call",
                toolName: "set_revision_suggestions",
                input: {
                  summary: "Split skills reprioritization into separate review tasks",
                  suggestions: [
                    actionSuggestions["action-skill-groups"].suggestion,
                    actionSuggestions["action-skills-leadership"].suggestion,
                    actionSuggestions["action-skills-web"].suggestion,
                    actionSuggestions["action-skills-test"].suggestion,
                  ],
                },
              }),
              "```",
            ].join("\n");
          } else if (lastMessage.includes('"toolName":"set_revision_suggestions"')) {
            content = "Skills prioritization is ready for review.";
          }

          return {
            id: `chatcmpl-test-${calls.length}`,
            object: "chat.completion",
            created: Date.now(),
            model: typeof input.model === "string" ? input.model : "gpt-4o",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
        },
      },
    },
  } as unknown as OpenAI;

  return { client, calls };
}

function buildUlfProjectManagementSkillsScenario() {
  const calls: Array<Parameters<OpenAI["chat"]["completions"]["create"]>[0]> = [];

  const client = {
    chat: {
      completions: {
        create: async (input: Parameters<OpenAI["chat"]["completions"]["create"]>[0]) => {
          calls.push(input);
          const lastMessage = getMessageText(input.messages.at(-1)?.content);
          const transcript = input.messages.map((message) => getMessageText(message.content)).join("\n\n");
          const systemMessage = getMessageText(input.messages[0]?.content);

          if (systemMessage.includes("You summarise conversations in 2–4 words")) {
            return {
              id: `chatcmpl-test-${calls.length}`,
              object: "chat.completion",
              created: Date.now(),
              model: typeof input.model === "string" ? input.model : "gpt-4o",
              choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Projektledningsprofil" } }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
          }

          const parsed = parseJsonCodeFence(lastMessage) as
            | {
                type?: string;
                toolName?: string;
                output?: {
                  groups?: Array<{
                    category: string;
                    skills: string[];
                  }>;
                };
              }
            | null;

          const groups = parsed?.type === "tool_result" && parsed.toolName === "inspect_resume_skills"
            ? parsed.output?.groups ?? []
            : [];

          const categoryNames = groups.map((group) => group.category);
          const normalizedCategoryMap = new Map(
            groups.map((group) => [normalizeSkillCategory(group.category), group]),
          );
          const arbetsomradenGroup = normalizedCategoryMap.get("arbetsomraden");
          const specialkunskaperGroup = normalizedCategoryMap.get("specialkunskaper");

          let content = "Projektledningsprofil";

          if (
            lastMessage.includes("Help me plan a revision flow.")
            || lastMessage.includes("Greet the user briefly")
            || lastMessage.includes("what outcome they want from the revision")
          ) {
            content = "Hej! Jag kan hjälpa dig att prioritera om kompetenserna mot projektledning.";
          } else if (
            lastMessage.includes("use the available tools for this stage")
            || lastMessage.toLowerCase().includes("jag vill rikta mitt cv mot projektledning")
          ) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":false}}\n```';
          } else if (lastMessage.includes('"toolName":"inspect_resume"')) {
            content = [
              "```json",
              JSON.stringify({
                type: "tool_call",
                toolName: "set_revision_plan",
                input: {
                  summary: "Rikta om kompetensdelen mot projektledning",
                  actions: [
                    {
                      id: "action-skill-groups",
                      title: "Review skill group order",
                      description: "Reorder the existing skill groups to foreground leadership-related groups first.",
                      status: "pending",
                    },
                    {
                      id: "action-skills-specialkunskaper",
                      title: "Review specialkunskaper group ordering",
                      description: "Reorder the skills inside the specialkunskaper group without moving skills to a different group.",
                      status: "pending",
                    },
                    {
                      id: "action-skills-arbetsomraden",
                      title: "Review arbetsomraden group ordering",
                      description: "Reorder the skills inside the arbetsomraden group to prioritize project leadership.",
                      status: "pending",
                    },
                  ],
                },
              }),
              "```",
            ].join("\n");
          } else if (lastMessage.includes('"toolName":"set_revision_plan"')) {
            content = "Planen ar klar for granskning.";
          } else if (
            lastMessage.includes("[[internal_autostart]]")
            || lastMessage.includes("Process only this work item now: action-skill-groups")
            || lastMessage.includes("Process only this work item now: action-skills-specialkunskaper")
            || lastMessage.includes("Process only this work item now: action-skills-arbetsomraden")
          ) {
            content = '```json\n{"type":"tool_call","toolName":"inspect_resume_skills","input":{}}\n```';
          } else if (
            parsed?.type === "tool_result"
            && parsed.toolName === "inspect_resume_skills"
            && transcript.includes("Process only this work item now: action-skill-groups")
          ) {
            const preferredOrder = ["arbetsomraden", "specialkunskaper"];
            const orderedGroups = [
              ...preferredOrder
                .map((category) => normalizedCategoryMap.get(category))
                .filter((group): group is NonNullable<typeof group> => Boolean(group)),
              ...groups.filter((group) => !preferredOrder.includes(normalizeSkillCategory(group.category))),
            ];

            const reorderedSkills = orderedGroups.flatMap((group, groupIndex) =>
              group.skills.map((skill, skillIndex) => ({
                name: skill,
                level: null,
                category: group.category,
                sortOrder: groupIndex * 1000 + skillIndex,
              })),
            );
            const arbetsomradenSkills = arbetsomradenGroup?.skills ?? [];
            const reorderedArbetsomraden = [
              ...["Teknisk projektledning", "Systemarkitektur", "Testledning"].filter((skill) =>
                arbetsomradenSkills.includes(skill),
              ),
              ...arbetsomradenSkills.filter(
                (skill) => !["Teknisk projektledning", "Systemarkitektur", "Testledning"].includes(skill),
              ),
            ];
            const arbSuggestionSkills = groups.flatMap((group, groupIndex) => {
              const groupSkills = normalizeSkillCategory(group.category) === "arbetsomraden"
                ? reorderedArbetsomraden
                : group.skills;
              return groupSkills.map((skill, skillIndex) => ({
                name: skill,
                level: null,
                category: group.category,
                sortOrder: groupIndex * 1000 + skillIndex,
              }));
            });

            content = [
              "```json",
              JSON.stringify({
                type: "tool_call",
                toolName: "set_revision_suggestions",
                input: {
                  summary: "Omordna grupperna for att lyfta projektledning",
                  suggestions: [
                    {
                      id: "action-skill-groups",
                      title: "Reorder Skill Groups",
                      description: "Adjust the overall order of skill groups to prioritize project leadership-related groups.",
                      section: "skills",
                      suggestedText: orderedGroups.map((group) => group.category).join("\n"),
                      skills: reorderedSkills,
                      skillScope: { type: "group_order" },
                      status: "pending",
                    },
                    {
                      id: "action-skills-arbetsomraden",
                      title: "Reorder Arbetsomraden Skills",
                      description: "Reorder only the Arbetsomraden skills to foreground project leadership.",
                      section: "skills",
                      suggestedText: `Arbetsomraden: ${reorderedArbetsomraden.join(", ")}`,
                      skills: arbSuggestionSkills,
                      skillScope: {
                        type: "group_contents",
                        category: arbetsomradenGroup?.category ?? "arbetsomraden",
                      },
                      status: "pending",
                    },
                  ],
                },
              }),
              "```",
            ].join("\n");
          } else if (
            parsed?.type === "tool_result"
            && parsed.toolName === "inspect_resume_skills"
            && transcript.includes("Process only this work item now: action-skills-specialkunskaper")
          ) {
            content = [
              "```json",
              JSON.stringify({
                type: "tool_call",
                toolName: "mark_revision_work_item_no_changes_needed",
                input: {
                  workItemId: "action-skills-specialkunskaper",
                  note: specialkunskaperGroup && specialkunskaperGroup.skills.length <= 1
                    ? "Specialkunskaper innehaller bara en post och behover ingen intern omordning."
                    : "Inga ytterligare justeringar behovdes for specialkunskaper.",
                },
              }),
              "```",
            ].join("\n");
          } else if (
            parsed?.type === "tool_result"
            && parsed.toolName === "inspect_resume_skills"
            && transcript.includes("Process only this work item now: action-skills-arbetsomraden")
          ) {
            const hasScopedInstruction =
              transcript.includes("reorder only the skills inside that group")
              && transcript.includes("Treat phrases like");

            const arbetsomradenSkills = arbetsomradenGroup?.skills ?? [];
            const promoted = [
              "Teknisk projektledning",
              "Systemarkitektur",
              "Testledning",
            ];
            const reorderedArbetsomraden = [
              ...promoted.filter((skill) => arbetsomradenSkills.includes(skill)),
              ...arbetsomradenSkills.filter((skill) => !promoted.includes(skill)),
            ];

            if (!hasScopedInstruction) {
              content = [
                "```json",
                JSON.stringify({
                  type: "tool_call",
                  toolName: "set_revision_suggestions",
                  input: {
                    summary: "Fallback bad suggestion",
                    suggestions: [
                      {
                        id: "action-skills-arbetsomraden",
                        title: "Reorder Arbetsomraden Skills",
                        description: "Incorrectly reorders the overall groups instead of the contents.",
                        section: "skills",
                        suggestedText: categoryNames.join("\n"),
                        status: "pending",
                      },
                    ],
                  },
                }),
                "```",
              ].join("\n");
            } else {
              const reorderedSkills = groups.flatMap((group, groupIndex) => {
                const groupSkills = normalizeSkillCategory(group.category) === "arbetsomraden"
                  ? reorderedArbetsomraden
                  : group.skills;
                return groupSkills.map((skill, skillIndex) => ({
                  name: skill,
                  level: null,
                  category: group.category,
                  sortOrder: groupIndex * 1000 + skillIndex,
                }));
              });

              content = [
                "```json",
                JSON.stringify({
                  type: "tool_call",
                  toolName: "set_revision_suggestions",
                  input: {
                    summary: "Omordna arbetsomraden internt for att lyfta projektledning",
                    suggestions: [
                      {
                        id: "action-skills-arbetsomraden",
                        title: "Reorder Arbetsomraden Skills",
                        description: "Reorder only the Arbetsomraden skills to foreground project leadership.",
                        section: "skills",
                        suggestedText: `Arbetsomraden: ${reorderedArbetsomraden.join(", ")}`,
                        skills: reorderedSkills,
                        skillScope: {
                          type: "group_contents",
                          category: arbetsomradenGroup?.category ?? "arbetsomraden",
                        },
                        status: "pending",
                      },
                    ],
                  },
                }),
                "```",
              ].join("\n");
            }
          } else if (
            lastMessage.includes('"toolName":"set_revision_suggestions"')
            || lastMessage.includes('"toolName":"mark_revision_work_item_no_changes_needed"')
          ) {
            content = "Korrigeringarna ar framtagna och redo for granskning.";
          }

          return {
            id: `chatcmpl-test-${calls.length}`,
            object: "chat.completion",
            created: Date.now(),
            model: typeof input.model === "string" ? input.model : "gpt-4o",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          } as Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
        },
      },
    },
  } as unknown as OpenAI;

  return { client, calls };
}

export async function e2eScriptedAIHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!ensureEnabled(res)) {
    return;
  }

  const body = await parseJsonBody<{
    responses?: string[];
    scenario?: "single-assignment-revision";
    presentationScenario?: "single-presentation-revision";
    sectionScenario?: SupportedSingleSection;
    wholeCvScenario?: "whole-cv-spelling-revision";
    skillsScenario?: "skills-prioritization-revision";
    ulfSkillsScenario?: "project-management-skills-only";
    assignmentId?: string;
    assignmentIds?: string[];
  }>(req);

  if (body.scenario === "single-assignment-revision") {
    if (!body.assignmentId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "assignmentId is required for single-assignment-revision" }));
      return;
    }

    setOpenAIClientForTests(buildSingleAssignmentRevisionScenario(body.assignmentId).client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.scenario }));
    return;
  }

  if (body.presentationScenario === "single-presentation-revision") {
    setOpenAIClientForTests(buildSinglePresentationRevisionScenario().client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.presentationScenario }));
    return;
  }

  if (body.sectionScenario) {
    if (body.sectionScenario === "assignment" && !body.assignmentId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "assignmentId is required for assignment section scenario" }));
      return;
    }

    setOpenAIClientForTests(buildSingleSectionRevisionScenario(body.sectionScenario, body.assignmentId).client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.sectionScenario }));
    return;
  }

  if (body.wholeCvScenario === "whole-cv-spelling-revision") {
    setOpenAIClientForTests(buildWholeCvRevisionScenario(body.assignmentIds ?? []).client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.wholeCvScenario }));
    return;
  }

  if (body.skillsScenario === "skills-prioritization-revision") {
    setOpenAIClientForTests(buildSkillsPrioritizationRevisionScenario().client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.skillsScenario }));
    return;
  }

  if (body.ulfSkillsScenario === "project-management-skills-only") {
    setOpenAIClientForTests(buildUlfProjectManagementSkillsScenario().client);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scenario: body.ulfSkillsScenario }));
    return;
  }

  const responses = body.responses ?? [];
  if (responses.length === 0) {
    resetOpenAIClientForTests();
  } else {
    setOpenAIClientForTests(createScriptedOpenAI(responses).client);
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, responseCount: responses.length }));
}

export async function e2eResetHandler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!ensureEnabled(res)) {
    return;
  }

  const db = getDb();

  const fixtureEmployees = await db
    .selectFrom("employees")
    .select(["id"])
    .where("email", "like", "playwright-%@example.com")
    .execute();

  const fixtureEmployeeIds = fixtureEmployees.map((employee) => employee.id);

  if (fixtureEmployeeIds.length > 0) {
    await db
      .deleteFrom("employees")
      .where("id", "in", fixtureEmployeeIds)
      .execute();
  }

  await db
    .deleteFrom("user_sessions")
    .where("user_id", "=", DEFAULT_TEST_USER_ID)
    .execute();

  await db
    .deleteFrom("users")
    .where("id", "=", DEFAULT_TEST_USER_ID)
    .execute();

  resetOpenAIClientForTests();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    ok: true,
    deletedEmployees: fixtureEmployeeIds.length,
    deletedTestUser: true,
  }));
}

export async function e2eBootstrapRevisionHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!ensureEnabled(res)) {
    return;
  }

  const body = await parseJsonBody<{
    employeeName?: string;
    employeeEmail?: string;
    resumeTitle?: string;
    language?: string;
    presentationParagraphs?: string[];
    consultantTitle?: string | null;
    summary?: string | null;
    assignmentClientName?: string;
    assignmentRole?: string;
    assignmentDescription?: string;
    assignments?: Array<{
      clientName?: string;
      role?: string;
      description?: string;
    }>;
    skills?: Array<{
      name?: string;
      category?: string | null;
      level?: string | null;
      sortOrder?: number;
    }>;
    skipAssignment?: boolean;
  }>(req);

  const db = getDb();
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", DEFAULT_TEST_USER_ID)
    .executeTakeFirst();

  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Test user not found. Login first." }));
    return;
  }

  const employeeId = randomUUID();
  const employeeName = body.employeeName ?? "Playwright Employee";
  const employeeEmail = body.employeeEmail ?? `playwright-${employeeId}@example.com`;

  await db
    .insertInto("employees")
    .values({
      id: employeeId,
      name: employeeName,
      email: employeeEmail,
    })
    .execute();

  const resume = await createResume(db, user, {
    employeeId,
    title: body.resumeTitle ?? "Playwright Revision Resume",
    language: body.language ?? "sv",
    summary: body.summary ?? null,
  });

  await db
    .updateTable("resumes")
    .set({
      consultant_title: body.consultantTitle ?? "Tech Lead / Senior Engineer",
      presentation: sql`${JSON.stringify(body.presentationParagraphs ?? [])}::jsonb` as unknown as string[],
      summary: body.summary ?? null,
    })
    .where("id", "=", resume.id)
    .execute();

  const skillsToCreate = body.skills ?? [];
  for (const [index, skill] of skillsToCreate.entries()) {
    await db
      .insertInto("resume_skills")
      .values({
        id: randomUUID(),
        cv_id: resume.id,
        name: skill.name ?? `Skill ${index + 1}`,
        category: skill.category ?? null,
        level: skill.level ?? null,
        sort_order: skill.sortOrder ?? index,
      })
      .execute();
  }

  let assignmentId: string | null = null;
  const assignmentIds: string[] = [];

  const assignmentsToCreate = body.skipAssignment
    ? []
    : body.assignments && body.assignments.length > 0
      ? body.assignments
      : [{
          clientName: body.assignmentClientName ?? "Payer",
          role: body.assignmentRole ?? "Fullstack developer",
          description: body.assignmentDescription ?? "Detta uppdrag innehåller felstavningen fakutrerings relaterade APIers.",
        }];

  for (const [index, assignmentInput] of assignmentsToCreate.entries()) {
    const createdAssignmentId = randomUUID();
    assignmentIds.push(createdAssignmentId);
    assignmentId ??= createdAssignmentId;

    await db
      .insertInto("assignments")
      .values({
        id: createdAssignmentId,
        employee_id: employeeId,
      })
      .execute();

    await db
      .insertInto("branch_assignments")
      .values({
        branch_id: resume.mainBranchId!,
        assignment_id: createdAssignmentId,
        client_name: assignmentInput.clientName ?? `Assignment ${index + 1}`,
        role: assignmentInput.role ?? "Consultant",
        description: assignmentInput.description ?? `Assignment ${index + 1} description.`,
        start_date: new Date(`2025-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
        end_date: null,
        technologies: ["TypeScript"],
        is_current: index === 0,
        keywords: null,
        type: null,
        highlight: true,
        sort_order: index,
      })
      .execute();
  }

  const savedCommit = await saveResumeVersion(db, user, {
    branchId: resume.mainBranchId!,
    message: "bootstrap revision fixture",
    consultantTitle: body.consultantTitle ?? "Tech Lead / Senior Engineer",
    presentation: body.presentationParagraphs ?? [],
    summary: body.summary ?? null,
  });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    employeeId,
    resumeId: resume.id,
    mainBranchId: resume.mainBranchId,
    headCommitId: savedCommit.id,
    assignmentId,
    assignmentIds,
  }));
}

export async function e2eRevisionStateHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!ensureEnabled(res)) {
    return;
  }

  const requestUrl = new URL(req.url ?? "", "http://127.0.0.1");
  const resumeId = requestUrl.searchParams.get("resumeId");

  if (!resumeId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "resumeId is required" }));
    return;
  }

  const db = getDb();
  const branches = await db
    .selectFrom("resume_branches")
    .select(["id", "name", "is_main", "head_commit_id"])
    .where("resume_id", "=", resumeId)
    .orderBy("created_at", "asc")
    .execute();

  const commits = await db
    .selectFrom("resume_commits")
    .select(["id", "branch_id", "message"])
    .where("resume_id", "=", resumeId)
    .orderBy("created_at", "asc")
    .execute();

  const mainBranch = branches.find((branch) => branch.is_main);
  const mainCommit = mainBranch?.head_commit_id
    ? await db
        .selectFrom("resume_commits")
        .select(["id", "content"])
        .where("id", "=", mainBranch.head_commit_id)
        .executeTakeFirst()
    : null;

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    branches,
    commits,
    mainBranchId: mainBranch?.id ?? null,
    mainHeadCommitId: mainBranch?.head_commit_id ?? null,
    mainConsultantTitle: mainCommit?.content.consultantTitle ?? null,
    mainPresentation: mainCommit?.content.presentation ?? [],
    mainSummary: mainCommit?.content.summary ?? null,
    mainSkills: mainCommit?.content.skills ?? [],
    mainAssignments: mainCommit?.content.assignments ?? [],
  }));
}
