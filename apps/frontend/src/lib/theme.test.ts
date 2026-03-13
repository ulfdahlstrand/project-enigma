import { describe, it, expect } from "vitest";

describe("theme", () => {
  it("exports a valid MUI theme with palette, typography, and spacing", async () => {
    const { theme } = await import("./theme");
    expect(theme).toBeDefined();
    expect(theme).toHaveProperty("palette");
    expect(theme).toHaveProperty("typography");
    expect(theme).toHaveProperty("spacing");
  });
});
