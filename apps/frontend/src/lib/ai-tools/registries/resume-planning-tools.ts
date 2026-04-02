import { z } from "zod";
import { createAIToolRegistry } from "../runtime";
import type { AIToolRegistry } from "../types";
import {
  buildInspectResumeResult,
  revisionPlanSchema,
  type ResumeInspectionSnapshot,
  type RevisionPlan,
} from "./resume-tool-schemas";

interface CreateResumePlanningToolRegistryOptions {
  getResumeSnapshot: () => ResumeInspectionSnapshot;
  setRevisionPlan: (plan: RevisionPlan) => void;
}

export function createResumePlanningToolRegistry({
  getResumeSnapshot,
  setRevisionPlan,
}: CreateResumePlanningToolRegistryOptions): AIToolRegistry {
  return createAIToolRegistry([
    {
      name: "inspect_resume",
      description: "Return structured resume content for the active resume view.",
      inputSchema: z.object({
        includeAssignments: z.boolean().optional().default(true),
      }),
      execute: ({ includeAssignments }) =>
        buildInspectResumeResult(getResumeSnapshot(), includeAssignments),
    },
    {
      name: "set_revision_plan",
      description: "Replace the current inline revision plan for the active resume.",
      inputSchema: revisionPlanSchema,
      execute: (input) => {
        setRevisionPlan(input);
        return input;
      },
    },
  ]);
}
