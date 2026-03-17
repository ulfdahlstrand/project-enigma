/**
 * LanguageSelector component — renders a language dropdown in the Header.
 *
 * Flag SVGs come from country-flag-icons/react/3x2.
 * The locale-to-country-code mapping lives in locale-flag-map.ts.
 * All styling is applied exclusively via the MUI sx prop.
 *
 * The component manages its own i18n state via useTranslation — no props needed.
 */
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import GB from "country-flag-icons/react/3x2/GB";
import SE from "country-flag-icons/react/3x2/SE";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { localeFlagMap } from "../language-selector/locale-flag-map";

// ---------------------------------------------------------------------------
// Map country code → flag React component
// ---------------------------------------------------------------------------
const FLAG_COMPONENTS: Record<string, ComponentType> = {
  GB,
  SE,
};

// ---------------------------------------------------------------------------
// Build language list from localeFlagMap (single source of truth)
// ---------------------------------------------------------------------------
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  sv: "Svenska",
};

export function LanguageSelector() {
  const { t, i18n } = useTranslation("common");

  const handleChange = (event: SelectChangeEvent<string>) => {
    void i18n.changeLanguage(event.target.value);
  };

  return (
    <Select
      value={i18n.language.startsWith("sv") ? "sv" : "en"}
      onChange={handleChange}
      size="small"
      inputProps={{ "aria-label": t("languageSelector.label", "Select language") }}
      sx={{
        color: "text.secondary",
        fontSize: "0.875rem",
        ".MuiOutlinedInput-notchedOutline": { border: 0 },
        ".MuiSelect-icon": { color: "text.secondary" },
        "&:hover .MuiOutlinedInput-notchedOutline": { border: 0 },
        borderRadius: 4,
        "&:hover": { bgcolor: "#F1F3F4" },
      }}
    >
      {Object.entries(localeFlagMap).map(([locale, countryCode]) => {
        const FlagIcon = FLAG_COMPONENTS[countryCode];
        const label = LANGUAGE_LABELS[locale] ?? locale;
        return (
          <MenuItem key={locale} value={locale}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 24,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                  "& svg": { width: "100%", height: "100%" },
                }}
              >
                {FlagIcon && <FlagIcon aria-hidden="true" />}
              </Box>
              {label}
            </Box>
          </MenuItem>
        );
      })}
    </Select>
  );
}
