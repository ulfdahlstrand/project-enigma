import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grow from "@mui/material/Grow";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { ResumeSaveSplitButton } from "../ResumeSaveSplitButton";
import { ResumeHistoryDrawer } from "./ResumeHistoryDrawer";
import { ResumeDeleteDialog } from "./ResumeDeleteDialog";

type ResumeCommitRow = {
  id: string;
  title: string | null;
  createdAt: string | Date | null;
};

interface ResumeDetailActionsProps {
  resumeId: string;
  resumeTitle: string;
  activeBranchId: string | null;
  activeBranchName: string | null;
  currentCommitId: string | null;
  isEditRoute: boolean;
  isSnapshotMode: boolean;
  isEditing: boolean;
  baseCommitId: string | null;
  isSaving: boolean;
  canSaveAsNewVersion: boolean;
  onSaveCurrent: () => void;
  onSaveAsNewVersion: (name: string) => Promise<void>;
  onCreateBranchFromCommit: (name: string) => Promise<void>;
  onEdit: () => void;
  onExitEdit: () => void;
  onDeleteResume: () => void;
  isDeletePending: boolean;
  isDeleteError: boolean;
  recentCommits: ResumeCommitRow[];
  language: string | null;
}

type ExportFormat = "pdf" | "docx" | "markdown";
const EXPORT_OPTIONS: ExportFormat[] = ["pdf", "docx", "markdown"];

