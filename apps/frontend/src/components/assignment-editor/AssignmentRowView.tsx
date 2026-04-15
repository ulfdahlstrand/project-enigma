/**
 * AssignmentRowView — read-mode rendering for a single assignment row.
 * Shows role, client/date line, description paragraphs, and the tech/keywords
 * footer. The parent AssignmentEditor owns the edit button positioning.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { toQuarter } from "@cv-tool/utils";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { AssignmentRow } from "../AssignmentEditor";

interface AssignmentRowViewProps {
  assignment: AssignmentRow;
}

export function AssignmentRowView({ assignment }: AssignmentRowViewProps) {
  const { t } = useTranslation("common");
  const startQ = assignment.startDate ? toQuarter(assignment.startDate) : "";
  const endQ = assignment.isCurrent
    ? t("resume.detail.assignmentPresent")
    : assignment.endDate
    ? toQuarter(assignment.endDate)
    : "—";
  const paragraphs = assignment.description.split(/\n+/).filter(Boolean);

  return (
    <>
      <Typography
        variant="h6"
        component="h3"
        sx={{
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          mb: 0.5,
          pr: 5,
        }}
      >
        {assignment.role}
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 400, mb: 1.5 }}>
        {assignment.clientName} {startQ} – {endQ}
      </Typography>

      {paragraphs.length > 0 && (
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
      )}

      {(assignment.technologies.length > 0 || assignment.keywords) && (
        <Box sx={{ bgcolor: "action.hover", borderRadius: 0, px: 1.5, py: 1, mt: 2 }}>
          {assignment.technologies.length > 0 && (
            <Typography variant="body2" sx={{ mb: assignment.keywords ? 0.5 : 0 }}>
              <Box
                component="span"
                sx={{
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                  letterSpacing: "0.05em",
                }}
              >
                {t("resume.detail.assignmentTechnologies")}:{" "}
              </Box>
              {assignment.technologies.join(", ")}
            </Typography>
          )}
          {assignment.keywords && (
            <Typography variant="body2">
              <Box
                component="span"
                sx={{
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                  letterSpacing: "0.05em",
                }}
              >
                {t("assignment.new.keywordsLabel")}:{" "}
              </Box>
              {assignment.keywords}
            </Typography>
          )}
        </Box>
      )}
    </>
  );
}
