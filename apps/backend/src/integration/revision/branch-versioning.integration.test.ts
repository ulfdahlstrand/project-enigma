import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import { createAppServer } from "../../app-server.js";
import { createIntegrationTestDb, truncateAllPublicTables } from "../../test-helpers/integration-db.js";
import { createBearerToken } from "../../test-helpers/integration-auth.js";
import { createIntegrationOrpcClient } from "../../test-helpers/integration-orpc-client.js";
import {
  INTEGRATION_ADMIN_USER,
  INTEGRATION_EMPLOYEE,
  seedIntegrationAdmin,
  seedIntegrationEmployee,
  seedMainBranchAssignment,
} from "../../test-helpers/seed-versioning.js";

describe("revision branch versioning integration", () => {
  let db: Kysely<Database>;
  let baseUrl: string;
  let closeServer: () => Promise<void>;
  let authHeader: string;

  beforeAll(async () => {
    db = createIntegrationTestDb();
    authHeader = await createBearerToken({
      userId: INTEGRATION_ADMIN_USER.id,
      email: INTEGRATION_ADMIN_USER.email,
      name: INTEGRATION_ADMIN_USER.name,
      role: INTEGRATION_ADMIN_USER.role,
    });

    const { server } = await createAppServer();

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    closeServer = () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
  });

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }

    if (db) {
      await db.destroy();
    }
  });

  beforeEach(async () => {
    await truncateAllPublicTables(db);
    await seedIntegrationAdmin(db);
    await seedIntegrationEmployee(db);
  });

  async function runStep<T>(label: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      console.error(`[integration-test] step failed: ${label}`, error);
      if (typeof error === "object" && error !== null && "data" in error) {
        console.error("[integration-test] error data", JSON.stringify((error as { data?: unknown }).data, null, 2));
      }
      throw error;
    }
  }

  it("creates a branch commit chain from a branch assignment edit and keeps the branch", async () => {
    const client = createIntegrationOrpcClient(baseUrl, authHeader);

    const resume = await runStep("createResume", () =>
      client.createResume({
        employeeId: INTEGRATION_EMPLOYEE.id,
        title: "Integration Resume",
        language: "en",
        summary: "Initial summary",
      })
    );

    const mainBranch = await runStep("load main branch", () =>
      db
        .selectFrom("resume_branches")
        .select(["id", "head_commit_id"])
        .where("resume_id", "=", resume.id)
        .where("is_main", "=", true)
        .executeTakeFirstOrThrow()
    );

    const mainBranchAssignment = await runStep("seed main branch assignment", () =>
      seedMainBranchAssignment(db, {
        branchId: mainBranch.id,
        employeeId: INTEGRATION_EMPLOYEE.id,
        clientName: "Acme Corp",
        role: "Developer",
        description: "Built things with typoo.",
      })
    );

    const forkedBranch = await runStep("forkResumeBranch", () =>
      client.forkResumeBranch({
        fromCommitId: mainBranch.head_commit_id!,
        name: "AI revision: Fix assignment spelling",
      })
    );

    const branchAssignments = await runStep("listBranchAssignmentsFull", () =>
      client.listBranchAssignmentsFull({
        branchId: forkedBranch.id,
      })
    );

    expect(branchAssignments).toHaveLength(1);
    expect(branchAssignments[0]?.assignmentId).toBe(mainBranchAssignment.assignmentId);
    expect(branchAssignments[0]?.description).toBe("Built things with typoo.");

    const updatedAssignment = await runStep("updateBranchAssignment", () =>
      client.updateBranchAssignment({
        id: branchAssignments[0]!.id,
        description: "Built things with typo.",
      })
    );

    expect(updatedAssignment.description).toBe("Built things with typo.");

    const savedCommit = await runStep("saveResumeVersion", () =>
      client.saveResumeVersion({
        branchId: forkedBranch.id,
        message: "Apply AI suggestion: Fix assignment spelling",
      })
    );

    expect(savedCommit.branchId).toBe(forkedBranch.id);
    expect(savedCommit.parentCommitId).toBe(forkedBranch.headCommitId);
    expect(savedCommit.message).toBe("Apply AI suggestion: Fix assignment spelling");
    expect(savedCommit.content.assignments[0]?.description).toBe("Built things with typo.");

    const keptBranch = await runStep("finaliseResumeBranch", () =>
      client.finaliseResumeBranch({
        sourceBranchId: mainBranch.id,
        revisionBranchId: forkedBranch.id,
        action: "keep",
      })
    );

    expect(keptBranch.resultBranchId).toBe(forkedBranch.id);

    const persistedBranch = await db
      .selectFrom("resume_branches")
      .select(["id", "head_commit_id"])
      .where("id", "=", forkedBranch.id)
      .executeTakeFirstOrThrow();

    expect(persistedBranch.head_commit_id).toBe(savedCommit.id);

    const persistedCommit = await db
      .selectFrom("resume_commits")
      .select(["message", "content"])
      .where("id", "=", savedCommit.id)
      .executeTakeFirstOrThrow();

    expect(persistedCommit.message).toBe("Apply AI suggestion: Fix assignment spelling");
    expect(persistedCommit.content.assignments[0]?.description).toBe("Built things with typo.");
  });
});
