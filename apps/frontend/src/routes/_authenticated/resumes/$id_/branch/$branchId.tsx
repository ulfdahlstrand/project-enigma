import { createFileRoute, useParams } from "@tanstack/react-router";
import { ResumeDetailPage } from "../../$id";

export const Route = createFileRoute("/_authenticated/resumes/$id_/branch/$branchId")({
  component: ResumeBranchPage,
});

function ResumeBranchPage() {
  const { branchId } = useParams({ strict: false }) as { branchId: string };
  return <ResumeDetailPage routeMode="detail" forcedBranchId={branchId} />;
}
