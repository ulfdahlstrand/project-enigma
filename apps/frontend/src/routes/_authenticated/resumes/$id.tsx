import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ResumeEditPage } from "../../../components/resume-detail/pages/ResumeEditPage";
import { ResumePreviewPage } from "../../../components/resume-detail/pages/ResumePreviewPage";
import {
  getResumeQueryKey,
  type ResumeDetailPageBundle,
} from "../../../components/resume-detail/pages/useResumeDetailPage";
import { useParams } from "@tanstack/react-router";

export { getResumeQueryKey };
export type { ResumeDetailPageBundle };

export const Route = createFileRoute("/_authenticated/resumes/$id")({
  component: ResumeDetailLayout,
});

function ResumeDetailLayout() {
  return <Outlet />;
}

interface ResumeDetailPageProps {
  routeMode?: "detail" | "edit";
  forcedBranchId?: string | null;
  forcedCommitId?: string | null;
}

export function ResumeDetailPage({
  routeMode = "detail",
  forcedBranchId = null,
  forcedCommitId = null,
}: ResumeDetailPageProps) {
  const { id: idParam } = useParams({ strict: false });
  const id = idParam!;

  if (routeMode === "edit") {
    return (
      <ResumeEditPage
        id={id}
        forcedBranchId={forcedBranchId}
        forcedCommitId={forcedCommitId}
      />
    );
  }

  return (
    <ResumePreviewPage
      id={id}
      forcedBranchId={forcedBranchId}
      forcedCommitId={forcedCommitId}
    />
  );
}
