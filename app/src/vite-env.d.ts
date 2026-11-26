/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OBJECTIV_API_URL?: string;
  /** @deprecated Use VITE_OBJECTIV_API_URL */
  readonly VITE_AZIAI_API_URL?: string;
  readonly VITE_OBJECTIVE_SIDECAR_URL?: string;
  readonly VITE_OBJECTIVE_PILOT_USER?: string;
  readonly VITE_OBJECTIVE_EXTENSION_PATH?: string;
  /** Central bili ingest (unified-agent /v1/bili/events) when tracking is enabled. */
  readonly VITE_OBJECTIV_BILI_INGEST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
