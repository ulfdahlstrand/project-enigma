import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useAIAssistantContext } from "../../lib/ai-assistant-context";
import { useAIConversations } from "../../hooks/ai-assistant";

interface Props {
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationHistoryList({ onSelectConversation }: Props) {
  const { t } = useTranslation("common");
  const { entityType, entityId, activeConversationId, conversationTitle } = useAIAssistantContext();

  const { data, isLoading, isError } = useAIConversations(entityType, entityId);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {t("aiAssistant.errorLoading")}
      </Alert>
    );
  }

  const conversations = data?.conversations ?? [];

  if (conversations.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", pt: 4, px: 2 }}>
        {t("aiAssistant.conversationListEmpty")}
      </Typography>
    );
  }

  return (
    <List disablePadding>
      {conversations.map((conv) => {
        const dateStr = new Date(conv.updatedAt).toLocaleDateString();
        const placeholderTitle =
          conv.id === activeConversationId && conversationTitle
            ? conversationTitle
            : t("aiAssistant.conversationStarted", { date: dateStr });
        const label = conv.title ?? placeholderTitle;

        return (
          <ListItemButton
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            divider
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Tooltip
                title={conv.isClosed ? t("aiAssistant.statusClosed") : t("aiAssistant.statusActive")}
                placement="left"
              >
                {conv.isClosed ? (
                  <CheckCircleOutlineIcon fontSize="small" sx={{ color: "text.disabled" }} />
                ) : (
                  <FiberManualRecordIcon fontSize="small" sx={{ color: "success.main" }} />
                )}
              </Tooltip>
            </ListItemIcon>
            <ListItemText
              primary={label}
              secondary={dateStr}
              primaryTypographyProps={{ variant: "body2", noWrap: true }}
              secondaryTypographyProps={{ variant: "caption" }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
