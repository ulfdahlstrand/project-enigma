import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "../../../orpc-client";
import { resumeBranchesKey } from "../../../hooks/versioning";
import { ResumeEditPage } from "../../../components/resume-detail/pages/ResumeEditPage";
import { ResumePreviewPage } from "../../../components/resume-detail/pages/ResumePreviewPage";
import { ResumeWorkbenchTabs } from "../../../components/resume-detail/ResumeWorkbenchTabs";
import {
  getResumeQueryKey,
  type ResumeDetailPageBundle,
} from "../../../components/resume-detail/pages/useResumeDetailPage";

export { getResumeQueryKey };
export type { ResumeDetailPageBundle };

export const Route = createFileRoute("/_authenticated/resumes/$id")({
  component: ResumeDetailLayout,
});

function ResumeDetailLayout() {
  const { id, branchId: urlBranchId } = useParams({ strict: false }) as {
    id: string;
    branchId?: string;
    commitId?: string;
  };

  const { data: branches } = useQuery({
    queryKey: resumeBranchesKey(id),
    queryFn: () => orpc.listResumeBranches({ resumeId: id }),
  });

  const mainBranchId = branches?.find((b) => b.isMain)?.id ?? null;
  const activeBranchId = urlBranchId ?? mainBranchId ?? null;

  return (
    <>
      <ResumeWorkbenchTabs resumeId={id} activeBranchId={activeBranchId} />
      <Outlet />
    </>
  );
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
