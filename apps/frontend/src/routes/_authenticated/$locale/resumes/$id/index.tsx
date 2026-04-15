import { createFileRoute } from "@tanstack/react-router";
import { ResumeDetailPage } from "../$id";

export const Route = createFileRoute("/_authenticated/$locale/resumes/$id/")({
  component: () => <ResumeDetailPage routeMode="detail" />,
});
