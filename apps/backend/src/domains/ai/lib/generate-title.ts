import type OpenAI from "openai";

const SUMMARY_MODEL = "gpt-4o";

/**
 * Generates a 2–4 word title summarising what a conversation was about.
 * Returns null if the call fails so the caller can proceed gracefully.
 */
export async function generateConversationTitle(
  openaiClient: OpenAI,
  messages: Array<{ role: string; content: string }>
): Promise<string | null> {
  try {
    const transcript = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const response = await openaiClient.chat.completions.create({
      model: SUMMARY_MODEL,
      max_tokens: 16,
      messages: [
        {
          role: "system",
          content:
            "You summarise conversations in 2–4 words. Reply with only the summary, no punctuation.",
        },
        {
          role: "user",
          content: `Summarise this conversation in 2–4 words:\n\n${transcript}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    return raw.slice(0, 64);
  } catch {
    return null;
  }
}

/** Minimum number of user messages before a title is generated. */
export const MIN_USER_MESSAGES_FOR_TITLE = 2;
