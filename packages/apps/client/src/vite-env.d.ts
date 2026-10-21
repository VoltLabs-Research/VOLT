/// <reference types="vite/client" />
/// <reference types="@volt/web-runtime/virtual" />
import '@react-three/fiber';

interface ImportMetaEnv {
    readonly VITE_SERVER_ENDPOINT?: string;
    readonly VITE_PROXY_API_URL?: string;
    // The plugin registry the backend in this browser installs from, when not the public one.
    readonly VITE_REGISTRY_URL?: string;
};

interface ImportMeta {
    readonly env: ImportMetaEnv;
};

declare global {
    interface Window {
        __VOLT_SERVER_ENDPOINT__?: string;
    }
}
