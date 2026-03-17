/**
 * locale-flag-map.ts
 *
 * Maps each supported application locale (matching locale directory names under
 * apps/frontend/src/locales/) to an ISO 3166-1 alpha-2 country code used by the
 * country-flag-icons library to render the corresponding flag SVG.
 *
 * Rules:
 *  - Exactly one entry per locale directory under apps/frontend/src/locales/
 *  - No duplicate keys
 *  - Values are ISO 3166-1 alpha-2 country codes (upper-case, two letters)
 */
export const localeFlagMap: Record<string, string> = {
  en: "GB",
  sv: "SE",
};
