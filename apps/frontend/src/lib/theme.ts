/**
 * Material UI theme configuration — Microsoft Office 365 / Word inspired.
 *
 * Design tokens (Fluent UI):
 *   Header:     Word blue    #2B579A  (white text)
 *   Primary:    MS blue      #0078D4
 *   Background: Warm gray    #F3F2F1
 *   Surface:    White        #FFFFFF
 *   Sidebar:    White with left-border active indicator
 *   Text:       Near-black   #323130  / muted #605E5C
 *   Divider:                 #EDEBE9
 */
import { createTheme } from "@mui/material/styles";

export const HEADER_BG = "#2B579A";
export const SIDEBAR_WIDTH = 228;

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0078D4",
      light: "#2B88D8",
      dark: "#005A9E",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#107C10",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#107C10",
    },
    error: {
      main: "#A4262C",
    },
    warning: {
      main: "#C19C00",
    },
    background: {
      default: "#F3F2F1",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#323130",
      secondary: "#605E5C",
    },
    divider: "#EDEBE9",
  },
  typography: {
    fontFamily: [
      '"Segoe UI"',
      "-apple-system",
      "BlinkMacSystemFont",
      "Roboto",
      "sans-serif",
    ].join(","),
    fontSize: 14,
    h1: { fontWeight: 600, fontSize: "1.75rem" },
    h2: { fontWeight: 600, fontSize: "1.5rem" },
    h3: { fontWeight: 600, fontSize: "1.25rem" },
    h4: { fontWeight: 600, fontSize: "1.125rem" },
    h5: { fontWeight: 600, fontSize: "1rem" },
    h6: { fontWeight: 600, fontSize: "0.875rem" },
    body1: { fontSize: "0.875rem", lineHeight: 1.5 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.43 },
    button: { textTransform: "none", fontWeight: 600, fontSize: "0.875rem" },
  },
  shape: {
    borderRadius: 2,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: "#F3F2F1" },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: HEADER_BG,
          color: "#FFFFFF",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 2,
          padding: "5px 16px",
          fontWeight: 600,
          minHeight: 32,
        },
        containedPrimary: {
          backgroundColor: "#0078D4",
          "&:hover": { backgroundColor: "#005A9E" },
        },
        outlinedPrimary: {
          borderColor: "#0078D4",
          color: "#0078D4",
          "&:hover": {
            backgroundColor: "#EFF6FC",
            borderColor: "#005A9E",
          },
        },
        text: {
          color: "#0078D4",
          "&:hover": { backgroundColor: "#EFF6FC" },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid #EDEBE9",
          borderRadius: 2,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: "#FAF9F8",
            fontWeight: 600,
            fontSize: "0.75rem",
            color: "#605E5C",
            borderBottom: "2px solid #EDEBE9",
            paddingTop: 8,
            paddingBottom: 8,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": { borderBottom: 0 },
          "&.MuiTableRow-hover:hover": {
            backgroundColor: "#F3F2F1",
            cursor: "pointer",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "#EDEBE9",
          fontSize: "0.875rem",
          padding: "8px 16px",
          color: "#323130",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: "0.75rem",
          height: 24,
          borderRadius: 2,
        },
        colorPrimary: {
          backgroundColor: "#EFF6FC",
          color: "#0078D4",
        },
        colorSuccess: {
          backgroundColor: "#DFF6DD",
          color: "#107C10",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          paddingLeft: 20,
          paddingTop: 8,
          paddingBottom: 8,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 2 },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 2,
            "& fieldset": { borderColor: "#EDEBE9" },
            "&:hover fieldset": { borderColor: "#0078D4" },
          },
        },
      },
    },
  },
});
