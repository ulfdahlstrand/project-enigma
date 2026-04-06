import { oc } from "@orpc/contract";
import {
  getCurrentSessionInputSchema,
  getCurrentSessionOutputSchema,
} from "../../auth.js";

export const authRoutes = {
  getCurrentSession: oc
    .route({ method: "GET", path: "/auth/session" })
    .input(getCurrentSessionInputSchema)
    .output(getCurrentSessionOutputSchema),
};
