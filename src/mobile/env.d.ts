/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_PORT: string;
  readonly VITE_API_URL_PREFIX: string;
  readonly VITE_MAIN_BUNDLE_ID: string;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
