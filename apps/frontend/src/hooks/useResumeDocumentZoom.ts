import { useEffect, useState } from "react";

const STORAGE_KEY = "resume-document-zoom";
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function useResumeDocumentZoom() {
  const [zoom, setZoomState] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_ZOOM;
    }

    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    const parsedValue = rawValue ? Number(rawValue) : DEFAULT_ZOOM;

    return Number.isFinite(parsedValue) ? clampZoom(parsedValue) : DEFAULT_ZOOM;
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(zoom));
  }, [zoom]);

  function setZoom(value: number) {
    setZoomState(clampZoom(value));
  }

  return {
    zoom,
    setZoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    defaultZoom: DEFAULT_ZOOM,
  };
}
