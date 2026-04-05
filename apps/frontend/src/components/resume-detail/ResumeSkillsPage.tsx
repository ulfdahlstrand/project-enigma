import Box from "@mui/material/Box";
import type { RefObject } from "react";
import { ResumeDocumentPage } from "./ResumeDocumentPage";
import { ResumeSkillsPageContent } from "./ResumeSkillsPageContent";
import { SkillsEditor, type SkillRow } from "../SkillsEditor";

interface ResumeSkillsPageProps {
  title: string;
  language?: string | null;
  page: number;
  totalPages: number;
  employeeName: string;
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
  return (
    <Box {...(sectionRef ? { ref: sectionRef } : {})} sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <ResumeDocumentPage title={title} language={language ?? undefined} page={page} totalPages={totalPages}>
        {isEditing ? (
          <SkillsEditor
            resumeId={resumeId}
            skills={skills}
            queryKey={queryKey}
          />
        ) : (
          <ResumeSkillsPageContent
            employeeName={employeeName}
            skills={skills}
            degrees={degrees}
            certifications={certifications}
            languages={languages}
          />
        )}
      </ResumeDocumentPage>
    </Box>
  );
}
