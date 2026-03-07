/**
 * i18n configuration using react-i18next.
 *
 * Supported locales: en (English, default), fr (French).
 * To switch locale programmatically: import i18n from './i18n' and call i18n.changeLanguage('fr').
 *
 * Namespaces:
 *   - "translation" — general app strings (src/i18n/locales/{en,fr}.json)
 *   - "common"      — shared UI strings used by layout components (src/locales/{en,fr}/common.json)
 */
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";
import enCommon from "../locales/en/common.json";

export const defaultNS = "translation";

export const resources = {
  en: { translation: en, common: enCommon },
  fr: { translation: fr, common: enCommon },
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
      // Detection order: query string ?lng=fr, then browser preference
      order: ["querystring", "navigator"],
      lookupQuerystring: "lng",
    },
  });

export default i18n;
