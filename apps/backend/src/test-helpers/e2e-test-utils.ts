import type { IncomingMessage, ServerResponse } from "node:http";
import type OpenAI from "openai";

export const TEST_AUTH_ENABLED = process.env["ENABLE_TEST_AUTH"] === "true";
export const DEFAULT_TEST_USER_ID = "40000000-0000-4000-8000-000000000001";

export function getMessageText(
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

export function parseJsonCodeFence(text: string): unknown | null {
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

export function normalizeSkillCategory(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();
}

export async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  return JSON.parse(Buffer.concat(chunks).toString()) as T;
}

export function ensureEnabled(res: ServerResponse): boolean {
  if (TEST_AUTH_ENABLED) {
    return true;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
  return false;
}
