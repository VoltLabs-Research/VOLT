/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_VOLT_APP_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
