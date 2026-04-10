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
