import { expect, request } from "@playwright/test";
import { backendBaseUrl } from "./support/backend";

export default async function globalTeardown() {
  const requestContext = await request.newContext({
    baseURL: backendBaseUrl,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  });

  const response = await requestContext.post("/test/e2e/reset");
  await expect(response).toBeOK();
  await requestContext.dispose();
}
