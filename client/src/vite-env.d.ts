/// <reference types="vite/client" />
import '@react-three/fiber';

interface ImportMetaEnv {
    readonly VITE_SERVER_ENDPOINT?: string;
    readonly VITE_PROXY_API_URL?: string;
};

interface ImportMeta {
    readonly env: ImportMetaEnv;
};
