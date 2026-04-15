import { createFileRoute, useParams } from "@tanstack/react-router";
import { CompareVersionsPage } from "../../../../../resumes/$id_/compare/CompareVersionsPage";

export const Route = createFileRoute("/_authenticated/$locale/resumes/$id_/compare/$range")({
  component: CompareRangePage,
});

function CompareRangePage() {
  const { range } = useParams({ strict: false }) as { range: string };
  return <CompareVersionsPage forcedRange={range} />;
}
