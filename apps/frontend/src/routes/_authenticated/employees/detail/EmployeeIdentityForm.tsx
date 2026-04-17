/**
 * EmployeeIdentityForm — avatar + profile-image upload + name/email form.
 * The parent route owns the form element via `id="employee-identity-form"`
 * so a PageHeader save button can submit it via `form="employee-identity-form"`.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import type { UseFormHandleSubmit, UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { ConsultantAvatar } from "../../../../components/ConsultantAvatar";

export interface EmployeeIdentityFormValues {
  name: string;
  email: string;
}

interface EmployeeIdentityFormProps {
  employeeName: string;
  profileImageDataUrl: string | null;
  register: UseFormRegister<EmployeeIdentityFormValues>;
  handleSubmit: UseFormHandleSubmit<EmployeeIdentityFormValues>;
  onSubmit: (values: EmployeeIdentityFormValues) => void;
  onProfileImageSelected: (file: File | null) => void;
  onProfileImageRemoved: () => void;
}

export function EmployeeIdentityForm({
  employeeName,
  profileImageDataUrl,
  register,
  handleSubmit,
  onSubmit,
  onProfileImageSelected,
  onProfileImageRemoved,
}: EmployeeIdentityFormProps) {
  const { t } = useTranslation("common");

  return (
    <Box sx={{ flexShrink: 0, minWidth: 320, flex: "0 1 480px" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
        <ConsultantAvatar
          name={employeeName}
          profileImageDataUrl={profileImageDataUrl}
          size={72}
          fontSize={24}
        />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Button variant="outlined" component="label">
            {t("employee.detail.uploadProfileImageButton")}
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => {
                onProfileImageSelected(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </Button>
          <Button
            variant="text"
            color="inherit"
            disabled={!profileImageDataUrl}
            onClick={onProfileImageRemoved}
          >
            {t("employee.detail.removeProfileImageButton")}
          </Button>
        </Box>
      </Box>
      <Box
        id="employee-identity-form"
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label={t("employee.detail.nameLabel")}
          {...register("name")}
          required
          fullWidth
        />
        <TextField
          label={t("employee.detail.emailLabel")}
          type="email"
          {...register("email")}
          required
          fullWidth
        />
      </Box>
    </Box>
  );
}
