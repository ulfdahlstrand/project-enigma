import AddIcon from "@mui/icons-material/Add";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { toQuarter } from "@cv-tool/utils";
import { useTranslation } from "react-i18next";
import type { MutableRefObject, RefObject } from "react";
import { ResumeDocumentPage } from "./ResumeDocumentPage";
import { ResumePageSideToolbar } from "./ResumePageSideToolbar";
import { AssignmentEditor, type AssignmentRow as EditorAssignmentRow } from "../AssignmentEditor";

interface ResumeAssignmentsPageProps {
  title: string;
  language?: string | null;
  page: number;
  totalPages: number;
  assignments: EditorAssignmentRow[];
  showFullAssignments: boolean;
  onToggleShowFullAssignments: () => void;
  isEditing: boolean;
  isSnapshotMode: boolean;
  canCreateAssignment: boolean;
  canvasEl: HTMLElement | null;
  newAssignmentId: string | null;
  onAutoEditConsumed: () => void;
  onCreateAssignment: () => void;
  createAssignmentPending: boolean;
  showToggleFab: boolean;
  sectionRef?: RefObject<HTMLDivElement | null>;
  assignmentItemRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  activeBranchId: string | null;
}

export function ResumeAssignmentsPage({
  title,
  language,
  page,
  totalPages,
  assignments,
  showFullAssignments,
  onToggleShowFullAssignments,
  isEditing,
  isSnapshotMode,
  canCreateAssignment,
  canvasEl,
  newAssignmentId,
  onAutoEditConsumed,
  onCreateAssignment,
  createAssignmentPending,
  showToggleFab,
  sectionRef,
  assignmentItemRefs,
  activeBranchId,
}: ResumeAssignmentsPageProps) {
  const { t } = useTranslation("common");

  return (
    <Box {...(sectionRef ? { ref: sectionRef } : {})} sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Box sx={{ position: "relative" }}>
      <ResumeDocumentPage title={title} language={language ?? undefined} page={page} totalPages={totalPages}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          {t("resume.detail.assignmentsHeading")}
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {isEditing && showFullAssignments ? (
          <AssignmentEditor
            assignments={assignments}
            queryKey={["listBranchAssignmentsFull", activeBranchId]}
            canvasEl={canvasEl}
            autoEditId={newAssignmentId}
            onAutoEditConsumed={onAutoEditConsumed}
          />
        ) : showFullAssignments ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {assignments.map((a) => {
              const startQ = a.startDate ? toQuarter(a.startDate) : "";
              const endQ = a.isCurrent
                ? t("resume.detail.assignmentPresent")
                : a.endDate
                  ? toQuarter(a.endDate)
                  : "—";
              const technologies = ("technologies" in a && Array.isArray(a.technologies))
                ? a.technologies as string[]
                : [];
              const keywords = ("keywords" in a && typeof a.keywords === "string" && a.keywords)
                ? a.keywords
                : "";
              const description = ("description" in a && typeof a.description === "string")
                ? a.description
                : "";
              const paragraphs = description.split(/\n+/).filter(Boolean);

              return (
                <Box
                  key={a.id}
                  ref={(el) => {
                    const assignmentIdentityId =
                      "assignmentId" in a && typeof a.assignmentId === "string" ? a.assignmentId : a.id;
                    assignmentItemRefs.current[assignmentIdentityId] = el as HTMLElement | null;
                  }}
                >
                  <Typography
                    variant="h6"
                    component="h3"
                    sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", mb: 0.5 }}
                  >
                    {a.role}
                  </Typography>

                  <Typography variant="subtitle1" sx={{ fontWeight: 400, mb: 1.5 }}>
                    {a.clientName} {startQ} – {endQ}
                  </Typography>

                  {paragraphs.length > 0 ? (
                    <Box sx={{ mb: 2 }}>
                      {paragraphs.map((para, i) => (
                        <Typography
                          key={i}
                          variant="body2"
                          sx={{ textAlign: "justify", mb: i < paragraphs.length - 1 ? 1.5 : 0 }}
                        >
                          {para}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}

                  {(technologies.length > 0 || keywords) && (
                    <Box
                      sx={{
                        bgcolor: "action.hover",
                        border: "none",
                        borderRadius: 0,
                        px: 1.5,
                        py: 1,
                        mt: 2,
                      }}
                    >
                      {technologies.length > 0 && (
                        <Typography variant="body2" sx={{ mb: keywords ? 0.5 : 0 }}>
                          <Box component="span" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em" }}>
                            {t("resume.detail.assignmentTechnologies")}:{" "}
                          </Box>
                          {technologies.join(", ")}
                        </Typography>
                      )}
                      {keywords && (
                        <Typography variant="body2">
                          <Box component="span" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em" }}>
                            {t("assignment.new.keywordsLabel")}:{" "}
                          </Box>
                          {keywords}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" aria-label={t("resume.detail.assignmentsHeading")}>
              <TableHead>
                <TableRow>
                  <TableCell>{t("assignment.tableHeaderClient")}</TableCell>
                  <TableCell>{t("assignment.tableHeaderRole")}</TableCell>
                  <TableCell>{t("assignment.tableHeaderStart")}</TableCell>
                  <TableCell>{t("assignment.tableHeaderCurrent")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow
                    key={a.id}
                    ref={(el) => {
                      const assignmentIdentityId =
                        "assignmentId" in a && typeof a.assignmentId === "string" ? a.assignmentId : a.id;
                      assignmentItemRefs.current[assignmentIdentityId] = el as HTMLElement | null;
                    }}
                    hover
                  >
                    <TableCell>{a.clientName}</TableCell>
                    <TableCell>{a.role}</TableCell>
                    <TableCell>{typeof a.startDate === "string" ? a.startDate.slice(0, 10) : ""}</TableCell>
                    <TableCell>
                      {a.isCurrent ? (
                        <Chip label={t("resume.detail.assignmentPresent")} color="success" size="small" />
                      ) : typeof a.endDate === "string" ? (
                        a.endDate.slice(0, 10)
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ResumeDocumentPage>

      <ResumePageSideToolbar
        actions={[
          ...(showToggleFab ? [{
            icon: showFullAssignments ? <FormatListBulletedIcon fontSize="small" /> : <ViewAgendaIcon fontSize="small" />,
            label: showFullAssignments
              ? t("resume.detail.assignmentToggleSummary")
              : t("resume.detail.assignmentToggleFull"),
            onClick: onToggleShowFullAssignments,
          }] : []),
          ...(isEditing && !isSnapshotMode ? [{
            icon: <AddIcon fontSize="small" />,
            label: t("resume.detail.addAssignment"),
            onClick: onCreateAssignment,
            disabled: createAssignmentPending || !canCreateAssignment,
          }] : []),
        ]}
      />
      </Box>
    </Box>
  );
}
