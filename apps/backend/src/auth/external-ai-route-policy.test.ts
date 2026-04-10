import { describe, expect, it } from "vitest";
import { getRequiredExternalAIScope } from "./external-ai-route-policy.js";

describe("getRequiredExternalAIScope", () => {
  it("allows the safe context endpoint", () => {
    expect(getRequiredExternalAIScope("GET", "/external-ai/context")).toBe("ai:context:read");
  });

  it("maps read routes to read scopes", () => {
    expect(getRequiredExternalAIScope("GET", "/resumes/123")).toBe("resume:read");
    expect(getRequiredExternalAIScope("GET", "/resumes/123/branches")).toBe("resume-branch:read");
    expect(getRequiredExternalAIScope("GET", "/resume-branches/123/commits")).toBe("resume-commit:read");
    expect(getRequiredExternalAIScope("GET", "/resume-commits/123")).toBe("resume-commit:read");
    expect(getRequiredExternalAIScope("POST", "/resume-commits/compare")).toBe("resume-commit:read");
    expect(getRequiredExternalAIScope("GET", "/resume-branches/123/assignments")).toBe("branch-assignment:read");
    expect(getRequiredExternalAIScope("GET", "/employees/123/education")).toBe("education:read");
  });

  it("maps write routes to write scopes", () => {
    expect(getRequiredExternalAIScope("POST", "/resume-commits/123/branches")).toBe("resume-branch:write");
    expect(getRequiredExternalAIScope("PATCH", "/resume-branches/123/content")).toBe("resume-branch:write");
    expect(getRequiredExternalAIScope("POST", "/resume-branches/123/commits")).toBe("resume-commit:write");
    expect(getRequiredExternalAIScope("POST", "/resume-branches/123/assignments")).toBe("branch-assignment:write");
    expect(getRequiredExternalAIScope("PATCH", "/branch-assignments/123")).toBe("branch-assignment:write");
    expect(getRequiredExternalAIScope("DELETE", "/branch-assignments/123")).toBe("branch-assignment:write");
    expect(getRequiredExternalAIScope("PATCH", "/resume-branches/123/skills")).toBe("branch-skill:write");
    expect(getRequiredExternalAIScope("POST", "/employees/123/education")).toBe("education:write");
    expect(getRequiredExternalAIScope("PATCH", "/employees/123/education/456")).toBe("education:write");
    expect(getRequiredExternalAIScope("DELETE", "/employees/123/education/456")).toBe("education:write");
  });

  it("returns null for unsupported external routes", () => {
    expect(getRequiredExternalAIScope("POST", "/auth/login")).toBeNull();
    expect(getRequiredExternalAIScope("POST", "/resume-branches/123/finalise")).toBeNull();
    expect(getRequiredExternalAIScope("DELETE", "/resume-branches/123")).toBeNull();
  });
});
