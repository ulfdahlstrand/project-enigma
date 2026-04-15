import { createFileRoute } from "@tanstack/react-router";
import { CompareVersionsPage } from "../../../../../resumes/$id_/compare/CompareVersionsPage";

export const Route = createFileRoute("/_authenticated/$locale/resumes/$id_/compare/")({
  component: CompareVersionsPage,
});
