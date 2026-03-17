/**
 * Material UI theme configuration — Slack-inspired light theme.
 *
 * Design tokens:
 *   Sidebar:  aubergine (#3F0E40) with white text
 *   Primary:  #611F69 (Slack purple)
 *   Success:  #007A5A (Slack green)
 *   Surface:  #F8F8F8
 *   Text:     #1D1C1D / #616061
 */
import { createTheme } from "@mui/material/styles";

export const SIDEBAR_BG = "#3F0E40";
export const SIDEBAR_WIDTH = 220;

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#611F69",
      light: "#7C3085",
      dark: "#4A154B",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#007A5A",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#007A5A",
    },
    background: {
      default: "#F8F8F8",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#1D1C1D",
      secondary: "#616061",
    },
    divider: "#E8E8E8",
  },
  typography: {
    fontFamily: [
      "Inter",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      "sans-serif",
    ].join(","),
    fontSize: 14,
    h1: { fontWeight: 700, fontSize: "1.75rem" },
    h2: { fontWeight: 700, fontSize: "1.5rem" },
    h3: { fontWeight: 700, fontSize: "1.25rem" },
    h4: { fontWeight: 700, fontSize: "1.125rem" },
    h5: { fontWeight: 600, fontSize: "1rem" },
    h6: { fontWeight: 700, fontSize: "0.9375rem" },
    body1: { fontSize: "0.9375rem", lineHeight: 1.5 },
    body2: { fontSize: "0.875rem", lineHeight: 1.46667 },
    button: { textTransform: "none", fontWeight: 700, fontSize: "0.9375rem" },
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#F8F8F8",
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: SIDEBAR_BG,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: "6px 14px",
          fontWeight: 700,
        },
        containedPrimary: {
          backgroundColor: "#007A5A",
          "&:hover": { backgroundColor: "#006048" },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid #E8E8E8",
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: "#F8F8F8",
            fontWeight: 700,
            fontSize: "0.8125rem",
            color: "#616061",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            borderBottom: "1px solid #E8E8E8",
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": { borderBottom: 0 },
          "&.MuiTableRow-hover:hover": {
            backgroundColor: "#F8F8F8",
            cursor: "pointer",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "#E8E8E8",
          fontSize: "0.9375rem",
          padding: "10px 16px",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: "0.75rem",
          height: 22,
          borderRadius: 4,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: "1px 8px",
          padding: "6px 10px",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
  },
});
