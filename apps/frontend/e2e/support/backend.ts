import { expect, type APIRequestContext } from "@playwright/test";

export const backendBaseUrl = process.env["PLAYWRIGHT_API_URL"]
  ?? `http://127.0.0.1:${process.env["PLAYWRIGHT_BACKEND_PORT"] ?? 3101}`;

export async function loginE2ETestUser(request: APIRequestContext) {
  const response = await request.post(`${backendBaseUrl}/auth/test-login`, {
    data: {
      userId: "40000000-0000-4000-8000-000000000001",
      azureOid: "playwright-admin-oid",
      email: "playwright-admin@example.com",
      name: "Playwright Admin",
      role: "admin",
    },
  });

  await expect(response).toBeOK();
}

export async function resetE2EData(request: APIRequestContext) {
  const response = await request.post(`${backendBaseUrl}/test/e2e/reset`);
  await expect(response).toBeOK();
  await loginE2ETestUser(request);
}
