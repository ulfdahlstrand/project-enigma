import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import type { ReactNode } from "react";

export interface SideToolbarAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ResumePageSideToolbarProps {
  actions: SideToolbarAction[];
}

export function ResumePageSideToolbar({ actions }: ResumePageSideToolbarProps) {
  if (actions.length === 0) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignSelf: "flex-start",
        ml: 1,
        mt: 2,
        bgcolor: "background.paper",
        borderRadius: 6,
        boxShadow: 2,
        py: 0.5,
        px: 0.25,
      }}
    >
      {actions.map((action, i) => (
        <Tooltip key={i} title={action.label} placement="right">
          <span>
            <IconButton
              size="small"
              aria-label={action.label}
              onClick={action.onClick}
              disabled={action.disabled ?? false}
              sx={{
                color: "primary.main",
                m: 0.25,
                "&:hover": { bgcolor: "action.hover" },
                "&.Mui-disabled": { color: "action.disabled" },
              }}
            >
              {action.icon}
            </IconButton>
          </span>
        </Tooltip>
      ))}
    </Box>
  );
}
