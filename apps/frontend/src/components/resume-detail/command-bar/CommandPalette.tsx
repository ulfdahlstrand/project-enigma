/**
 * CommandPalette — cmdk-based ⌘K command palette.
 *
 * Open/close state lives in URL via nuqs: ?cmd=open.
 *
 * Styling note: cmdk primitives (Command, Command.Input, etc.) do not accept
 * MUI sx props. Instead we use emotion `styled` wrappers to apply theme-aware
 * styles on the cmdk primitives. Non-cmdk wrappers (Dialog, Box) still use sx.
 *
 * Focus trapping: cmdk's Command.Dialog handles this internally.
 * Keyboard: ⌘K / Ctrl+K open (handled in ResumeCommandBar); Esc closes
 * (handled by this component and cmdk's Dialog). Arrow keys + Enter navigate.
 */
import { Command } from "cmdk";
import { styled } from "@mui/material/styles";
import Dialog from "@mui/material/Dialog";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useQueryState, parseAsString } from "nuqs";
import type { PaletteAction } from "./useCommandPaletteActions";

// ---------------------------------------------------------------------------
// Styled cmdk wrappers
// Note: we style cmdk primitives via emotion styled() since they don't accept
// MUI sx. This is the documented exception for third-party component styling.
// ---------------------------------------------------------------------------

const StyledCommand = styled(Command)(({ theme }) => ({
  width: "100%",
  backgroundColor: "transparent",
  fontFamily: theme.typography.fontFamily,
}));

const StyledInput = styled(Command.Input)(({ theme }) => ({
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  padding: theme.spacing(1.5, 2),
  fontSize: theme.typography.body1.fontSize,
  color: theme.palette.text.primary,
  "&::placeholder": {
    color: theme.palette.text.disabled,
  },
}));

const StyledList = styled(Command.List)(({ theme }) => ({
  maxHeight: 320,
  overflowY: "auto",
  padding: theme.spacing(0.5, 0),
}));

const StyledGroup = styled(Command.Group)(({ theme }) => ({
  "& [cmdk-group-heading]": {
    padding: theme.spacing(0.5, 2),
    fontSize: 11,
    fontWeight: 600,
    color: theme.palette.text.disabled,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
}));

const StyledItem = styled(Command.Item)(({ theme }) => ({
  padding: theme.spacing(0.75, 2),
  borderRadius: theme.shape.borderRadius,
  cursor: "pointer",
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.primary,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  outline: "none",
  '&[aria-selected="true"]': {
    backgroundColor: theme.palette.action.selected,
  },
  '&[aria-disabled="true"]': {
    color: theme.palette.text.disabled,
    cursor: "not-allowed",
    pointerEvents: "none",
  },
  "&[cmdk-item]:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  actions: PaletteAction[];
  /** resumeId is available for future use (deep links, analytics). */
  resumeId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette({ actions }: CommandPaletteProps) {
  const [cmdParam, setCmdParam] = useQueryState("cmd", parseAsString);

  const isOpen = cmdParam === "open";

  function handleClose() {
    void setCmdParam(null);
  }

  // Group actions by their group label
  const groups = actions.reduce<Record<string, PaletteAction[]>>((acc, action) => {
    const group = action.group;
    if (!acc[group]) {
      return { ...acc, [group]: [action] };
    }
    return { ...acc, [group]: [...acc[group], action] };
  }, {});

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "background.paper",
          boxShadow: 8,
        },
      }}
    >
      <Box sx={{ width: "100%" }}>
        <StyledCommand loop>
          <Box
            sx={{
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <StyledInput placeholder="Search commands…" autoFocus />
          </Box>

          <StyledList>
            <Command.Empty>
              <Typography
                variant="body2"
                sx={{ px: 2, py: 1.5, color: "text.disabled", textAlign: "center" }}
              >
                No commands found.
              </Typography>
            </Command.Empty>

            {Object.entries(groups).map(([groupName, groupActions]) => (
              <StyledGroup key={groupName} heading={groupName}>
                {groupActions.map((action) => (
                  <StyledItem
                    key={action.id}
                    value={action.label}
                    disabled={action.disabled}
                    onSelect={() => {
                      if (!action.disabled) {
                        action.onSelect();
                      }
                    }}
                  >
                    {action.label}
                  </StyledItem>
                ))}
              </StyledGroup>
            ))}
          </StyledList>
        </StyledCommand>
      </Box>
    </Dialog>
  );
}
