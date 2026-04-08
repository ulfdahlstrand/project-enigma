import { createFileRoute, useParams } from "@tanstack/react-router";
import { ResumeDetailPage } from "../../../$id";

export const Route = createFileRoute("/_authenticated/resumes/$id_/edit/branch/$branchId")({
  component: ResumeEditBranchPage,
});

function ResumeEditBranchPage() {
  const { branchId } = useParams({ strict: false }) as { branchId: string };
  return <ResumeDetailPage routeMode="edit" forcedBranchId={branchId} />;
}
