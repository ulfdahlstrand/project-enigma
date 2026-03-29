/**
 * WorkflowChecklist — left sidebar showing all steps with status.
 * Skills and assignments are grouped under collapsible headers.
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AdjustIcon from "@mui/icons-material/Adjust";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { ResumeRevisionWorkflowStep, ResumeRevisionStepSection } from "@cv-tool/contracts";

interface WorkflowChecklistProps {
  steps: ResumeRevisionWorkflowStep[];
  selectedStepId: string | null;
  onStepClick: (stepId: string) => void;
}

const GROUPED_SECTIONS = new Set<ResumeRevisionStepSection>(["skills", "assignments"]);

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return <CheckCircleIcon fontSize="small" sx={{ color: "success.main" }} />;
    case "generating":
      return <AutorenewIcon fontSize="small" sx={{ color: "info.main" }} />;
    case "reviewing":
      return <AdjustIcon fontSize="small" sx={{ color: "primary.main" }} />;
    case "needs_rework":
      return <WarningAmberIcon fontSize="small" sx={{ color: "warning.main" }} />;
    default:
      return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "text.disabled" }} />;
  }
}

function groupSummaryStatus(groupSteps: ResumeRevisionWorkflowStep[]): string {
  if (groupSteps.every((s) => s.status === "approved")) return "approved";
  if (groupSteps.some((s) => s.status === "generating")) return "generating";
  if (groupSteps.some((s) => s.status === "reviewing")) return "reviewing";
  if (groupSteps.some((s) => s.status === "needs_rework")) return "needs_rework";
  return "pending";
}

interface GroupHeaderProps {
  label: string;
  steps: ResumeRevisionWorkflowStep[];
  expanded: boolean;
  onToggle: () => void;
}

function GroupHeader({ label, steps, expanded, onToggle }: GroupHeaderProps) {
  const { t } = useTranslation("common");
  const approvedCount = steps.filter((s) => s.status === "approved").length;
  const status = groupSummaryStatus(steps);
  const allApproved = status === "approved";

  return (
    <Box
      onClick={onToggle}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.75,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: allApproved ? "action.hover" : "background.paper",
        cursor: "pointer",
        transition: "all 0.15s ease",
        "&:hover": { bgcolor: "action.selected" },
      }}
    >
      <Box sx={{ color: "text.secondary", display: "flex", alignItems: "center" }}>
        {expanded ? (
          <ExpandMoreIcon fontSize="small" />
        ) : (
          <ChevronRightIcon fontSize="small" />
        )}
      </Box>
      <StatusIcon status={status} />
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          fontWeight: 500,
          color: allApproved ? "text.secondary" : "text.primary",
        }}
      >
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.disabled", flexShrink: 0 }}>
        {t("revision.checklist.groupCount", { approved: approvedCount, total: steps.length })}
      </Typography>
    </Box>
  );
}

interface StepItemProps {
  step: ResumeRevisionWorkflowStep;
  isSelected: boolean;
  indented: boolean;
  label: string;
  onStepClick: (id: string) => void;
}

function StepItem({ step, isSelected, indented, label, onStepClick }: StepItemProps) {
  const { t } = useTranslation("common");
  const isClickable = step.status !== "pending" && step.status !== "generating";

  return (
    <Box
      onClick={() => isClickable && onStepClick(step.id)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        ml: indented ? 2 : 0,
        px: 1.5,
        py: indented ? 0.75 : 1,
        borderRadius: 2,
        border: "1px solid",
        borderColor: isSelected ? "primary.main" : "divider",
        bgcolor: isSelected
          ? "primary.50"
          : step.status === "approved"
            ? "action.hover"
            : "background.paper",
        cursor: isClickable ? "pointer" : "default",
        opacity: step.status === "pending" ? 0.5 : 1,
        transition: "all 0.15s ease",
        "&:hover": isClickable
          ? { bgcolor: isSelected ? "primary.100" : "action.selected" }
          : {},
      }}
    >
      <StatusIcon status={step.status} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant={indented ? "caption" : "body2"}
          noWrap
          sx={{
            display: "block",
            fontWeight: isSelected ? 600 : 400,
            color:
              step.status === "approved"
                ? "text.secondary"
                : isSelected
                  ? "primary.main"
                  : "text.primary",
          }}
        >
          {label}
        </Typography>
        {isSelected && step.status !== "approved" && (
          <Typography variant="caption" sx={{ color: "primary.main" }}>
            {t(`revision.stepStatus.${step.status}`)}
          </Typography>
        )}
        {step.status === "needs_rework" && !isSelected && (
          <Typography variant="caption" sx={{ color: "warning.main" }}>
            {t("revision.stepStatus.needs_rework")}
          </Typography>
        )}
      </Box>
      {step.status === "approved" && !indented && (
        <Chip
          label={t("revision.stepStatus.approved")}
          size="small"
          color="success"
          variant="outlined"
          sx={{ fontSize: "0.65rem", height: 18, px: 0 }}
        />
      )}
    </Box>
  );
}

export function WorkflowChecklist({ steps, selectedStepId, onStepClick }: WorkflowChecklistProps) {
  const { t } = useTranslation("common");

  const skillSteps = steps.filter((s) => s.section === "skills");
  const assignmentSteps = steps.filter((s) => s.section === "assignments");

  const selectedInSkills = skillSteps.some((s) => s.id === selectedStepId);
  const selectedInAssignments = assignmentSteps.some((s) => s.id === selectedStepId);

  const [skillsExpanded, setSkillsExpanded] = useState(selectedInSkills);
  const [assignmentsExpanded, setAssignmentsExpanded] = useState(selectedInAssignments);

  // Auto-expand group when the active step moves into it
  useEffect(() => {
    if (selectedInSkills) setSkillsExpanded(true);
  }, [selectedInSkills]);

  useEffect(() => {
    if (selectedInAssignments) setAssignmentsExpanded(true);
  }, [selectedInAssignments]);

  const approved = steps.filter((s) => s.status === "approved").length;

  function getStepLabel(step: ResumeRevisionWorkflowStep): string {
    if (step.section === "skills" && step.sectionDetail) {
      return step.sectionDetail === "__new_categories__"
        ? t("revision.checklist.skillsNewCategories")
        : step.sectionDetail;
    }
    if (step.section === "assignments" && step.sectionDetail) {
      // sectionDetail format: "<assignmentId>|||<clientName>" or legacy "<clientName>"
      return step.sectionDetail.split("|||")[1] ?? step.sectionDetail;
    }
    return t(`revision.checklist.sectionNames.${step.section as ResumeRevisionStepSection}`);
  }

  // Build an ordered render list
  type RenderItem =
    | { kind: "step"; step: ResumeRevisionWorkflowStep; indented: boolean }
    | { kind: "skills-header" }
    | { kind: "assignments-header" };

  const items: RenderItem[] = [];
  let skillsHeaderAdded = false;
  let assignmentsHeaderAdded = false;

  for (const step of steps) {
    const section = step.section as ResumeRevisionStepSection;
    if (GROUPED_SECTIONS.has(section)) {
      if (section === "skills") {
        if (!skillsHeaderAdded) {
          items.push({ kind: "skills-header" });
          skillsHeaderAdded = true;
        }
        if (skillsExpanded) {
          items.push({ kind: "step", step, indented: true });
        }
      } else {
        if (!assignmentsHeaderAdded) {
          items.push({ kind: "assignments-header" });
          assignmentsHeaderAdded = true;
        }
        if (assignmentsExpanded) {
          items.push({ kind: "step", step, indented: true });
        }
      }
    } else {
      items.push({ kind: "step", step, indented: false });
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {/* Progress summary */}
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 0.25 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
          {t("revision.checklist.progressSummary", {
            approved,
            total: steps.length,
          })}
        </Typography>
        <Box sx={{ height: 4, bgcolor: "divider", borderRadius: 2, overflow: "hidden" }}>
          <Box
            sx={{
              height: "100%",
              width: `${steps.length > 0 ? (approved / steps.length) * 100 : 0}%`,
              bgcolor: "success.main",
              borderRadius: 2,
              transition: "width 0.3s ease",
            }}
          />
        </Box>
      </Paper>

      {/* Step list */}
      {items.map((item) => {
        if (item.kind === "skills-header") {
          return (
            <GroupHeader
              key="group-skills"
              label={t("revision.checklist.sectionNames.skills")}
              steps={skillSteps}
              expanded={skillsExpanded}
              onToggle={() => setSkillsExpanded((v) => !v)}
            />
          );
        }
        if (item.kind === "assignments-header") {
          return (
            <GroupHeader
              key="group-assignments"
              label={t("revision.checklist.sectionNames.assignments")}
              steps={assignmentSteps}
              expanded={assignmentsExpanded}
              onToggle={() => setAssignmentsExpanded((v) => !v)}
            />
          );
        }
        return (
          <StepItem
            key={item.step.id}
            step={item.step}
            isSelected={item.step.id === selectedStepId}
            indented={item.indented}
            label={getStepLabel(item.step)}
            onStepClick={onStepClick}
          />
        );
      })}
    </Box>
  );
}
