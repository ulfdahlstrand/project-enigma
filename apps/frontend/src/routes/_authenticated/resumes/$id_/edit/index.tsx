import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { ResumeDetailPage } from "../../$id";

export const Route = createFileRoute("/_authenticated/resumes/$id_/edit/")({
  validateSearch: z.object({
    branchId: z.string().optional(),
    ai: z.enum(["open"]).optional(),
  }),
  component: ResumeEditPage,
});

function ResumeEditPage() {
  return <ResumeDetailPage routeMode="edit" />;
}
