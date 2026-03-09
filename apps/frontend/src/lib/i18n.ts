/**
 * i18n configuration using react-i18next.
 *
 * Supported locales: en (English, default), sv (Swedish).
 * To switch locale programmatically: import i18n from './i18n' and call i18n.changeLanguage('sv').
 *
 * Namespaces:
 *   - "translation" — general app strings (src/i18n/locales/{en,sv}.json)
 *   - "common"      — shared UI strings used by layout components (src/locales/{en,sv}/common.json)
 */
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "../i18n/locales/en.json";
import sv from "../i18n/locales/sv.json";
import enCommon from "../locales/en/common.json";
import svCommon from "../locales/sv/common.json";

export const defaultNS = "translation";

export const supportedLanguages = ["en", "sv"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const resources = {
  en: { translation: en, common: enCommon },
  sv: { translation: sv, common: svCommon },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    defaultNS,
    ns: ["translation", "common"],
    interpolation: {
      // React already escapes values by default — no need for i18next to do it too
      escapeValue: false,
    },
    detection: {
      // Detection order: query string ?lng=sv, then browser preference
      order: ["querystring", "navigator"],
      lookupQuerystring: "lng",
    },
  });

export default i18n;
