/**
 * DiffPanel — right column.
 * - Discovery step: shows structured goals summary.
 * - Content steps: shows original vs proposed side-by-side.
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import type {
  ResumeRevisionWorkflowStep,
  ResumeRevisionProposalContent,
  ResumeRevisionDiscoveryOutput,
} from "@cv-tool/contracts";

interface DiffPanelProps {
  step: ResumeRevisionWorkflowStep | null;
  discoveryOutput: ResumeRevisionDiscoveryOutput | null;
}

function ContentBlock({ label, value }: { label: string; value: unknown }) {
  const display =
    value === null || value === undefined
      ? "—"
      : Array.isArray(value)
        ? (value as string[]).join(", ")
        : typeof value === "object"
          ? JSON.stringify(value, null, 2)
          : String(value);

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        component="pre"
        sx={{
          mt: 0.5,
          fontFamily: "inherit",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          bgcolor: "action.hover",
          borderRadius: 1,
          p: 1,
          m: 0,
          fontSize: "0.8rem",
        }}
      >
        {display}
      </Typography>
    </Box>
  );
}

function DiscoveryPanel({ discovery }: { discovery: ResumeRevisionDiscoveryOutput | null }) {
  const { t } = useTranslation("common");

  if (!discovery) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic", mt: 2 }}>
        {t("revision.diffPanel.pendingDiscovery")}
      </Typography>
    );
  }

  const strengthsToEmphasise = Array.isArray(discovery.strengthsToEmphasise)
    ? discovery.strengthsToEmphasise
    : [];
  const thingsToDownplay = Array.isArray(discovery.thingsToDownplay)
    ? discovery.thingsToDownplay
    : [];

  return (
    <Box>
      <ContentBlock label={t("revision.diffPanel.summary")} value={discovery.conversationSummary} />
      <ContentBlock label={t("revision.diffPanel.targetRole")} value={discovery.targetRole} />
      <ContentBlock label={t("revision.diffPanel.tone")} value={discovery.tone} />
      <ContentBlock label={t("revision.diffPanel.language")} value={discovery.languagePreferences} />
      <ContentBlock label={t("revision.diffPanel.emphasize")} value={strengthsToEmphasise} />
      <ContentBlock
        label={t("revision.diffPanel.downplay")}
        value={[...thingsToDownplay, discovery.additionalNotes].filter(Boolean).join("; ")}
      />
    </Box>
  );
}

function SideBySideDiff({ proposal }: { proposal: ResumeRevisionProposalContent }) {
  const { t } = useTranslation("common");

  const formatContent = (val: unknown) =>
    val === null || val === undefined
      ? "—"
      : typeof val === "object"
        ? JSON.stringify(val, null, 2)
        : String(val);

  return (
    <Box sx={{ display: "flex", gap: 1, flex: 1, minHeight: 0 }}>
      {/* Original */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
          {t("revision.diffPanel.original")}
        </Typography>
        <Paper
          variant="outlined"
          sx={{
            mt: 0.5,
            p: 1.5,
            bgcolor: "error.50",
            borderColor: "error.200",
            overflow: "auto",
            maxHeight: 400,
          }}
        >
          <Typography
            variant="body2"
            component="pre"
            sx={{ fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word", m: 0, fontSize: "0.78rem" }}
          >
            {formatContent(proposal.originalContent)}
          </Typography>
        </Paper>
      </Box>

      {/* Proposed */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
          {t("revision.diffPanel.proposed")}
        </Typography>
        <Paper
          variant="outlined"
          sx={{
            mt: 0.5,
            p: 1.5,
            bgcolor: "success.50",
            borderColor: "success.200",
            overflow: "auto",
            maxHeight: 400,
          }}
        >
          <Typography
            variant="body2"
            component="pre"
            sx={{ fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word", m: 0, fontSize: "0.78rem" }}
          >
            {formatContent(proposal.proposedContent)}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}

export function DiffPanel({ step, discoveryOutput }: DiffPanelProps) {
  const { t } = useTranslation("common");

  const isDiscovery = step?.section === "discovery";
  const latestProposal = step?.messages
    .slice()
    .reverse()
    .find((m) => m.messageType === "proposal")
    ?.structuredContent as ResumeRevisionProposalContent | null | undefined;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {isDiscovery ? t("revision.diffPanel.discoveryTitle") : t("revision.diffPanel.proposed")}
      </Typography>
      <Divider />

      {isDiscovery ? (
        <DiscoveryPanel discovery={discoveryOutput} />
      ) : latestProposal ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <SideBySideDiff proposal={latestProposal} />

          {latestProposal.changeSummary && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
                {t("revision.conversation.changeSummary")}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: "text.primary" }}>
                {latestProposal.changeSummary}
              </Typography>
            </Box>
          )}

          {latestProposal.reasoning && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
                {t("revision.conversation.reasoning")}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary", fontStyle: "italic" }}>
                {latestProposal.reasoning}
              </Typography>
            </Box>
          )}
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
          {t("revision.diffPanel.noProposal")}
        </Typography>
      )}
    </Box>
  );
}
