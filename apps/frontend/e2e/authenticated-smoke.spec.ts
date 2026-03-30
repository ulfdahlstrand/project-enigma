import { expect, test } from "@playwright/test";
import { E2E_AUTH_FILE } from "./support/auth";

test.use({ storageState: E2E_AUTH_FILE });

test("authenticated user can open the employees page", async ({ page }) => {
  await page.goto("/employees");

  await expect(page).toHaveURL(/\/employees\/?$/u);
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();
});
