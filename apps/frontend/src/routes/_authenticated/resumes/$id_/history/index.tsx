/**
 * /resumes/$id/history — Version History page.
 *
 * Lists commits for a selected branch and lets the user toggle to a
 * resume-wide branch overview mode.
 *
 * Data: useResumeBranchHistoryGraph(resumeId) from hooks/versioning
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { z } from "zod";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { useResumeBranchHistoryGraph } from "../../../../../hooks/versioning";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { PageContent } from "../../../../../components/layout/PageContent";
import { LoadingState, ErrorState } from "../../../../../components/feedback";
import { sortByCreatedAt } from "./history-graph-utils";
import { HistoryCommitTable } from "./HistoryCommitTable";
import { HistoryBranchGraph } from "./HistoryBranchGraph";

export const Route = createFileRoute("/_authenticated/resumes/$id_/history/")({
  validateSearch: z.object({
    branchId: z.string().optional(),
    view: z.enum(["list", "tree"]).optional(),
  }),
  component: VersionHistoryPage,
});

function VersionHistoryPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { id: resumeId } = useParams({ strict: false }) as { id: string };
  const { branchId: branchIdFromSearch, view: viewFromSearch } =
    useSearch({ strict: false }) as { branchId?: string; view?: "list" | "tree" };
  const { data: graph, isLoading, isError } = useResumeBranchHistoryGraph(resumeId);

  const branches = graph?.branches ?? [];
  const graphCommits = graph?.commits ?? [];
  const graphEdges = graph?.edges ?? [];

  const selectedBranch =
    branches.find((branch) => branch.id === branchIdFromSearch) ??
    branches.find((branch) => branch.isMain) ??
    branches[0];
  const mainBranchId = branches.find((branch) => branch.isMain)?.id ?? "";
  const selectedBranchId = selectedBranch?.id ?? mainBranchId;
  const selectedView = viewFromSearch ?? "list";
  const commits = sortByCreatedAt(
    graphCommits.filter((commit) => commit.branchId === selectedBranchId),
  ).reverse();

  if (isLoading) return <LoadingState label={t("resume.history.loading")} />;
  if (isError) return <ErrorState message={t("resume.history.error")} />;

  return (
    <>
      <PageHeader
        title={t("resume.history.pageTitle")}
        breadcrumbs={[
          { label: t("resume.pageTitle"), to: "/resumes" },
          { label: t("resume.detail.pageTitle"), to: `/resumes/${resumeId}` },
        ]}
      />
      <PageContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("resume.history.description")}
        </Typography>

        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>{t("resume.history.branchLabel")}</InputLabel>
              <Select
                value={selectedBranchId}
                label={t("resume.history.branchLabel")}
                onChange={(event) =>
                  void navigate({
                    to: "/resumes/$id/history",
                    params: { id: resumeId },
                    search: { branchId: event.target.value, view: selectedView },
                  })
                }
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <ButtonGroup variant="outlined" size="small">
              <Button
                variant={selectedView === "list" ? "contained" : "outlined"}
                onClick={() =>
                  void navigate({
                    to: "/resumes/$id/history",
                    params: { id: resumeId },
                    search: { branchId: selectedBranchId, view: "list" },
                  })
                }
              >
                {t("resume.history.listView")}
              </Button>
              <Button
                variant={selectedView === "tree" ? "contained" : "outlined"}
                onClick={() =>
                  void navigate({
                    to: "/resumes/$id/history",
                    params: { id: resumeId },
                    search: { branchId: selectedBranchId, view: "tree" },
                  })
                }
              >
                {t("resume.history.treeView")}
              </Button>
            </ButtonGroup>
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                void navigate({ to: "/resumes/$id/compare", params: { id: resumeId } })
              }
            >
              {t("resume.history.compareButton")}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                void navigate({
                  to: "/resumes/$id",
                  params: { id: resumeId },
                  search: { branchId: selectedBranchId },
                })
              }
            >
              {t("resume.history.viewInResumeButton")}
            </Button>
          </Box>
        </Box>

        {selectedView === "tree" ? (
          <HistoryBranchGraph
            branches={branches}
            graphCommits={graphCommits}
            graphEdges={graphEdges}
            selectedBranchId={selectedBranchId}
          />
        ) : (
          <HistoryCommitTable commits={commits} selectedBranch={selectedBranch} />
        )}
      </PageContent>
    </>
  );
}
