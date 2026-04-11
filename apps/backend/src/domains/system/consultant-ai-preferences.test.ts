import { describe, expect, it, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import {
  getConsultantAIPreferencesForEmployee,
  getConsultantAIPreferencesForUser,
  updateConsultantAIPreferences,
} from "./consultant-ai-preferences.js";
import { MOCK_CONSULTANT } from "../../test-helpers/mock-users.js";
import { resolveEmployeeId } from "../../auth/resolve-employee-id.js";

vi.mock("../../auth/resolve-employee-id.js");

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";

function buildReadDb(row: unknown) {
  const executeTakeFirst = vi.fn().mockResolvedValue(row);
  const where = vi.fn().mockReturnValue({ executeTakeFirst });
  const select = vi.fn().mockReturnValue({ where });
  const selectFrom = vi.fn().mockReturnValue({ select });
  return { selectFrom } as unknown as Kysely<Database>;
}

function buildUpdateDb(opts: { existing?: unknown; updated?: unknown; inserted?: unknown }) {
  const existingTakeFirst = vi.fn().mockResolvedValue(opts.existing);
  const existingWhere = vi.fn().mockReturnValue({ executeTakeFirst: existingTakeFirst });
  const existingSelect = vi.fn().mockReturnValue({ where: existingWhere });

  const updateTakeFirstOrThrow = vi.fn().mockResolvedValue(opts.updated);
  const updateReturning = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: updateTakeFirstOrThrow });
  const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  const insertTakeFirstOrThrow = vi.fn().mockResolvedValue(opts.inserted);
  const insertReturning = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: insertTakeFirstOrThrow });
  const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
  const insertInto = vi.fn().mockReturnValue({ values: insertValues });

  const selectFrom = vi.fn().mockReturnValue({ select: existingSelect });

  return { selectFrom, updateTable, insertInto } as unknown as Kysely<Database>;
}

describe("consultant-ai-preferences", () => {
  beforeEach(() => {
    vi.mocked(resolveEmployeeId).mockResolvedValue(EMPLOYEE_ID);
  });

  it("returns null preferences when no employee can be resolved", async () => {
    vi.mocked(resolveEmployeeId).mockResolvedValueOnce(null);

    const result = await getConsultantAIPreferencesForUser(buildReadDb(undefined), MOCK_CONSULTANT);

    expect(result).toEqual({ preferences: null });
  });

  it("maps stored preferences for a resolved employee", async () => {
    const result = await getConsultantAIPreferencesForEmployee(
      buildReadDb({
        employee_id: EMPLOYEE_ID,
        prompt: "Prefer concise tone",
        rules: "Keep wording factual",
        validators: "Do not exaggerate",
        updated_at: new Date("2026-04-10T10:00:00Z"),
      }),
      EMPLOYEE_ID,
    );

    expect(result).toEqual({
      employeeId: EMPLOYEE_ID,
      prompt: "Prefer concise tone",
      rules: "Keep wording factual",
      validators: "Do not exaggerate",
      updatedAt: "2026-04-10T10:00:00.000Z",
    });
  });

  it("upserts consultant preferences", async () => {
    const result = await updateConsultantAIPreferences(
      buildUpdateDb({
        existing: undefined,
        inserted: {
          employee_id: EMPLOYEE_ID,
          prompt: "Prefer concise tone",
          rules: "Keep wording factual",
          validators: "Do not exaggerate",
          updated_at: new Date("2026-04-10T10:00:00Z"),
        },
      }),
      MOCK_CONSULTANT,
      {
        prompt: " Prefer concise tone ",
        rules: "Keep wording factual",
        validators: "Do not exaggerate",
      },
    );

    expect(result.preferences.prompt).toBe("Prefer concise tone");
    expect(result.preferences.employeeId).toBe(EMPLOYEE_ID);
  });

  it("rejects updates when the user has no employee record", async () => {
    vi.mocked(resolveEmployeeId).mockResolvedValueOnce(null);

    await expect(
      updateConsultantAIPreferences(
        buildUpdateDb({ existing: undefined, inserted: undefined }),
        MOCK_CONSULTANT,
        { prompt: "test" },
      ),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ORPCError && error.code === "FORBIDDEN",
    );
  });
});
