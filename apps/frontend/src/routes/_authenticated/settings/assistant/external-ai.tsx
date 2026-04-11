import { createFileRoute } from "@tanstack/react-router";
import { ExternalAIConnectionsSection } from "../../../../features/settings/ExternalAIConnectionsSection";
import { SettingsLayout } from "../../../../features/settings/SettingsLayout";

export const Route = createFileRoute("/_authenticated/settings/assistant/external-ai")({
  component: SettingsExternalAIPage,
});

function SettingsExternalAIPage() {
  return (
    <SettingsLayout activeSection="external-ai">
      <ExternalAIConnectionsSection />
    </SettingsLayout>
  );
}
