import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SkillGroupRow } from "../SkillsEditor";
import { getResumeLanguageTranslations } from "./resume-language-translations";

interface ResumeSkillsPageContentProps {
  language?: string | null | undefined;
  employeeName: string;
  skillGroups: SkillGroupRow[];
  skills: Array<{ id: string; groupId: string; name: string; category: string | null; sortOrder?: number }>;
  degrees: string[];
  certifications: string[];
  languages: string[];
}

export function ResumeSkillsPageContent({
  language,
  employeeName,
  skillGroups,
  skills,
  degrees,
  certifications,
  languages,
}: ResumeSkillsPageContentProps) {
  const labels = getResumeLanguageTranslations(language);

  const groupedByGroupId = skills.reduce<Record<string, Array<{ name: string; sortOrder: number }>>>((acc, skill, index) => {
    const key = skill.groupId || skill.category?.trim() || `__ungrouped__${index}`;
    return {
      ...acc,
      [key]: [...(acc[key] ?? []), {
        name: skill.name,
        sortOrder: skill.sortOrder ?? 0,
      }],
    };
  }, {});

  const orderedCategories = skillGroups
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((group) => ({
      label: group.name.trim(),
      names: (groupedByGroupId[group.id] ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((skill) => skill.name),
    }))
    .filter((group) => group.names.length > 0);

  const fallbackCategories = Object.entries(groupedByGroupId)
    .filter(([groupId]) => !skillGroups.some((group) => group.id === groupId))
    .map(([groupId, groupSkills]) => ({
      label: skills.find((skill) => (skill.groupId || skill.category?.trim() || "") === groupId)?.category?.trim() || "",
      names: groupSkills
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((skill) => skill.name),
    }))
    .sort((a, b) => {
      if (a.label === "") return 1;
      if (b.label === "") return -1;
      return a.label.localeCompare(b.label);
    });

  const categories = [...orderedCategories, ...fallbackCategories].map(({ label, names }) => [label, names] as [string, string[]]);

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
          {labels.consultantProfile}
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, alignItems: "start" }}>
        <Box>
          {leftCategories.map(([cat, names]) => (
            <CategoryBlock key={cat} label={cat || labels.specialSkillsHeading} skillNames={names} />
          ))}
        </Box>

        <Box>
          {rightCategories.map(([cat, names]) => (
            <CategoryBlock key={cat} label={cat || labels.specialSkillsHeading} skillNames={names} />
          ))}

          {hasOther && (
            <Box sx={{ mt: rightCategories.length > 0 ? 1 : 0 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1.5 }}>
                {labels.educationHeading}
              </Typography>

              {degrees.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {labels.degrees}
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
                    {labels.certifications}
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
                    {labels.languages}
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
