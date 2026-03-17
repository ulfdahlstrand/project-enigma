/**
 * Material UI theme configuration — Google Docs / Google Drive inspired.
 *
 * Design tokens:
 *   Primary:    Google Blue  #1a73e8
 *   Background: Light gray   #F1F3F4  (the "desktop" behind white surfaces)
 *   Surface:    White        #FFFFFF
 *   Sidebar:    White        #FFFFFF  with blue active pill
 *   Text:       Near-black   #202124  / muted #5F6368
 *   Divider:                 #DADCE0
 */
import { createTheme } from "@mui/material/styles";

export const SIDEBAR_WIDTH = 240;

export const theme = createTheme({
  palette: {
    mode: "light",
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
    success: {
      main: "#188038",
    },
    error: {
      main: "#d93025",
    },
    warning: {
      main: "#f9ab00",
    },
    background: {
      default: "#F1F3F4",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#202124",
      secondary: "#5F6368",
    },
    divider: "#DADCE0",
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
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: "#F1F3F4" },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          color: "#202124",
          borderBottom: "1px solid #DADCE0",
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
          borderColor: "#DADCE0",
          color: "#1a73e8",
          "&:hover": {
            backgroundColor: "#e8f0fe",
            borderColor: "#1a73e8",
          },
        },
        text: {
          color: "#1a73e8",
          "&:hover": { backgroundColor: "#e8f0fe" },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid #DADCE0",
          borderRadius: 8,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: "#FFFFFF",
            fontWeight: 500,
            fontSize: "0.75rem",
            color: "#5F6368",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            borderBottom: "1px solid #DADCE0",
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": { borderBottom: 0 },
          "&.MuiTableRow-hover:hover": {
            backgroundColor: "#F8F9FA",
            cursor: "pointer",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "#DADCE0",
          fontSize: "0.875rem",
          padding: "10px 16px",
          color: "#202124",
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
          backgroundColor: "#e8f0fe",
          color: "#1a73e8",
        },
        colorSuccess: {
          backgroundColor: "#e6f4ea",
          color: "#188038",
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
            "& fieldset": { borderColor: "#DADCE0" },
            "&:hover fieldset": { borderColor: "#1a73e8" },
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: "#DADCE0" },
      },
    },
  },
});
