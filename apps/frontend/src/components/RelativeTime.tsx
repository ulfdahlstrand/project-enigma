import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import enUS from "date-fns/locale/en-US";
import sv from "date-fns/locale/sv";
import type { Locale } from "date-fns";

const LOCALES: Record<string, Locale> = {
  sv,
  en: enUS,
};

function resolveLocale(language: string): Locale {
  const exact = LOCALES[language];
  if (exact) return exact;
  // Fall back to base language code (e.g. "sv-SE" → "sv")
  const base = language.split("-")[0] ?? "";
  return LOCALES[base] ?? enUS;
}

interface RelativeTimeProps {
  date: string | Date;
  className?: string;
}

/**
 * Renders a relative timestamp ("3 minutes ago") using date-fns,
 * automatically switching locale when the UI language changes.
 */
export function RelativeTime({ date, className }: RelativeTimeProps) {
  const { i18n } = useTranslation();
  const parsed = typeof date === "string" ? new Date(date) : date;
  const locale = resolveLocale(i18n.language);
  const label = formatDistanceToNow(parsed, { addSuffix: true, locale });

  return (
    <time dateTime={parsed.toISOString()} title={parsed.toLocaleString()} className={className}>
      {label}
    </time>
  );
}
