import { createFileRoute, useParams } from "@tanstack/react-router";
import { ResumeDetailPage } from "../../$id";

export const Route = createFileRoute("/_authenticated/$locale/resumes/$id/commit/$commitId")({
  component: ResumeCommitPage,
});

function ResumeCommitPage() {
  const { commitId } = useParams({ strict: false }) as { commitId: string };
  return <ResumeDetailPage routeMode="detail" forcedCommitId={commitId} />;
}
