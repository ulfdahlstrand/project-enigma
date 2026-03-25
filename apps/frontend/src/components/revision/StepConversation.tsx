/**
 * StepConversation — center column.
 * Shows the message thread, composer, and approve/rework action buttons.
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import SendIcon from "@mui/icons-material/Send";
import type { ResumeRevisionWorkflowStep } from "@cv-tool/contracts";

interface StepConversationProps {
  step: ResumeRevisionWorkflowStep;
  onSend: (content: string) => void;
  onApprove: () => void;
  onRequestRework: (feedback: string) => void;
  onSkip: () => void;
  isSending: boolean;
  isApproving: boolean;
  isRequestingRework: boolean;
  isSkipping: boolean;
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 1.5,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: "80%",
          px: 2,
          py: 1.5,
          borderRadius: 2,
          bgcolor: isUser ? "primary.main" : "action.hover",
          color: isUser ? "primary.contrastText" : "text.primary",
          border: isUser ? "none" : "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography
          variant="body2"
          component="pre"
          sx={{ fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word", m: 0 }}
        >
          {content}
        </Typography>
      </Paper>
    </Box>
  );
}

export function StepConversation({
  step,
  onSend,
  onApprove,
  onRequestRework,
  onSkip,
  isSending,
  isApproving,
  isRequestingRework,
  isSkipping,
}: StepConversationProps) {
  const { t } = useTranslation("common");
  const [message, setMessage] = useState("");
  const [reworkFeedback, setReworkFeedback] = useState("");
  const [showReworkInput, setShowReworkInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isReadOnly = step.status === "approved";
  const hasProposal = step.messages.some((m) => m.messageType === "proposal");
  const isReviewing = step.status === "reviewing" && hasProposal;
  const isPending = step.status === "pending" || step.status === "needs_rework";
  const isBusy = isSending || isApproving || isRequestingRework || isSkipping;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step.messages]);

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || isBusy) return;
    onSend(trimmed);
    setMessage("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleRequestRework() {
    if (!showReworkInput) {
      setShowReworkInput(true);
      return;
    }
    onRequestRework(reworkFeedback);
    setReworkFeedback("");
    setShowReworkInput(false);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Message thread */}
      <Box sx={{ flex: 1, overflow: "auto", px: 1, py: 1 }}>
        {step.messages.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic", textAlign: "center", mt: 4 }}>
            {isPending ? t("revision.conversation.pendingInfo") : t("revision.conversation.noMessages")}
          </Typography>
        ) : (
          step.messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))
        )}

        {isSending && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t("revision.conversation.sending")}
            </Typography>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Divider />

      {/* Read-only notice */}
      {isReadOnly && (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>
            {t("revision.conversation.readOnly")}
          </Typography>
        </Box>
      )}

      {/* Action area */}
      {!isReadOnly && (
        <Box sx={{ px: 2, py: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* Skip button — always visible when not read-only */}
          <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
            <Button
              variant="outlined"
              size="small"
              color="inherit"
              onClick={onSkip}
              disabled={isBusy}
              sx={{ color: "text.secondary", borderColor: "divider", fontSize: "0.75rem" }}
            >
              {t("revision.conversation.skipButton")}
            </Button>
          </Box>

          {/* Rework feedback input */}
          {showReworkInput && (
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder={t("revision.conversation.requestReworkPlaceholder")}
              value={reworkFeedback}
              onChange={(e) => setReworkFeedback(e.target.value)}
            />
          )}

          {/* Message composer */}
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              multiline
              maxRows={4}
              placeholder={t("revision.conversation.inputPlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              sx={{ "& .MuiInputBase-root": { borderRadius: 2 } }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleSend}
              disabled={!message.trim() || isBusy}
              sx={{ minWidth: 42, px: 1.5, borderRadius: 2 }}
            >
              <SendIcon fontSize="small" />
            </Button>
          </Box>

          {/* Approve / Request rework buttons (only in reviewing state) */}
          {isReviewing && (
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                size="small"
                color="warning"
                onClick={handleRequestRework}
                disabled={isBusy}
              >
                {isRequestingRework
                  ? t("revision.conversation.requestingRework")
                  : showReworkInput
                    ? t("revision.conversation.requestReworkButton")
                    : t("revision.conversation.requestReworkButton")}
              </Button>
              <Button
                variant="contained"
                size="small"
                color="success"
                onClick={onApprove}
                disabled={isBusy}
              >
                {isApproving
                  ? t("revision.conversation.approving")
                  : step.section === "discovery"
                    ? t("revision.conversation.confirmButton")
                    : t("revision.conversation.approveButton")}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
