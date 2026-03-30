import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const E2E_AUTH_FILE = resolve(process.cwd(), ".playwright/auth/admin.json");

export async function ensureE2EAuthDir() {
  await mkdir(dirname(E2E_AUTH_FILE), { recursive: true });
}
