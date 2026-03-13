/**
 * Test route — accessible at "/test".
 *
 * Fetches all rows from the backend `listTestEntries` oRPC procedure (which in
 * turn queries the `test_entries` PostgreSQL table) and renders them in a table.
 *
 * This route exists solely to validate full end-to-end stack connectivity:
 *   database → oRPC backend endpoint (OpenAPIHandler) → TanStack Query → React
 *
 * It contains no CV-specific business logic. All user-facing strings are
 * sourced from the i18n system via the `useTranslation` hook.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { orpc } from "../../orpc-client";

export const Route = createFileRoute("/test/")({
  component: TestPage,
});

function TestPage() {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["listTestEntries"],
    queryFn: () => orpc.listTestEntries({}),
  });

  return (
    <main>
      <h1>{t("test.heading")}</h1>
      <p>{t("test.description")}</p>

      {isLoading && (
        <p data-testid="loading-indicator">{t("test.loading")}</p>
      )}

      {isError && (
        <p data-testid="error-message">{t("test.error")}</p>
      )}

      {data !== undefined && (
        <>
          {data.entries.length === 0 ? (
            <p data-testid="empty-message">{t("test.empty")}</p>
          ) : (
            <table data-testid="entries-table">
              <thead>
                <tr>
                  <th>{t("test.tableHeaderId")}</th>
                  <th>{t("test.tableHeaderName")}</th>
                  <th>{t("test.tableHeaderNote")}</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr key={entry.id} data-testid={`entry-row-${entry.id}`}>
                    <td>{entry.id}</td>
                    <td>{entry.name}</td>
                    <td>{entry.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}
