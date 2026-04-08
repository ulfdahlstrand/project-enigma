import { createFileRoute } from "@tanstack/react-router";
import { CompareVersionsPage } from "./CompareVersionsPage";

export const Route = createFileRoute("/_authenticated/resumes/$id_/compare/")({
  component: CompareVersionsPage,
});
