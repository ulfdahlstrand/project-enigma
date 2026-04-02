import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Grow from "@mui/material/Grow";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { ResumeSaveSplitButton } from "../ResumeSaveSplitButton";
import { ResumeHistoryDrawer } from "./ResumeHistoryDrawer";
import { ResumeDeleteDialog } from "./ResumeDeleteDialog";

type ResumeCommitRow = {
  id: string;
  message: string | null;
  createdAt: string | Date | null;
};

interface ResumeDetailActionsProps {
  resumeId: string;
  resumeTitle: string;
  activeBranchId: string | null;
  isEditRoute: boolean;
  isSnapshotMode: boolean;
  isEditing: boolean;
  isRevisionOpen: boolean;
  baseCommitId: string | null;
  isSaving: boolean;
  canSaveAsNewVersion: boolean;
  onSaveCurrent: () => void;
  onSaveAsNewVersion: (name: string) => Promise<void>;
  onEdit: () => void;
  onOpenAiHelp: () => void;
  onReviseWithAi: () => void;
  onCloseRevision: () => void;
  onDeleteResume: () => void;
  isDeletePending: boolean;
  isDeleteError: boolean;
  recentCommits: ResumeCommitRow[];
  language: string | null;
}

type ExportFormat = "pdf" | "docx" | "markdown";
const EXPORT_OPTIONS: ExportFormat[] = ["pdf", "docx", "markdown"];

function ExportSplitButton({ resumeId }: { resumeId: string }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExportFormat>("pdf");
  const anchorRef = useState<HTMLDivElement | null>(null);

  async function triggerDownload(format: ExportFormat): Promise<void> {
    const { orpc } = await import("../../orpc-client");

    if (format === "pdf") {
      const result = await orpc.exportResumePdf({ resumeId });
      const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "docx") {
      const result = await orpc.exportResumeDocx({ resumeId });
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
      const result = await orpc.exportResumeMarkdown({ resumeId });
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

function EditSplitButton({
  onEdit,
  onReviseWithAi,
}: {
  onEdit: () => void;
  onReviseWithAi: () => void;
}) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const anchorRef = useState<HTMLDivElement | null>(null);

  return (
    <>
      <ButtonGroup variant="contained" ref={(el) => {
        anchorRef[1](el);
      }}>
        <Button startIcon={<EditIcon />} onClick={onEdit}>
          {t("resume.detail.editButton")}
        </Button>
        <Button size="small" onClick={() => setOpen((p) => !p)} aria-label={t("resume.detail.editMenuLabel")}>
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Popper open={open} anchorEl={anchorRef[0]} placement="bottom-end" transition disablePortal sx={{ zIndex: 1300 }}>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper>
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <MenuList autoFocusItem>
                  <MenuItem
                    onClick={() => {
                      setOpen(false);
                      onReviseWithAi();
                    }}
                  >
                    {t("revision.reviseButton")}
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}

export function ResumeDetailActions({
  resumeId,
  resumeTitle,
  activeBranchId,
  isEditRoute,
  isSnapshotMode,
  isEditing,
  isRevisionOpen,
  baseCommitId,
  isSaving,
  canSaveAsNewVersion,
  onSaveCurrent,
  onSaveAsNewVersion,
  onEdit,
  onOpenAiHelp,
  onReviseWithAi,
  onCloseRevision,
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
          setHistoryOpen(true);
        }}
      >
        <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
        {t("resume.history.pageTitle")}
      </MenuItem>
      <MenuItem
        onClick={() => {
          setMoreActionsAnchorEl(null);
          openComparePage();
        }}
      >
        <ViewAgendaIcon fontSize="small" sx={{ mr: 1 }} />
        {t("revision.inline.compareButton")}
      </MenuItem>
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
      {isRevisionOpen ? (
        <>
          <ResumeSaveSplitButton
            onSaveCurrent={onSaveCurrent}
            onSaveAsNewVersion={onSaveAsNewVersion}
            canSaveAsNewVersion={canSaveAsNewVersion && baseCommitId !== null}
            isPending={isSaving}
          />
          <Button variant="outlined" onClick={onCloseRevision}>
            {t("revision.inline.closeButton")}
          </Button>
          <IconButton
            aria-label={t("resume.detail.moreActionsLabel")}
            onClick={(event) => setMoreActionsAnchorEl(event.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
        </>
      ) : (
        <>
          {isEditing ? (
            <>
              <ResumeSaveSplitButton
                onSaveCurrent={onSaveCurrent}
                onSaveAsNewVersion={onSaveAsNewVersion}
                canSaveAsNewVersion={canSaveAsNewVersion && baseCommitId !== null}
                isPending={isSaving}
              />
              <Button variant="outlined" onClick={onOpenAiHelp}>
                {t("revision.inline.aiHelpButton")}
              </Button>
              <Button variant="outlined" onClick={onCloseRevision}>
                {t("resume.edit.backButton")}
              </Button>
            </>
          ) : (
            <>
              <ExportSplitButton resumeId={resumeId} />
              <EditSplitButton onEdit={onEdit} onReviseWithAi={onReviseWithAi} />
            </>
          )}
          <IconButton
            aria-label={t("resume.detail.moreActionsLabel")}
            onClick={(event) => setMoreActionsAnchorEl(event.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
        </>
      )}

      {sharedMoreMenu}

      <ResumeHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        resumeId={resumeId}
      activeBranchId={activeBranchId}
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
