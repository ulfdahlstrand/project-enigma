import { expect, request, type FullConfig } from "@playwright/test";
import { E2E_AUTH_FILE, ensureE2EAuthDir } from "./support/auth";
import { backendBaseUrl, resetE2EData } from "./support/backend";

export default async function globalSetup(config: FullConfig) {
  const requestContext = await request.newContext({
    baseURL: backendBaseUrl,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  });

  await resetE2EData(requestContext);

  const response = await requestContext.post("/auth/test-login", {
    data: {
      userId: "40000000-0000-4000-8000-000000000001",
      azureOid: "playwright-admin-oid",
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
