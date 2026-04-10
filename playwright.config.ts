import { defineConfig } from "@playwright/test";

const backendPort = Number(process.env["PLAYWRIGHT_BACKEND_PORT"] ?? 3101);
const frontendPort = Number(process.env["PLAYWRIGHT_FRONTEND_PORT"] ?? 4173);
const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
const backendBaseUrl = `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  testDir: "./apps/frontend/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? [["html"], ["list"]] : "list",
  globalSetup: "./apps/frontend/e2e/global.setup.ts",
  globalTeardown: "./apps/frontend/e2e/global.teardown.ts",
  use: {
    baseURL: frontendBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `BACKEND_PORT=${backendPort} ENABLE_TEST_AUTH=true node --env-file=.env --import tsx/esm src/index.ts`,
      cwd: "apps/backend",
      url: `${backendBaseUrl}/openapi.json`,
      reuseExistingServer: !process.env["CI"],
      timeout: 120_000,
    },
    {
      command: `VITE_API_URL=${backendBaseUrl} VITE_ENTRA_CLIENT_ID=playwright-test-client VITE_ENTRA_TENANT_ID=playwright-test-tenant npx vite --host 127.0.0.1 --port ${frontendPort}`,
      cwd: "apps/frontend",
      url: `${frontendBaseUrl}/login`,
      reuseExistingServer: !process.env["CI"],
      timeout: 120_000,
    },
  ],
});
