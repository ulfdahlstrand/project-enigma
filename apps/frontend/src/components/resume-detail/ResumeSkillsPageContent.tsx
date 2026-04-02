import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

interface ResumeSkillsPageContentProps {
  employeeName: string;
  skills: Array<{ id: string; name: string; category: string | null; sortOrder?: number }>;
  degrees: string[];
  certifications: string[];
  languages: string[];
}

export function ResumeSkillsPageContent({
  employeeName,
  skills,
  degrees,
  certifications,
  languages,
}: ResumeSkillsPageContentProps) {
  const { t } = useTranslation("common");

  const grouped = skills.reduce<Record<string, { names: string[]; minSortOrder: number }>>((acc, skill) => {
    const key = skill.category?.trim() || "";
    const so = skill.sortOrder ?? 0;
    const existing = acc[key];
    return {
      ...acc,
      [key]: {
        names: [...(existing?.names ?? []), skill.name],
        minSortOrder: existing ? Math.min(existing.minSortOrder, so) : so,
      },
    };
  }, {});

  const categories = Object.entries(grouped)
    .sort(([a, aData], [b, bData]) => {
      if (a === "") return 1;
      if (b === "") return -1;
      const diff = aData.minSortOrder - bData.minSortOrder;
      return diff !== 0 ? diff : a.localeCompare(b);
    })
    .map(([label, { names }]) => [label, names] as [string, string[]]);

  const mid = Math.ceil(categories.length / 2);
  const leftCategories = categories.slice(0, mid);
  const rightCategories = categories.slice(mid);
  const hasOther = degrees.length > 0 || certifications.length > 0 || languages.length > 0;

  const CategoryBlock = ({ label, skillNames }: { label: string; skillNames: string[] }) => (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ bgcolor: "action.hover", px: 1.5, py: 0.75, mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.06em", display: "block" }}>
          {label.toUpperCase()}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, fontSize: "0.75rem" }}>
        {skillNames.join(", ")}
      </Typography>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h2" component="p" sx={{ fontWeight: 700, color: "text.primary", lineHeight: 1.1 }}>
          {employeeName}
        </Typography>
        <Typography variant="h3" color="text.primary">
          {t("resume.detail.consultantProfileLabel")}
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, alignItems: "start" }}>
        <Box>
          {leftCategories.map(([cat, names]) => (
            <CategoryBlock key={cat} label={cat || t("resume.detail.skillsHeading")} skillNames={names} />
          ))}
        </Box>

        <Box>
          {rightCategories.map(([cat, names]) => (
            <CategoryBlock key={cat} label={cat || t("resume.detail.skillsHeading")} skillNames={names} />
          ))}

          {hasOther && (
            <Box sx={{ mt: rightCategories.length > 0 ? 1 : 0 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1.5 }}>
                {t("resume.detail.otherHeading")}
              </Typography>

              {degrees.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {t("employee.detail.educationDegrees")}
                  </Typography>
                  {degrees.map((d, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">
                      {d}
                    </Typography>
                  ))}
                </Box>
              )}

              {certifications.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {t("employee.detail.educationCertifications")}
                  </Typography>
                  {certifications.map((c, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">
                      {c}
                    </Typography>
                  ))}
                </Box>
              )}

              {languages.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {t("employee.detail.educationLanguages")}
                  </Typography>
                  {languages.map((l, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">
                      {l}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
