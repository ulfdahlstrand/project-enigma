/**
 * Material UI theme configuration — Google Docs / Google Drive inspired.
 *
 * Design tokens (light):
 *   Primary:    Google Blue  #1a73e8
 *   Background: Light gray   #F1F3F4
 *   Surface:    White        #FFFFFF
 *   Text:       Near-black   #202124  / muted #5F6368
 *   Divider:                 #DADCE0
 *
 * Dark mode mirrors the same component overrides using MUI's built-in
 * dark palette — surfaces become #1e1e1e / #2d2d2d, dividers #3c3c3c.
 */
import { createTheme, type PaletteMode } from "@mui/material/styles";

export const SIDEBAR_WIDTH = 240;

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#1a73e8",
        light: "#4285f4",
        dark: "#1557b0",
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: "#188038",
        contrastText: "#FFFFFF",
      },
      success: { main: "#188038" },
      error: { main: "#d93025" },
      warning: { main: "#f9ab00" },
      background: {
        default: isDark ? "#121212" : "#F1F3F4",
        paper: isDark ? "#1e1e1e" : "#FFFFFF",
      },
      text: {
        primary: isDark ? "#e8eaed" : "#202124",
        secondary: isDark ? "#9aa0a6" : "#5F6368",
      },
      divider: isDark ? "#3c3c3c" : "#DADCE0",
    },
    typography: {
      fontFamily: [
        "Roboto",
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "sans-serif",
      ].join(","),
      fontSize: 14,
      h1: { fontWeight: 400, fontSize: "1.75rem" },
      h2: { fontWeight: 400, fontSize: "1.5rem" },
      h3: { fontWeight: 500, fontSize: "1.25rem" },
      h4: { fontWeight: 500, fontSize: "1.125rem" },
      h5: { fontWeight: 500, fontSize: "1rem" },
      h6: { fontWeight: 500, fontSize: "0.9375rem" },
      body1: { fontSize: "0.875rem", lineHeight: 1.5 },
      body2: { fontSize: "0.8125rem", lineHeight: 1.5 },
      button: { textTransform: "none", fontWeight: 500, fontSize: "0.875rem" },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: isDark ? "#121212" : "#F1F3F4" },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#1e1e1e" : "#FFFFFF",
            color: isDark ? "#e8eaed" : "#202124",
            borderBottom: `1px solid ${isDark ? "#3c3c3c" : "#DADCE0"}`,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 4,
            padding: "6px 16px",
            fontWeight: 500,
            letterSpacing: "0.01em",
          },
          containedPrimary: {
            backgroundColor: "#1a73e8",
            "&:hover": { backgroundColor: "#1557b0" },
          },
          outlinedPrimary: {
            borderColor: isDark ? "#3c3c3c" : "#DADCE0",
            color: "#1a73e8",
            "&:hover": {
              backgroundColor: isDark ? "rgba(26,115,232,0.12)" : "#e8f0fe",
              borderColor: "#1a73e8",
            },
          },
          text: {
            color: "#1a73e8",
            "&:hover": {
              backgroundColor: isDark ? "rgba(26,115,232,0.12)" : "#e8f0fe",
            },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? "#3c3c3c" : "#DADCE0"}`,
            borderRadius: 8,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            "& .MuiTableCell-head": {
              backgroundColor: isDark ? "#1e1e1e" : "#FFFFFF",
              fontWeight: 500,
              fontSize: "0.75rem",
              color: isDark ? "#9aa0a6" : "#5F6368",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              borderBottom: `1px solid ${isDark ? "#3c3c3c" : "#DADCE0"}`,
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:last-child td": { borderBottom: 0 },
            "&.MuiTableRow-hover:hover": {
              backgroundColor: isDark ? "#2a2a2a" : "#F8F9FA",
              cursor: "pointer",
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? "#3c3c3c" : "#DADCE0",
            fontSize: "0.875rem",
            padding: "10px 16px",
            color: isDark ? "#e8eaed" : "#202124",
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            fontSize: "0.75rem",
            height: 24,
            borderRadius: 12,
          },
          colorPrimary: {
            backgroundColor: isDark ? "rgba(26,115,232,0.2)" : "#e8f0fe",
            color: "#1a73e8",
          },
          colorSuccess: {
            backgroundColor: isDark ? "rgba(24,128,56,0.2)" : "#e6f4ea",
            color: isDark ? "#57bb77" : "#188038",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: "0 24px 24px 0",
            marginRight: 16,
            paddingLeft: 16,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 8, border: "none" },
        },
      },
      MuiTextField: {
        defaultProps: { size: "small" },
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: isDark ? "#3c3c3c" : "#DADCE0" },
              "&:hover fieldset": { borderColor: "#1a73e8" },
            },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: isDark ? "#3c3c3c" : "#DADCE0" },
        },
      },
    },
  });
}

/** Backwards-compatible static light theme (used in tests). */
export const theme = createAppTheme("light");
