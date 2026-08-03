/// <reference types="vite/client" />
import '@react-three/fiber';

interface ImportMetaEnv {
    readonly VITE_SERVER_ENDPOINT?: string;
    readonly VITE_PROXY_API_URL?: string;
};

interface ImportMeta {
    readonly env: ImportMetaEnv;
};

/*
 * `declare global` is required: the top-level `import` above makes this file a
 * module, so a bare `interface Window` would be local to it instead of augmenting
 * the global one.
 */
declare global {
    interface Window {
        /**
         * Backend origin injected by the host serving this bundle, read at runtime by
         * `backend-origin.ts`. The single-machine stack image sets it to
         * `window.location.origin`; cloud builds leave it undefined and pin the
         * endpoint at build time with `VITE_SERVER_ENDPOINT`.
         */
        __VOLT_SERVER_ENDPOINT__?: string;
    }
}
