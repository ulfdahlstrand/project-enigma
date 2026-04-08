const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

function sanitizePart(value: string): string {
  return value.replace(INVALID_FILENAME_CHARS, "-").trim();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatExportTimestamp(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

export function buildExportFilename({
  exportedAt = new Date(),
  consultantName,
  company = "SthlmTech",
  language,
  branchName,
  extension,
}: {
  exportedAt?: Date;
  consultantName: string;
  company?: string;
  language: string;
  branchName: string;
  extension: "pdf" | "docx" | "md";
}): string {
  const timestamp = formatExportTimestamp(exportedAt);
  const normalizedLanguage = sanitizePart(language.toUpperCase());
  const normalizedConsultantName = sanitizePart(consultantName);
  const normalizedCompany = sanitizePart(company);
  const normalizedBranchName = sanitizePart(branchName);

  return `${timestamp} - ${normalizedConsultantName}, ${normalizedCompany} - ${normalizedLanguage} - ${normalizedBranchName}.${extension}`;
}
