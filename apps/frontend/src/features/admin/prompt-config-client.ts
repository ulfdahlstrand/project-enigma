import type { ListAIPromptConfigsOutput } from "@cv-tool/contracts";
import { orpc } from "../../orpc-client";

let cachedPromptConfigs: ListAIPromptConfigsOutput | null = null;
let inFlightPromptConfigs: Promise<ListAIPromptConfigsOutput> | null = null;

export function clearPromptConfigCache() {
  cachedPromptConfigs = null;
  inFlightPromptConfigs = null;
}

export async function loadPromptConfigs(): Promise<ListAIPromptConfigsOutput> {
  if (cachedPromptConfigs) {
    return cachedPromptConfigs;
  }

  const listPromptConfigs = (orpc as unknown as {
    listAIPromptConfigs?: (input: {}) => Promise<ListAIPromptConfigsOutput>;
  }).listAIPromptConfigs;

  if (typeof listPromptConfigs !== "function") {
    return { categories: [] };
  }

  if (!inFlightPromptConfigs) {
    inFlightPromptConfigs = listPromptConfigs({}).then((result) => {
      cachedPromptConfigs = result;
      return result;
    }).finally(() => {
      inFlightPromptConfigs = null;
    });
  }

  return inFlightPromptConfigs;
}

export async function loadPromptFragments(promptKey: string): Promise<Record<string, string>> {
  const configs = await loadPromptConfigs();
  const prompt = configs.categories
    .flatMap((category) => category.prompts)
    .find((item) => item.key === promptKey);

  if (!prompt) {
    return {};
  }

  return Object.fromEntries(prompt.fragments.map((fragment) => [fragment.key, fragment.content]));
}

export function renderPromptTemplate(
  template: string,
  replacements: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => replacements[key] ?? "");
}
