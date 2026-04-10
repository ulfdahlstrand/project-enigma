import {
  EXTERNAL_AI_BRANCH_ASSIGNMENT_READ_SCOPE,
  EXTERNAL_AI_BRANCH_ASSIGNMENT_WRITE_SCOPE,
  EXTERNAL_AI_BRANCH_SKILL_WRITE_SCOPE,
  EXTERNAL_AI_CONTEXT_SCOPE,
  EXTERNAL_AI_EDUCATION_READ_SCOPE,
  EXTERNAL_AI_EDUCATION_WRITE_SCOPE,
  EXTERNAL_AI_RESUME_BRANCH_READ_SCOPE,
  EXTERNAL_AI_RESUME_BRANCH_WRITE_SCOPE,
  EXTERNAL_AI_RESUME_COMMIT_READ_SCOPE,
  EXTERNAL_AI_RESUME_COMMIT_WRITE_SCOPE,
  EXTERNAL_AI_RESUME_READ_SCOPE,
} from "./external-ai-tokens.js";

export function getRequiredExternalAIScope(
  method: string | undefined,
  url: string | undefined,
): string | null {
  if (!method || !url) return null;

  const pathname = url.split("?")[0] ?? url;

  if (method === "GET" && pathname === "/external-ai/context") {
    return EXTERNAL_AI_CONTEXT_SCOPE;
  }
  if (method === "GET" && /^\/resumes\/[^/]+$/.test(pathname)) {
    return EXTERNAL_AI_RESUME_READ_SCOPE;
  }
  if (method === "GET" && /^\/resumes\/[^/]+\/branches$/.test(pathname)) {
    return EXTERNAL_AI_RESUME_BRANCH_READ_SCOPE;
  }
  if (method === "GET" && /^\/resume-branches\/[^/]+\/commits$/.test(pathname)) {
    return EXTERNAL_AI_RESUME_COMMIT_READ_SCOPE;
  }
  if (method === "GET" && /^\/resume-commits\/[^/]+$/.test(pathname)) {
    return EXTERNAL_AI_RESUME_COMMIT_READ_SCOPE;
  }
  if (method === "POST" && pathname === "/resume-commits/compare") {
    return EXTERNAL_AI_RESUME_COMMIT_READ_SCOPE;
  }
  if (method === "POST" && /^\/resume-commits\/[^/]+\/branches$/.test(pathname)) {
    return EXTERNAL_AI_RESUME_BRANCH_WRITE_SCOPE;
  }
  if (method === "POST" && /^\/resume-branches\/[^/]+\/commits$/.test(pathname)) {
    return EXTERNAL_AI_RESUME_COMMIT_WRITE_SCOPE;
  }
  if (method === "PATCH" && /^\/resume-branches\/[^/]+\/content$/.test(pathname)) {
    return EXTERNAL_AI_RESUME_BRANCH_WRITE_SCOPE;
  }
  if (method === "GET" && /^\/resume-branches\/[^/]+\/assignments$/.test(pathname)) {
    return EXTERNAL_AI_BRANCH_ASSIGNMENT_READ_SCOPE;
  }
  if (method === "POST" && /^\/resume-branches\/[^/]+\/assignments$/.test(pathname)) {
    return EXTERNAL_AI_BRANCH_ASSIGNMENT_WRITE_SCOPE;
  }
  if ((method === "PATCH" || method === "DELETE") && /^\/branch-assignments\/[^/]+$/.test(pathname)) {
    return EXTERNAL_AI_BRANCH_ASSIGNMENT_WRITE_SCOPE;
  }
  if (method === "PATCH" && /^\/resume-branches\/[^/]+\/skills$/.test(pathname)) {
    return EXTERNAL_AI_BRANCH_SKILL_WRITE_SCOPE;
  }
  if (method === "GET" && /^\/employees\/[^/]+\/education$/.test(pathname)) {
    return EXTERNAL_AI_EDUCATION_READ_SCOPE;
  }
  if (method === "POST" && /^\/employees\/[^/]+\/education$/.test(pathname)) {
    return EXTERNAL_AI_EDUCATION_WRITE_SCOPE;
  }
  if ((method === "PATCH" || method === "DELETE") && /^\/employees\/[^/]+\/education\/[^/]+$/.test(pathname)) {
    return EXTERNAL_AI_EDUCATION_WRITE_SCOPE;
  }

  return null;
}
