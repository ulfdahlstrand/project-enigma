import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import type { ReactNode } from "react";

const PAGE_WIDTH = 794;
const PAGE_MIN_HEIGHT = 1123;
const PAGE_MX = "80px";
const PAGE_MY = "56px";
const HEADER_HEIGHT = 52;
const FOOTER_HEIGHT = 40;

interface ResumeDocumentPageProps {
  children: ReactNode;
  title: string;
  language?: string | undefined;
  page: number;
  totalPages: number;
  hideHeader?: boolean;
}

export function ResumeDocumentPage({
  children,
  title,
  language,
  page,
  totalPages,
  hideHeader = false,
}: ResumeDocumentPageProps) {
  return (
    <Paper
      elevation={2}
      sx={{
        width: PAGE_WIDTH,
        maxWidth: "100%",
        minHeight: PAGE_MIN_HEIGHT,
        border: "none",
        borderRadius: "2px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {!hideHeader && (
        <Box
          sx={{
            height: HEADER_HEIGHT,
            flexShrink: 0,
            borderBottom: "1px solid transparent",
            px: PAGE_MX,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {title}
          </Typography>
          {language && (
            <Chip label={language.toUpperCase()} size="small" sx={{ fontSize: "0.7rem", height: 20 }} />
          )}
        </Box>
      )}

      <Box sx={{ flexGrow: 1, px: PAGE_MX, py: PAGE_MY, display: "flex", flexDirection: "column" }}>
        {children}
      </Box>

      <Box
        sx={{
          height: FOOTER_HEIGHT,
          flexShrink: 0,
          borderTop: "1px solid transparent",
          px: PAGE_MX,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
          sthlm tech
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {page} / {totalPages}
        </Typography>
      </Box>
    </Paper>
  );
}
