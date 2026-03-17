/// <reference types="vite/client" />

/**
 * Augments the Vite ImportMeta interface with the env variables used by this app.
 * Add new VITE_ variables here as the project grows.
 */
interface ImportMetaEnv {
  /** Base URL of the backend oRPC API. Read by orpc-client.ts. */
  readonly VITE_API_URL?: string;
  /** Port the Vite dev server listens on. Configured in vite.config.ts. */
  readonly VITE_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
