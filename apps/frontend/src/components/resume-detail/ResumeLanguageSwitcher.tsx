import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useNavigate, useParams } from "@tanstack/react-router";

interface ResumeLanguageSwitcherProps {
  resumeId: string;
  supportedLanguages: string[];
}

export function ResumeLanguageSwitcher({ resumeId, supportedLanguages }: ResumeLanguageSwitcherProps) {
  const navigate = useNavigate();
  const { locale } = useParams({ strict: false }) as { locale?: string };

  if (!locale || supportedLanguages.length <= 1) return null;

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
      {supportedLanguages.map((lang) => (
        <Button
          key={lang}
          size="small"
          variant={lang === locale ? "contained" : "outlined"}
          onClick={() =>
            void navigate({
              to: "/$locale/resumes/$id",
              params: { locale: lang, id: resumeId },
            })
          }
          aria-pressed={lang === locale}
        >
          {lang.toUpperCase()}
        </Button>
      ))}
    </Box>
  );
}
