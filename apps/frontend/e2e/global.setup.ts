import { expect, request, type FullConfig } from "@playwright/test";
import { E2E_AUTH_FILE, ensureE2EAuthDir } from "./support/auth";

export default async function globalSetup(config: FullConfig) {
  const backendBaseUrl = process.env["PLAYWRIGHT_API_URL"]
    ?? `http://127.0.0.1:${process.env["PLAYWRIGHT_BACKEND_PORT"] ?? 3101}`;

  const requestContext = await request.newContext({
    baseURL: backendBaseUrl,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  });

  const response = await requestContext.post("/auth/test-login", {
    data: {
      userId: "40000000-0000-4000-8000-000000000001",
      googleSub: "playwright-admin-sub",
      email: "playwright-admin@example.com",
      name: "Playwright Admin",
      role: "admin",
    },
  });

  await expect(response).toBeOK();
  await ensureE2EAuthDir();
  await requestContext.storageState({ path: E2E_AUTH_FILE });
  await requestContext.dispose();

  return async () => {
    await Promise.resolve(config);
  };
}
