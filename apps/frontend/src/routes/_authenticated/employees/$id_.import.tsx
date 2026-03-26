import Button from "@mui/material/Button";
/**
 * /employees/:id/import route — import CV JSON for an employee.
 *
 * The user pastes or uploads a CV JSON file. The JSON is validated against
 * cvJsonSchema from @cv-tool/contracts before being sent to the backend.
 * On success, a summary of created/skipped records is displayed in the result panel.
 *
 * Data: no initial query — all state is local until the mutation fires.
 * Mutation: TanStack Query useMutation + oRPC client (importCv).
 * Styling: MUI sx prop only.
 * i18n: all visible text via useTranslation("common").
 */
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { cvJsonSchema } from "@cv-tool/contracts";
import { orpc } from "../../../orpc-client";
import RouterButton from "../../../components/RouterButton";
import { getEducationQueryKey } from "./$id";
import { LIST_RESUMES_QUERY_KEY } from "../resumes";


export const Route = createFileRoute("/_authenticated/employees/$id_/import")({
  component: ImportCvPage,
});

function ImportCvPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ strict: false }) as { id: string };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [jsonText, setJsonText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [language, setLanguage] = useState<"sv" | "en">("sv");
  const [docxError, setDocxError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (cvJson: unknown) => {
      const parsed = cvJsonSchema.parse(cvJson);
      return orpc.importCv({ employeeId: id, language, cvJson: parsed });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getEducationQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: [...LIST_RESUMES_QUERY_KEY, id] }),
      ]);
    },
  });

  const docxMutation = useMutation({
    mutationFn: (docxBase64: string) =>
      orpc.parseCvDocx({ docxBase64, language }),
    onSuccess: (data) => {
      setJsonText(JSON.stringify(data.cvJson, null, 2));
      setDocxError(null);
      setParseError(null);
      mutation.reset();
    },
    onError: () => {
      setDocxError(t("employee.import.docxError"));
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonText((event.target?.result as string) ?? "");
      setParseError(null);
      mutation.reset();
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDocxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64 = btoa(binary);
      docxMutation.mutate(base64);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImport = () => {
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setParseError(t("employee.import.parseError"));
      return;
    }
    mutation.mutate(parsed);
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h4" component="h1">
          {t("employee.import.pageTitle")}
        </Typography>
        <RouterButton
          variant="outlined"
          to="/employees/$id"
          params={{ id }}
          aria-label={t("employee.import.backButton")}
        >
          {t("employee.import.backButton")}
        </RouterButton>
      </Box>

      {/* Two-column body */}
      <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* Left column — input flow */}
        <Box sx={{ flex: 1, minWidth: 320 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("employee.import.pageDescription")}
          </Typography>

          <FormControl sx={{ mb: 2 }}>
            <FormLabel sx={{ mb: 0.5 }}>{t("employee.import.languageLabel")}</FormLabel>
            <ToggleButtonGroup
              value={language}
              exclusive
              onChange={(_e, val) => { if (val) setLanguage(val as "sv" | "en"); }}
              size="small"
              aria-label={t("employee.import.languageLabel")}
            >
              <ToggleButton value="sv">{t("employee.import.languageSv")}</ToggleButton>
              <ToggleButton value="en">{t("employee.import.languageEn")}</ToggleButton>
            </ToggleButtonGroup>
          </FormControl>

          {parseError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {parseError}
            </Alert>
          )}

          {docxError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDocxError(null)}>
              {docxError}
            </Alert>
          )}

          {mutation.isError && !parseError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {t("employee.import.importError")}
            </Alert>
          )}

          <TextField
            label={t("employee.import.jsonLabel")}
            placeholder={t("employee.import.jsonPlaceholder")}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setParseError(null);
              mutation.reset();
            }}
            multiline
            minRows={12}
            fullWidth
            sx={{ mb: 2, fontFamily: "monospace" }}
            slotProps={{ htmlInput: { style: { fontFamily: "monospace", fontSize: 13 } } }}
          />

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              disabled={!jsonText.trim() || mutation.isPending}
              onClick={handleImport}
              aria-label={t("employee.import.importButton")}
            >
              {mutation.isPending
                ? t("employee.import.importing")
                : t("employee.import.importButton")}
            </Button>
            <Button
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t("employee.import.uploadButton")}
            >
              {t("employee.import.uploadButton")}
            </Button>
            <Button
              variant="outlined"
              onClick={() => docxInputRef.current?.click()}
              disabled={docxMutation.isPending}
              aria-label={t("employee.import.uploadDocxButton")}
            >
              {docxMutation.isPending
                ? t("employee.import.parsingDocx")
                : t("employee.import.uploadDocxButton")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <input
              ref={docxInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: "none" }}
              onChange={handleDocxUpload}
            />
          </Box>
        </Box>

        {/* Right column — result panel */}
        <Box sx={{ width: 340, flexShrink: 0 }}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
              {t("employee.import.resultHeading")}
            </Typography>

            {mutation.isSuccess ? (
              <Box>
                {mutation.data.resumeCreated && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {t("employee.import.resumeCreated")}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {t("employee.import.assignmentsCreated", { count: mutation.data.assignmentsCreated })}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {t("employee.import.assignmentsSkipped", { count: mutation.data.assignmentsSkipped })}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {t("employee.import.educationCreated", { count: mutation.data.educationCreated })}
                </Typography>
                <Typography variant="body2">
                  {t("employee.import.educationSkipped", { count: mutation.data.educationSkipped })}
                </Typography>
              </Box>
            ) : mutation.isPending ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "text.secondary" }}>
                <CircularProgress size={18} />
                <Typography variant="body2">{t("employee.import.importing")}</Typography>
              </Box>
            ) : docxMutation.isPending ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "text.secondary" }}>
                <CircularProgress size={18} />
                <Typography variant="body2">{t("employee.import.parsingDocx")}</Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t("employee.import.resultPanelIdle")}
              </Typography>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
