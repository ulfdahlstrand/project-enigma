import { oc } from "@orpc/contract";
import {
  healthInputSchema,
  healthOutputSchema,
  listTestEntriesInputSchema,
  listTestEntriesOutputSchema,
} from "./schema.js";

export const systemRoutes = {
  health: oc
    .route({ method: "GET", path: "/health" })
    .input(healthInputSchema)
    .output(healthOutputSchema),
  listTestEntries: oc
    .route({ method: "GET", path: "/test-entries" })
    .input(listTestEntriesInputSchema)
    .output(listTestEntriesOutputSchema),
};
