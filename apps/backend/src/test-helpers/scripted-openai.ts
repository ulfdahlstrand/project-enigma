import type OpenAI from "openai";

type ChatCompletionInput = Parameters<OpenAI["chat"]["completions"]["create"]>[0];
type ScriptedMessage = Record<string, unknown>;

type ScriptedResponse =
  | string
  | null
  | ScriptedMessage
  | ((
      input: ChatCompletionInput,
      callIndex: number,
    ) => string | null | ScriptedMessage | Promise<string | null | ScriptedMessage>);

export function createScriptedOpenAI(responses: ScriptedResponse[]) {
  const calls: ChatCompletionInput[] = [];

  const create = async (input: ChatCompletionInput): Promise<any> => {
    const callIndex = calls.length;
    calls.push(input);

    const scripted = responses[callIndex];
    const resolved =
      typeof scripted === "function"
        ? await scripted(input, callIndex)
        : scripted;
    const message =
      typeof resolved === "string" || resolved === null
        ? { role: "assistant", content: resolved }
        : { role: "assistant", content: (resolved ?? {}).content ?? null, ...(resolved ?? {}) };

    return {
      id: `chatcmpl-test-${callIndex + 1}`,
      object: "chat.completion",
      created: Date.now(),
      model: typeof input.model === "string" ? input.model : "gpt-4o",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message,
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  };

  return {
    client: {
      chat: {
        completions: {
          create,
        },
      },
    } as unknown as OpenAI,
    calls,
  };
}
