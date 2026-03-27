// ---------------------------------------------------------------------------
// PDF static translations
//
// Keyed by resume language code. Falls back to "en" for unknown locales.
// ---------------------------------------------------------------------------

export interface PdfTranslations {
  experienceHeading: string;
  experienceSummaryHeading: string;
  specialSkillsHeading: string;
  atClient: string;
  consultantProfile: string;
  present: string;
  technologies: string;
  keywords: string;
  educationHeading: string;
  degrees: string;
  certifications: string;
  languages: string;
}

const TRANSLATIONS: Record<string, PdfTranslations> = {
  en: {
    experienceHeading: "Experience",
    experienceSummaryHeading: "EXAMPLES OF EXPERIENCE",
    specialSkillsHeading: "SPECIAL SKILLS",
    atClient: "at",
    consultantProfile: "Consultant profile",
    present: "Present",
    technologies: "TECHNOLOGIES",
    keywords: "KEYWORDS",
    educationHeading: "Övrigt",
    degrees: "DEGREES",
    certifications: "CERTIFICATIONS",
    languages: "LANGUAGES",
  },
  sv: {
    experienceHeading: "Urval av kvalifikationer",
    experienceSummaryHeading: "EXEMPEL PÅ ERFARENHET",
    specialSkillsHeading: "SPECIALKUNSKAPER",
    atClient: "hos",
    consultantProfile: "Konsultprofil",
    present: "Pågående",
    technologies: "TEKNIKER",
    keywords: "NYCKELORD",
    educationHeading: "Övrigt",
    degrees: "UTBILDNING",
    certifications: "CERTIFIERINGAR",
    languages: "SPRÅK",
  },
};

export function getPdfTranslations(language: string | null | undefined): PdfTranslations {
  return TRANSLATIONS[language ?? "en"] ?? (TRANSLATIONS["en"] as PdfTranslations);
}
