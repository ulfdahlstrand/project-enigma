import type { AuthUser } from "../auth/require-auth.js";

export const MOCK_ADMIN: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  azure_oid: "azure-oid-admin",
  email: "admin@example.com",
  name: "Admin User",
  role: "admin",
  created_at: new Date("2025-01-01T00:00:00.000Z"),
};

export const MOCK_CONSULTANT: AuthUser = {
  id: "00000000-0000-0000-0000-000000000002",
  azure_oid: "azure-oid-consultant",
  email: "consultant@example.com",
  name: "Consultant User",
  role: "consultant",
  created_at: new Date("2025-01-01T00:00:00.000Z"),
};

export const MOCK_CONSULTANT_2: AuthUser = {
  id: "00000000-0000-0000-0000-000000000003",
  azure_oid: "azure-oid-consultant-2",
  email: "other@example.com",
  name: "Other Consultant",
  role: "consultant",
  created_at: new Date("2025-01-01T00:00:00.000Z"),
};
