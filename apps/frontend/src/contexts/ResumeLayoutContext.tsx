import { createContext, useContext } from "react";

interface ResumeLayoutContextValue {
  openHistory: () => void;
}

const ResumeLayoutContext = createContext<ResumeLayoutContextValue | null>(null);

export function useResumeLayoutContext(): ResumeLayoutContextValue {
  const ctx = useContext(ResumeLayoutContext);
  if (!ctx) throw new Error("useResumeLayoutContext must be used inside ResumeDetailLayout");
  return ctx;
}

export { ResumeLayoutContext };
