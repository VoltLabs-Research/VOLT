// The module scripts/vite-plugin.mjs provides to the client it serves.
declare module 'virtual:volt-web-runtime' {
    // Where the runtime's workers are served.
    export const runtimeUrl: URL;
    // The service worker that relays the client's backend requests to its local stack.
    export const serviceWorkerUrl: URL;
}
