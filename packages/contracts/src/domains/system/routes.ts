import { oc } from "@orpc/contract";
import {
  healthInputSchema,
  healthOutputSchema,
} from "./schema.js";

export const systemRoutes = {
  health: oc
    .route({ method: "GET", path: "/health" })
    .input(healthInputSchema)
    .output(healthOutputSchema),
};
