import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { ResumeDetailPage } from "../../$id";

export const Route = createFileRoute("/_authenticated/$locale/resumes/$id/edit/")({
  validateSearch: z.object({
    assistant: z.enum(["true"]).optional(),
    sourceBranchId: z.string().optional(),
    sourceBranchName: z.string().optional(),
  }),
  component: ResumeEditPage,
});

function ResumeEditPage() {
  return <ResumeDetailPage routeMode="edit" />;
}
