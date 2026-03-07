import "@testing-library/jest-dom";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../i18n/locales/en.json";
import enCommon from "../locales/en/common.json";

// Initialise i18next for tests (synchronous, no language detection needed)
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    resources: {
      en: { translation: en, common: enCommon },
    },
    ns: ["translation", "common"],
    interpolation: { escapeValue: false },
  });
}
