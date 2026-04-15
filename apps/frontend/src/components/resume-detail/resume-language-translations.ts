export interface ResumeLanguageTranslations {
  experienceHeading: string;
  experienceSummaryHeading: string;
  specialSkillsHeading: string;
  consultantProfile: string;
  present: string;
  technologies: string;
  keywords: string;
  educationHeading: string;
  degrees: string;
  certifications: string;
  languages: string;
  tableHeaderClient: string;
  tableHeaderRole: string;
  tableHeaderStart: string;
  tableHeaderCurrent: string;
}

const TRANSLATIONS: Record<string, ResumeLanguageTranslations> = {
  en: {
    experienceHeading: "Experience",
    experienceSummaryHeading: "EXAMPLES OF EXPERIENCE",
    specialSkillsHeading: "SPECIAL SKILLS",
    consultantProfile: "Consultant profile",
    present: "Present",
    technologies: "TECHNOLOGIES",
    keywords: "KEYWORDS",
    educationHeading: "OTHER",
    degrees: "DEGREES",
    certifications: "CERTIFICATIONS",
    languages: "LANGUAGES",
    tableHeaderClient: "Client",
    tableHeaderRole: "Role",
    tableHeaderStart: "Start date",
    tableHeaderCurrent: "Current",
  },
  sv: {
    experienceHeading: "Urval av kvalifikationer",
    experienceSummaryHeading: "EXEMPEL PÅ ERFARENHET",
    specialSkillsHeading: "SPECIALKUNSKAPER",
    consultantProfile: "Konsultprofil",
    present: "Pågående",
    technologies: "TEKNIKER",
    keywords: "NYCKELORD",
    educationHeading: "Övrigt",
    degrees: "UTBILDNING",
    certifications: "CERTIFIERINGAR",
    languages: "SPRÅK",
    tableHeaderClient: "Kund",
    tableHeaderRole: "Roll",
    tableHeaderStart: "Startdatum",
    tableHeaderCurrent: "Pågående",
  },
};

export function getResumeLanguageTranslations(language: string | null | undefined): ResumeLanguageTranslations {
  return TRANSLATIONS[language ?? "en"] ?? (TRANSLATIONS.en as ResumeLanguageTranslations);
}
