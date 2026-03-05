/**
 * i18n configuration using react-i18next.
 *
 * Supported locales: en (English, default), fr (French).
 * To switch locale programmatically: import i18n from './i18n' and call i18n.changeLanguage('fr').
 */
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

export const defaultNS = "translation";

export const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    defaultNS,
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
