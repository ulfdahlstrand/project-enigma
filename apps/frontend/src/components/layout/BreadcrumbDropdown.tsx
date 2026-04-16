/**
 * BreadcrumbDropdown — a ghost select that looks like plain breadcrumb text.
 * Renders as "{label} ▾" with no border or background. Opens a MUI Menu on click.
 *
 * Styling: MUI sx prop only
 */
import { useState } from "react";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

export interface BreadcrumbDropdownOption {
  id: string;
  label: string;
}

interface BreadcrumbDropdownProps {
  /** Currently selected option label. */
  label: string;
  options: BreadcrumbDropdownOption[];
  /** Called with the selected option id when the user picks one. */
  onSelect: (id: string) => void;
  /** If true, the trigger text uses the active/current-page color instead of inherit. */
  isCurrentPage?: boolean;
  /** Label for the "add" action shown at the top of the menu. */
  addLabel?: string;
  /** Called when the user clicks the "add" action. */
  onAdd?: () => void;
}

export function BreadcrumbDropdown({
  label,
  options,
  onSelect,
  isCurrentPage = false,
  addLabel,
  onAdd,
}: BreadcrumbDropdownProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  function handleOpen(e: React.MouseEvent<HTMLElement>) {
    setAnchor(e.currentTarget);
  }

  function handleClose() {
    setAnchor(null);
  }

  function handleSelect(id: string) {
    handleClose();
    onSelect(id);
  }

  return (
    <>
      <Button
        onClick={handleOpen}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: "0.85em !important", ml: "-2px" }} />}
        disableRipple
        sx={{
          typography: "caption",
          color: isCurrentPage ? "text.primary" : "text.secondary",
          px: 0,
          py: 0,
          minWidth: 0,
          height: "auto",
          lineHeight: "inherit",
          background: "transparent",
          border: "none",
          textTransform: "none",
          fontWeight: isCurrentPage ? 500 : 400,
          letterSpacing: "inherit",
          "&:hover": {
            background: "transparent",
            color: "text.primary",
            textDecoration: "underline",
          },
          "& .MuiButton-endIcon": {
            ml: 0.25,
            mr: "-6px",
            color: "text.disabled",
            opacity: 0,
            transition: "opacity 0.15s",
          },
          "&:hover .MuiButton-endIcon": {
            opacity: 1,
          },
        }}
      >
        {label}
      </Button>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={handleClose}
        slotProps={{ paper: { elevation: 3, sx: { mt: 0.5 } } }}
      >
        {onAdd && addLabel && (
          <MenuItem
            dense
            onClick={() => { handleClose(); onAdd(); }}
            sx={{ fontStyle: "italic" }}
          >
            {addLabel}
          </MenuItem>
        )}
        {onAdd && addLabel && <Divider />}
        {options.map((opt) => (
          <MenuItem
            key={opt.id}
            selected={opt.label === label}
            onClick={() => handleSelect(opt.id)}
            dense
          >
            {opt.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
