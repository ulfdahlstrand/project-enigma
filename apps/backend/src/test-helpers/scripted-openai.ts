import type OpenAI from "openai";

type ChatCompletionInput = Parameters<OpenAI["chat"]["completions"]["create"]>[0];
type ChatCompletionResponse = Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;

type ScriptedResponse =
  | string
  | null
  | ((input: ChatCompletionInput, callIndex: number) => string | null | Promise<string | null>);

export function createScriptedOpenAI(responses: ScriptedResponse[]) {
  const calls: ChatCompletionInput[] = [];

  const create = async (input: ChatCompletionInput): Promise<ChatCompletionResponse> => {
    const callIndex = calls.length;
    calls.push(input);

    const scripted = responses[callIndex];
    const content =
      typeof scripted === "function"
        ? await scripted(input, callIndex)
        : scripted;

    return {
      id: `chatcmpl-test-${callIndex + 1}`,
      object: "chat.completion",
      created: Date.now(),
      model: typeof input.model === "string" ? input.model : "gpt-4o",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content,
          },
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    } as ChatCompletionResponse;
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
