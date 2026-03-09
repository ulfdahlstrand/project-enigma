/**
 * LanguageSelector component — renders a language dropdown in the Header.
 *
 * Replaces the former EN/FR toggle button. Uses an MUI Select + MenuItem
 * structure so that adding a new language in the future only requires adding
 * an entry to the `LANGUAGES` array — no structural JSX changes are needed.
 *
 * Flag SVGs come from country-flag-icons/react/3x2 (GB for English, SE for Swedish).
 * All styling is applied exclusively via the MUI sx prop.
 */
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import GB from "country-flag-icons/react/3x2/GB";
import SE from "country-flag-icons/react/3x2/SE";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Single iterable data structure — the only place languages are declared.
// To add a new language: add one entry here; nothing else changes in this file.
// ---------------------------------------------------------------------------
const LANGUAGES = [
  { locale: "en", FlagIcon: GB, label: "English" },
  { locale: "sv", FlagIcon: SE, label: "Svenska" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const handleChange = (event: SelectChangeEvent<string>) => {
    void i18n.changeLanguage(event.target.value);
  };

  return (
    <Select
      value={i18n.language.startsWith("sv") ? "sv" : "en"}
      onChange={handleChange}
      size="small"
      inputProps={{ "aria-label": "Select language" }}
      sx={{
        color: "inherit",
        ".MuiOutlinedInput-notchedOutline": { border: 0 },
        ".MuiSelect-icon": { color: "inherit" },
      }}
    >
      {LANGUAGES.map(({ locale, FlagIcon, label }) => (
        <MenuItem key={locale} value={locale}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 24,
                height: 16,
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <FlagIcon aria-hidden="true" width={24} height={16} />
            </Box>
            {label}
          </Box>
        </MenuItem>
      ))}
    </Select>
  );
}
