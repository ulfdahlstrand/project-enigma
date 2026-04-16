import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

const ZOOM_STEP = 0.1;

interface ZoomControlProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  setZoom: (zoom: number) => void;
}

export function ZoomControl({ zoom, minZoom, maxZoom, setZoom }: ZoomControlProps) {
  const { t } = useTranslation("common");
  const zoomPercent = Math.round(zoom * 100);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
      <IconButton
        size="small"
        aria-label={t("resume.detail.zoomOutLabel")}
        onClick={() => setZoom(zoom - ZOOM_STEP)}
        sx={{ width: 20, height: 20, color: "text.secondary" }}
      >
        <RemoveIcon sx={{ fontSize: 14 }} />
      </IconButton>
      <Slider
        aria-label={t("resume.detail.zoomLabel")}
        min={minZoom}
        max={maxZoom}
        step={ZOOM_STEP}
        value={zoom}
        onChange={(_event, value) => setZoom(value as number)}
        sx={{
          width: { xs: 72, md: 96 },
          color: "grey.600",
          py: 0,
          "& .MuiSlider-thumb": { width: 10, height: 10 },
          "& .MuiSlider-rail": { opacity: 1, bgcolor: "grey.400" },
        }}
      />
      <IconButton
        size="small"
        aria-label={t("resume.detail.zoomInLabel")}
        onClick={() => setZoom(zoom + ZOOM_STEP)}
        sx={{ width: 20, height: 20, color: "text.secondary" }}
      >
        <AddIcon sx={{ fontSize: 14 }} />
      </IconButton>
      <Typography
        variant="caption"
        sx={{ fontWeight: 600, minWidth: 32, textAlign: "right", fontSize: 10.5 }}
      >
        {zoomPercent}%
      </Typography>
    </Box>
  );
}
