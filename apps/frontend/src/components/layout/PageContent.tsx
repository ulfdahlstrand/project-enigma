/**
 * PageContent — consistent content-area wrapper.
 *
 * Provides uniform padding for all authenticated page content areas.
 * Use this as the root wrapper inside every page component instead of
 * a raw <Box sx={{ p: 3 }}>.
 */
import Box from "@mui/material/Box";
import type { ReactNode } from "react";

interface PageContentProps {
  children: ReactNode;
}

export function PageContent({ children }: PageContentProps) {
  return (
    <Box sx={{ p: 3 }}>
      {children}
    </Box>
  );
}
