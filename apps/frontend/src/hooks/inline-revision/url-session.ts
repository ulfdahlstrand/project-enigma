/**
 * URL-backed session state for inline revision. The revision session needs
 * to survive reloads, so the active branch name/id are mirrored into search
 * params. These helpers hide the tanstack-router navigate typing noise.
 */
import type { useNavigate } from "@tanstack/react-router";

type NavigateFn = ReturnType<typeof useNavigate>;

interface AssistantSearchParams {
  assistant?: "true";
  sourceBranchId?: string;
  sourceBranchName?: string;
  [key: string]: unknown;
}

export function writeAssistantSessionParams(
  navigate: NavigateFn,
  params: { assistantBranchId: string; assistantBranchName: string | null },
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (navigate as any)({
    search: (prev: Record<string, unknown>) => ({
      ...prev,
      assistant: "true",
      sourceBranchId: params.assistantBranchId,
      sourceBranchName: params.assistantBranchName,
    }),
    replace: true,
  });
}

export function clearAssistantSessionParams(navigate: NavigateFn): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (navigate as any)({
    search: (prev: Record<string, unknown>) => {
      const {
        assistant: _assistant,
        sourceBranchId: _sourceBranchId,
        sourceBranchName: _sourceBranchName,
        ...rest
      } = prev as AssistantSearchParams;
      return rest;
    },
    replace: true,
  });
}
