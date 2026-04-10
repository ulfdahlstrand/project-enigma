export type PromptInventoryItem = {
  title: string;
  file: string;
  bullets: string[];
};

export type PromptInventorySection = {
  titleKey: string;
  items: PromptInventoryItem[];
};

export const PROMPT_INVENTORY_SECTIONS: PromptInventorySection[] = [
  {
    titleKey: "admin.promptInventory.frontendSection",
    items: [
      {
        title: "build-assignment-prompt.ts",
        file: "apps/frontend/src/components/ai-assistant/lib/build-assignment-prompt.ts",
        bullets: [
          "buildAssignmentPrompt() — system prompt for improving a single assignment description",
          "buildAssignmentKickoff() — opening greeting instruction",
          "Hardcoded and language-aware",
        ],
      },
      {
        title: "build-presentation-prompt.ts",
        file: "apps/frontend/src/components/ai-assistant/lib/build-presentation-prompt.ts",
        bullets: [
          "buildPresentationPrompt() — system prompt for improving the presentation section",
          "buildPresentationKickoff() — opening greeting instruction",
          "Hardcoded, third-person narrative, and language-aware",
        ],
      },
      {
        title: "build-resume-revision-prompt.ts",
        file: "apps/frontend/src/components/ai-assistant/lib/build-resume-revision-prompt.ts",
        bullets: [
          "buildUnifiedRevisionPrompt() — main system prompt for the unified revision workflow",
          "buildUnifiedRevisionKickoff() — opening greeting",
          "buildUnifiedRevisionAutoStart() — hidden auto-start instruction for resuming work",
          "Contains conciseness rules, lazy inspection strategy, work item rules, scope constraints, suggestion rules, and bilingual locale instructions",
        ],
      },
    ],
  },
  {
    titleKey: "admin.promptInventory.backendSection",
    items: [
      {
        title: "prompts.ts",
        file: "apps/backend/src/domains/ai/lib/prompts.ts",
        bullets: [
          "buildImproveDescriptionPrompt() — system and user prompt for improving assignment descriptions",
          "Hardcoded system prompt with XML delimiters around user content",
        ],
      },
      {
        title: "generate-title.ts",
        file: "apps/backend/src/domains/ai/lib/generate-title.ts",
        bullets: [
          "Inline system prompt for auto-generating short conversation titles",
          "Uses gpt-4o with a 16 token cap",
        ],
      },
      {
        title: "revision-workflow-engine.ts",
        file: "apps/backend/src/domains/ai/conversation/revision-workflow-engine.ts",
        bullets: [
          "buildHelpMessage(entityType, language)",
          "buildExplainMessage(db, input)",
          "buildStatusMessage(db, input)",
          "buildPendingWorkItemGuardrailMessage(item)",
          "Contains bilingual hardcoded headers and copy throughout",
        ],
      },
      {
        title: "revision-tools.ts",
        file: "apps/backend/src/domains/ai/conversation/revision-tools.ts",
        bullets: [
          "TOOL_SPECS array defines the hardcoded tool names and descriptions for revision workflows",
          "Includes inspect, list, work-item, and suggestion tools",
        ],
      },
      {
        title: "action-orchestration.ts",
        file: "apps/backend/src/domains/ai/conversation/action-orchestration.ts",
        bullets: [
          "ACTION_GUARDRAIL_MESSAGE enforces tool usage and approved-plan behavior",
          "buildNextWorkItemAutomationMessage(workItems) adds dynamic per-item processing instructions",
        ],
      },
      {
        title: "revision-work-items.ts",
        file: "apps/backend/src/domains/ai/conversation/revision-work-items.ts",
        bullets: [
          "buildAutomaticBroadRevisionWorkItems() generates default work item titles and descriptions for broad revision requests",
        ],
      },
    ],
  },
  {
    titleKey: "admin.promptInventory.infrastructureSection",
    items: [
      {
        title: "AI prompt storage and transport",
        file: "packages/contracts/src/ai-conversations.ts + apps/frontend/src/lib/ai-assistant-context.tsx + apps/backend/src/domains/ai/conversation/message.ts + apps/backend/src/domains/ai/conversation/tool-parsing.ts",
        bullets: [
          "Zod schema defines systemPrompt, kickoffMessage, and autoStartMessage",
          "System prompts are stored per conversation in ai_conversations.system_prompt",
          "Frontend passes systemPrompt, kickoffMessage, and autoStartMessage when a conversation is created",
          "Backend loads the stored system prompt at message-send time and injects internal orchestration messages with hidden prefixes",
        ],
      },
    ],
  },
];

export const PROMPT_MODEL_CONFIGURATION = [
  "All AI calls use gpt-4o",
  "General messages: 2048 max tokens",
  "Conversation creation: 512 max tokens",
  "Title generation: 16 max tokens",
  "Description improvement: 1024 max tokens",
];

export const PROMPT_GLOBAL_RULES = [
  "Write in the same language as the existing text",
  "Stay within the scope of what the user asked for",
  "All concrete revision actions must become work items before being executed",
  "Do not claim changes are applied — only suggestions are being proposed",
  "Inspect the exact source text before proposing changes",
  "Do not create extra work items outside the approved plan",
  "For full sections, emit exactly one suggestion with complete replacement text",
  "Do not narrate reasoning — take the next obvious step immediately",
  "Process only one work item at a time",
  "Do not ask the user whether they want more changes while pending work items exist",
];
