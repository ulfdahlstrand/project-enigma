import { oc } from "@orpc/contract";
import {
  healthInputSchema,
  healthOutputSchema,
} from "./schema.js";
import {
  listAIPromptConfigsInputSchema,
  listAIPromptConfigsOutputSchema,
  updateAIPromptFragmentInputSchema,
  updateAIPromptFragmentOutputSchema,
} from "../../ai-prompt-configs.js";
import {
  getConsultantAIPreferencesInputSchema,
  getConsultantAIPreferencesOutputSchema,
  updateConsultantAIPreferencesInputSchema,
  updateConsultantAIPreferencesOutputSchema,
} from "../../consultant-ai-preferences.js";

export const systemRoutes = {
  health: oc
    .route({ method: "GET", path: "/health" })
    .input(healthInputSchema)
    .output(healthOutputSchema),
  listAIPromptConfigs: oc
    .route({ method: "GET", path: "/system/ai-prompts" })
    .input(listAIPromptConfigsInputSchema)
    .output(listAIPromptConfigsOutputSchema),
  updateAIPromptFragment: oc
    .route({ method: "PATCH", path: "/system/ai-prompts/fragments/{fragmentId}" })
    .input(updateAIPromptFragmentInputSchema)
    .output(updateAIPromptFragmentOutputSchema),
  getConsultantAIPreferences: oc
    .route({ method: "GET", path: "/system/consultant-ai-preferences" })
    .input(getConsultantAIPreferencesInputSchema)
    .output(getConsultantAIPreferencesOutputSchema),
  updateConsultantAIPreferences: oc
    .route({ method: "PATCH", path: "/system/consultant-ai-preferences" })
    .input(updateConsultantAIPreferencesInputSchema)
    .output(updateConsultantAIPreferencesOutputSchema),
};
