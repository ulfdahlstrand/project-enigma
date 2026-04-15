import { createFileRoute, useParams } from "@tanstack/react-router";
import { VersionHistoryPage } from "../index";

export const Route = createFileRoute("/_authenticated/$locale/resumes/$id_/history/branch/$branchId")({
  component: HistoryBranchRoute,
});

function HistoryBranchRoute() {
  const { branchId } = useParams({ strict: false }) as { branchId: string };
  return <VersionHistoryPage forcedBranchId={branchId} />;
}
