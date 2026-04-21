/// <reference types="vite/client" />
import '@react-three/fiber';

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_PROXY_API_URL?: string;
};

interface ImportMeta {
    readonly env: ImportMetaEnv;
};
