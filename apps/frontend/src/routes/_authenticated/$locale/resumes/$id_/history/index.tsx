import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VersionHistoryPage } from "../../../../../resumes/$id_/history/index";

export const Route = createFileRoute("/_authenticated/$locale/resumes/$id_/history/")({
  validateSearch: z.object({
    view: z.enum(["list", "tree"]).optional(),
  }),
  component: VersionHistoryPage,
});
