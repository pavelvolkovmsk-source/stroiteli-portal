/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес Hub (центральный API экосистемы «Строители»). */
  readonly VITE_HUB_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
