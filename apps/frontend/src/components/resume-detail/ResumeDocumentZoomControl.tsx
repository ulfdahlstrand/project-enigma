import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import { useTranslation } from "react-i18next";

interface ResumeDocumentZoomControlProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  defaultZoom: number;
  onZoomChange: (value: number) => void;
}

export function ResumeDocumentZoomControl({
  zoom,
  minZoom,
  maxZoom,
  defaultZoom,
  onZoomChange,
}: ResumeDocumentZoomControlProps) {
  const { t } = useTranslation("common");
  const zoomPercent = Math.round(zoom * 100);

  return (
    <Box
      sx={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: (theme) => theme.zIndex.speedDial,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 1.5,
        "&:hover .resume-zoom-panel, &:focus-within .resume-zoom-panel": {
          width: 240,
          opacity: 1,
          transform: "translateX(0)",
          pointerEvents: "auto",
        },
      }}
    >
      <Paper
        elevation={4}
        className="resume-zoom-panel"
        sx={{
          width: 0,
          opacity: 0,
          overflow: "hidden",
          pointerEvents: "none",
          transform: "translateX(12px)",
          transition: "width 180ms ease, opacity 180ms ease, transform 180ms ease",
          px: 2,
          py: 1.5,
          borderRadius: 3,
          bgcolor: "background.paper",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, minWidth: 220 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              size="small"
              aria-label={t("resume.detail.zoomOutLabel")}
              onClick={() => onZoomChange(zoom - 0.1)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: "transparent",
                p: 0,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>
                -
              </Typography>
            </IconButton>
            <Slider
              aria-label={t("resume.detail.zoomLabel")}
              min={minZoom}
              max={maxZoom}
              step={0.1}
              value={zoom}
              onChange={(_event, value) => onZoomChange(value as number)}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              sx={{ flex: 1, mx: 0.5 }}
            />
            <IconButton
              size="small"
              aria-label={t("resume.detail.zoomInLabel")}
              onClick={() => onZoomChange(zoom + 0.1)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: "transparent",
                p: 0,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>
                +
              </Typography>
            </IconButton>
          </Box>
        </Box>
      </Paper>
      <Fab
        color="default"
        size="small"
        aria-label={t("resume.detail.zoomLabel")}
        sx={{
          flexShrink: 0,
          bgcolor: "background.paper",
          color: "text.primary",
          opacity: 0.76,
          width: "auto",
          minWidth: 0,
          minHeight: 38,
          height: 38,
          px: 1.5,
          borderRadius: 999,
          gap: 0.75,
          boxShadow: 1,
          "&:hover": {
            bgcolor: "background.paper",
            opacity: 0.9,
          },
        }}
      >
        <ZoomInIcon sx={{ fontSize: 18 }} />
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {zoomPercent}%
        </Typography>
      </Fab>
    </Box>
  );
}
