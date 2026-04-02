import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { AIMessage } from "@cv-tool/contracts";
import {
  extractToolCalls,
  extractSuggestion,
  stripToolBlocks,
  type SuggestionPayload,
} from "./ai-message-parsing";

// ---------------------------------------------------------------------------
// SuggestionCard
// ---------------------------------------------------------------------------

function SuggestionCard({ content }: { content: string }) {
  const { t } = useTranslation("common");
  return (
    <Box
      sx={{
        mt: 1,
        p: 1.5,
        borderRadius: 1,
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "divider",
        fontSize: "0.8rem",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontStyle: "italic",
        color: "text.secondary",
      }}
    >
      <Typography
        variant="caption"
        sx={{ display: "block", fontWeight: 600, mb: 0.5, fontStyle: "normal", color: "text.primary" }}
      >
        {t("aiAssistant.suggestion")}
      </Typography>
      {content}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ToolStatusMessage
// ---------------------------------------------------------------------------

function ToolStatusMessage({ toolName }: { toolName: string }) {
  const { t } = useTranslation("common");
  return (
    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
      {t(`aiAssistant.toolStatus.${toolName}`)}
    </Typography>
  );
}

// ---------------------------------------------------------------------------
// AssistantMessageContent
// ---------------------------------------------------------------------------

const REDUNDANT_TOOL_KEYS = [
  "inspect_resume",
  "inspect_revision_plan",
  "list_resume_assignments",
  "inspect_assignment",
  "inspect_resume_section",
  "inspect_resume_sections",
  "inspect_resume_skills",
  "set_revision_work_items",
  "mark_revision_work_item_no_changes_needed",
  "set_assignment_suggestions",
  "set_revision_plan",
  "set_revision_suggestions",
];

function normalizeStatusText(text: string): string {
  return text.trim().toLowerCase().replace(/[.!…]+$/g, "");
}

export function AssistantMessageContent({ content }: { content: string }) {
  const { t } = useTranslation("common");
  const visibleContent = stripToolBlocks(content);

  if (!visibleContent) {
    const toolCalls = extractToolCalls(content);
    if (toolCalls.length > 0) {
      return <ToolStatusMessage toolName={toolCalls[0]!.toolName} />;
    }
    return null;
  }

  const redundantToolStatuses = REDUNDANT_TOOL_KEYS.map((key) =>
    t(`aiAssistant.toolStatus.${key}`),
  );

  if (redundantToolStatuses.some((status) => normalizeStatusText(status) === normalizeStatusText(visibleContent))) {
    return null;
  }

  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <Typography variant="body2" sx={{ mb: 1, "&:last-child": { mb: 0 } }}>
            {children}
          </Typography>
        ),
        code: ({ className, children }) => {
          const isJsonBlock = className === "language-json";
          if (isJsonBlock) {
            try {
              const parsed = JSON.parse(String(children).trim()) as unknown;
              if (
                typeof parsed === "object" &&
                parsed !== null &&
                (parsed as SuggestionPayload).type === "suggestion" &&
                typeof (parsed as SuggestionPayload).content === "string"
              ) {
                return <SuggestionCard content={(parsed as SuggestionPayload).content} />;
              }
            } catch {
              // not a suggestion block — fall through to plain code
            }
          }
          return (
            <Box
              component="code"
              sx={{
                px: 0.5,
                borderRadius: 0.5,
                bgcolor: "action.hover",
                fontFamily: "monospace",
                fontSize: "0.8em",
              }}
            >
              {children}
            </Box>
          );
        },
        pre: ({ children }) => <Box component="pre" sx={{ m: 0 }}>{children}</Box>,
      }}
    >
      {visibleContent}
    </ReactMarkdown>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

export function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === "user";
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 1.5,
      }}
    >
      <Box
        sx={{
          maxWidth: "80%",
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: isUser ? "primary.main" : "background.paper",
          color: isUser ? "primary.contrastText" : "text.primary",
          border: isUser ? "none" : "1px solid",
          borderColor: "divider",
          fontSize: "0.875rem",
          wordBreak: "break-word",
        }}
      >
        {isUser ? (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Typography>
        ) : (
          <AssistantMessageContent content={message.content} />
        )}
      </Box>
    </Box>
  );
}

export { extractSuggestion };
