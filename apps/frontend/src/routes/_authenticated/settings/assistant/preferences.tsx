import { createFileRoute } from "@tanstack/react-router";
import { AssistantPreferencesSection } from "../../../../features/settings/AssistantPreferencesSection";
import { SettingsLayout } from "../../../../features/settings/SettingsLayout";

export const Route = createFileRoute("/_authenticated/settings/assistant/preferences")({
  component: SettingsAssistantPreferencesPage,
});

function SettingsAssistantPreferencesPage() {
  return (
    <SettingsLayout activeSection="assistant-preferences">
      <AssistantPreferencesSection />
    </SettingsLayout>
  );
}
