import { createFileRoute } from "@tanstack/react-router";
import { VariantsPage } from "../../../../../resumes/$id_/variants/index";

export const Route = createFileRoute("/_authenticated/$locale/resumes/$id_/variants/")({
  component: VariantsPage,
});
