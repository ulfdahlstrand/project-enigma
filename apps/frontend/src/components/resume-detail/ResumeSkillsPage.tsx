import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import type { RefObject } from "react";
import { ResumeDocumentPage } from "./ResumeDocumentPage";
import { ResumePageSideToolbar } from "./ResumePageSideToolbar";
import { ResumeSkillsPageContent } from "./ResumeSkillsPageContent";
import { SkillsEditor, type SkillGroupRow, type SkillRow } from "../SkillsEditor";

interface ResumeSkillsPageProps {
  title: string;
  language?: string | null;
  page: number;
  totalPages: number;
  employeeName: string;
  skillGroups: SkillGroupRow[];
  skills: SkillRow[];
  degrees: string[];
  certifications: string[];
  languages: string[];
  isEditing: boolean;
  isSnapshotMode: boolean;
  resumeId: string;
  queryKey: readonly unknown[];
  sectionRef?: RefObject<HTMLDivElement | null>;
}

export function ResumeSkillsPage({
  title,
  language,
  page,
  totalPages,
  employeeName,
  skillGroups,
  skills,
  degrees,
  certifications,
  languages,
  isEditing,
  isSnapshotMode,
  resumeId,
  queryKey,
  sectionRef,
}: ResumeSkillsPageProps) {
  const { t } = useTranslation("common");
  const [view, setView] = useState<"detail" | "list">("detail");
  const [addingCategory, setAddingCategory] = useState(false);

  const toolbarActions = isEditing && !isSnapshotMode
    ? [
        {
          icon: view === "detail"
            ? <FormatListBulletedIcon fontSize="small" />
            : <ViewAgendaIcon fontSize="small" />,
          label: view === "detail"
            ? t("resume.edit.skillsListViewTooltip")
            : t("resume.edit.skillsDetailViewTooltip"),
          onClick: () => setView(view === "detail" ? "list" : "detail"),
        },
        {
          icon: <AddIcon fontSize="small" />,
          label: t("resume.edit.skillAddCategoryButton"),
          onClick: () => setAddingCategory(true),
        },
      ]
    : [];

  return (
    <Box
      {...(sectionRef ? { ref: sectionRef } : {})}
      sx={{ width: "100%", display: "flex", justifyContent: "center" }}
    >
      <Box sx={{ position: "relative" }}>
      <ResumeDocumentPage title={title} language={language ?? undefined} page={page} totalPages={totalPages}>
        {isEditing ? (
          <SkillsEditor
            resumeId={resumeId}
            skillGroups={skillGroups}
            skills={skills}
            queryKey={queryKey}
            view={view}
            onViewChange={setView}
            addingCategory={addingCategory}
            onAddingCategoryChange={setAddingCategory}
          />
        ) : (
          <ResumeSkillsPageContent
            employeeName={employeeName}
            skillGroups={skillGroups}
            skills={skills}
            degrees={degrees}
            certifications={certifications}
            languages={languages}
          />
        )}
      </ResumeDocumentPage>

      <ResumePageSideToolbar actions={toolbarActions} />
      </Box>
    </Box>
  );
}
