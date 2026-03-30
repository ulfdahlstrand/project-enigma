import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/.claude/worktrees/**",
      "**/dist/**",
      "src/integration/**",
    ],
    coverage: {
      provider: "v8",
      // Coverage thresholds are set below the standard 80% because this
      // workspace currently contains only migration/type definition files
      // which are infrastructure code with limited unit-testable branches.
      // The threshold will be raised as more application logic is added.
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
});
