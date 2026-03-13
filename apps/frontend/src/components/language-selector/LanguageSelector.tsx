/**
 * LanguageSelector component — renders a locale selector with flag icons.
 *
 * Displays a MUI Select containing a MenuItem for each supported locale.
 * Each MenuItem shows the corresponding country flag SVG from country-flag-icons
 * alongside the locale label.
 *
 * Props:
 *   currentLocale    — the currently active locale code (e.g. "en")
 *   onLocaleChange   — callback invoked with the newly selected locale string
 *
 * Sizing and spacing are applied exclusively via MUI sx prop — no inline style
 * objects or imported CSS/SCSS files are used anywhere in this component.
 */
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import type { FlagComponent } from "country-flag-icons/react/3x2";
import GB from "country-flag-icons/react/3x2/GB";
import SE from "country-flag-icons/react/3x2/SE";
import { useTranslation } from "react-i18next";
import { localeFlagMap } from "./locale-flag-map";

// ---------------------------------------------------------------------------
// Static map: ISO 3166-1 alpha-2 country code → flag SVG React component.
// Add a new entry here (and in localeFlagMap) whenever a new locale is added.
// ---------------------------------------------------------------------------
const flagComponents: Record<string, FlagComponent> = {
  GB,
  SE,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LanguageSelectorProps {
  /** The currently active locale code, e.g. "en". */
  currentLocale: string;
  /** Callback invoked with the newly selected locale string when the user changes locale. */
  onLocaleChange: (locale: string) => void;
}

export function LanguageSelector({
  currentLocale,
  onLocaleChange,
}: LanguageSelectorProps) {
  const { t } = useTranslation("common");

  const handleChange = (event: SelectChangeEvent<string>) => {
    onLocaleChange(event.target.value);
  };

  return (
    <Select
      value={currentLocale}
      onChange={handleChange}
      size="small"
      inputProps={{ "aria-label": t("languageSelector.label", "Select language") }}
      sx={{
        color: "inherit",
        ".MuiOutlinedInput-notchedOutline": { border: 0 },
      }}
    >
      {Object.keys(localeFlagMap).map((locale) => {
        const countryCode = localeFlagMap[locale];
        const FlagIcon =
          countryCode !== undefined
            ? (flagComponents[countryCode] ?? null)
            : null;

        return (
          <MenuItem key={locale} value={locale}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              {FlagIcon !== null && (
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
                  <FlagIcon aria-hidden="true" />
                </Box>
              )}
              {t(`languageSelector.${locale}`, locale.toUpperCase())}
            </Box>
          </MenuItem>
        );
      })}
    </Select>
  );
}
