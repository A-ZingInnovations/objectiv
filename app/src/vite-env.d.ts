/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OBJECTIV_API_URL?: string;
  /** @deprecated Use VITE_OBJECTIV_API_URL */
  readonly VITE_OBJECTIVE_SIDECAR_URL?: string;
  readonly VITE_OBJECTIVE_PILOT_USER?: string;
  readonly VITE_OBJECTIVE_EXTENSION_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
