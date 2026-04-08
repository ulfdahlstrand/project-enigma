import { createFileRoute, useParams } from "@tanstack/react-router";
import { CompareVersionsPage } from "./CompareVersionsPage";

export const Route = createFileRoute("/_authenticated/resumes/$id_/compare/$range")({
  component: CompareRangePage,
});

function CompareRangePage() {
  const { range } = useParams({ strict: false }) as { range: string };
  return <CompareVersionsPage forcedRange={range} />;
}
