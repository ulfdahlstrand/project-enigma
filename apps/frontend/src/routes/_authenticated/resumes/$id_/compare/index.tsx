import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CompareVersionsPage } from "./CompareVersionsPage";

const searchSchema = z.object({
  baseRef: z.string().optional(),
  compareRef: z.string().optional(),
  view: z.enum(["summary", "split"]).optional(),
});

export const Route = createFileRoute("/_authenticated/resumes/$id_/compare/")({
  validateSearch: searchSchema,
  component: CompareVersionsPage,
});
