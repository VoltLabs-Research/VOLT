// The page side of the service worker relay (src/service-worker.ts): the worker's loopback
// connections arrive here, at the root of the loopback network, which routes them to the backends.
import { handleChildLoopbackMessage, type LoopbackConnectMessage } from '../platform/loopback';

const SCOPE = '/';

// Registers the worker and accepts its connections. Resolves whether this page is already served by
// it: its document's COOP/COEP headers come from the worker only from the next load on.
export const startServiceWorkerRelay = async (scriptUrl: string | URL): Promise<boolean> => {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent<LoopbackConnectMessage>) => {
        if(event.data?.kind === 'connect' && event.source){
            handleChildLoopbackMessage(event.source as ServiceWorker, event.data, event.ports);
        }
    });
    navigator.serviceWorker.startMessages();
    await navigator.serviceWorker.register(scriptUrl, { scope: SCOPE });
    await navigator.serviceWorker.ready;
    return navigator.serviceWorker.controller !== null && globalThis.crossOriginIsolated;
};

export const stopServiceWorkerRelay = async (scriptUrl: string | URL): Promise<void> => {
    const script = new URL(scriptUrl, location.href).href;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations
        .filter((registration) => (registration.active ?? registration.waiting ?? registration.installing)?.scriptURL === script)
        .map((registration) => registration.unregister()));
};