function ExportSplitButton({
  resumeId,
  commitId,
  branchId,
}: {
  resumeId: string;
  commitId?: string | null;
  branchId?: string | null;
}) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExportFormat>("pdf");
  const anchorRef = useState<HTMLDivElement | null>(null);

  async function triggerDownload(format: ExportFormat): Promise<void> {
    const { orpc } = await import("../../orpc-client");
    const exportInput = {
      resumeId,
      ...(commitId ? { commitId } : {}),
      ...(branchId ? { branchId } : {}),
    };

    if (format === "pdf") {
      const result = await orpc.exportResumePdf(exportInput);
      const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "docx") {
      const result = await orpc.exportResumeDocx(exportInput);
      const bytes = Uint8Array.from(atob(result.docx), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const result = await orpc.exportResumeMarkdown(exportInput);
      const blob = new Blob([result.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <>
      <ButtonGroup
        variant="outlined"
        ref={(el) => {
          anchorRef[1](el);
        }}
      >
        <Button onClick={() => void triggerDownload(selected)}>
          {t(`resume.detail.export.${selected}`)}
        </Button>
        <Button size="small" onClick={() => setOpen((p) => !p)} aria-label={t("resume.detail.export.selectFormat")}>
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Popper open={open} anchorEl={anchorRef[0]} placement="bottom-end" transition disablePortal sx={{ zIndex: 1300 }}>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper>
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <MenuList autoFocusItem>
                  {EXPORT_OPTIONS.map((fmt) => (
                    <MenuItem
                      key={fmt}
                      selected={fmt === selected}
                      onClick={() => {
                        setSelected(fmt);
                        setOpen(false);
                        void triggerDownload(fmt);
                      }}
                    >
                      {t(`resume.detail.export.${fmt}`)}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}

function EditButton({ onEdit }: { onEdit: () => void }) {
  const { t } = useTranslation("common");

  return (
    <Button variant="contained" startIcon={<EditIcon />} onClick={onEdit}>
      {t("resume.detail.editButton")}
    </Button>
  );
}

export function ResumeDetailActions({
  resumeId,
  resumeTitle,
  activeBranchId,
  activeBranchName,
  currentCommitId,
  isEditRoute,
  isSnapshotMode,
  isEditing,
  baseCommitId,
  isSaving,
  canSaveAsNewVersion,
  onSaveCurrent,
  onSaveAsNewVersion,
  onCreateBranchFromCommit,
  onEdit,
  onExitEdit,
  onDeleteResume,
  isDeletePending,
  isDeleteError,
  recentCommits,
  language,
}: ResumeDetailActionsProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moreActionsAnchorEl, setMoreActionsAnchorEl] = useState<HTMLElement | null>(null);
  const [createBranchDialogOpen, setCreateBranchDialogOpen] = useState(false);
  const [createBranchName, setCreateBranchName] = useState("");
  const [createBranchError, setCreateBranchError] = useState<string | null>(null);

  const openComparePage = () => {
    void navigate({
      to: "/resumes/$id/compare",
      params: { id: resumeId },
    });
  };

  const sharedMoreMenu = (
    <Menu
      anchorEl={moreActionsAnchorEl}
      open={Boolean(moreActionsAnchorEl)}
      onClose={() => setMoreActionsAnchorEl(null)}
    >
      <MenuItem
        onClick={() => {
          setMoreActionsAnchorEl(null);
          openComparePage();
        }}
      >
        <ViewAgendaIcon fontSize="small" sx={{ mr: 1 }} />
        {t("revision.inline.compareButton")}
      </MenuItem>
      {isSnapshotMode && currentCommitId && (
        <MenuItem
          onClick={() => {
            setMoreActionsAnchorEl(null);
            setCreateBranchError(null);
            setCreateBranchName("");
            setCreateBranchDialogOpen(true);
          }}
        >
          <CallSplitIcon fontSize="small" sx={{ mr: 1 }} />
          {t("resume.detail.createBranchFromCommitMenuItem")}
        </MenuItem>
      )}
      {!isSnapshotMode && (
        <MenuItem
          onClick={() => {
            setMoreActionsAnchorEl(null);
            setDeleteDialogOpen(true);
          }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          {t("resume.detail.deleteButton")}
        </MenuItem>
      )}
    </Menu>
  );

  return (
    <>
      {isEditing ? (
        <>
          <ResumeSaveSplitButton
            onSaveCurrent={onSaveCurrent}
            onSaveAsNewVersion={onSaveAsNewVersion}
            canSaveAsNewVersion={canSaveAsNewVersion && baseCommitId !== null}
            isPending={isSaving}
          />
          <Button variant="outlined" onClick={onExitEdit}>
            {t("resume.edit.backButton")}
          </Button>
        </>
      ) : (
        <>
          <ExportSplitButton
            resumeId={resumeId}
            commitId={currentCommitId}
            branchId={activeBranchId}
          />
          {!isSnapshotMode ? <EditButton onEdit={onEdit} /> : null}
        </>
      )}
      <IconButton
        aria-label={t("resume.detail.historyButton")}
        onClick={() => setHistoryOpen(true)}
      >
        <HistoryIcon />
      </IconButton>
      <IconButton
        aria-label={t("resume.detail.moreActionsLabel")}
        onClick={(event) => setMoreActionsAnchorEl(event.currentTarget)}
      >
        <MoreVertIcon />
      </IconButton>

      {sharedMoreMenu}

      <Dialog open={createBranchDialogOpen} onClose={() => setCreateBranchDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("resume.variants.createDialog.title")}</DialogTitle>
        <DialogContent>
          {createBranchError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createBranchError}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            label={t("resume.variants.createDialog.nameLabel")}
            value={createBranchName}
            onChange={(event) => setCreateBranchName(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateBranchDialogOpen(false)}>
            {t("resume.variants.createDialog.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={!createBranchName.trim() || isSaving}
            onClick={() => {
              void (async () => {
                try {
                  setCreateBranchError(null);
                  await onCreateBranchFromCommit(createBranchName.trim());
                  setCreateBranchDialogOpen(false);
                  setCreateBranchName("");
                } catch {
                  setCreateBranchError(t("resume.variants.createDialog.error"));
                }
              })();
            }}
          >
            {isSaving
              ? t("resume.variants.createDialog.creating")
              : t("resume.variants.createDialog.create")}
          </Button>
        </DialogActions>
      </Dialog>

      <ResumeHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        resumeId={resumeId}
        activeBranchId={activeBranchId}
        activeBranchName={activeBranchName}
        currentCommitId={currentCommitId}
        recentCommits={recentCommits}
        language={language ?? null}
      />

      <ResumeDeleteDialog
        open={deleteDialogOpen}
        title={resumeTitle}
        isPending={isDeletePending}
        isError={isDeleteError}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={onDeleteResume}
      />
    </>
  );
}
