import type OpenAI from "openai";
import { getMessageText, parseJsonCodeFence } from "./e2e-test-utils.js";

void parseJsonCodeFence;

export function buildSingleAssignmentRevisionScenario(assignmentId: string) {
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

export function buildSinglePresentationRevisionScenario() {
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

export type SupportedSingleSection = "consultantTitle" | "presentation" | "summary" | "assignment";

export function buildSingleSectionRevisionScenario(section: SupportedSingleSection, assignmentId?: string) {
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

export function buildWholeCvRevisionScenario(assignmentIds: string[]) {
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
