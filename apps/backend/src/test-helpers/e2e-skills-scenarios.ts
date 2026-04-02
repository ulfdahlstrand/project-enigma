import type OpenAI from 'openai';
import { getMessageText, parseJsonCodeFence, normalizeSkillCategory } from './e2e-test-utils.js';

export function buildSkillsPrioritizationRevisionScenario() {
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

export function buildUlfProjectManagementSkillsScenario() {
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
