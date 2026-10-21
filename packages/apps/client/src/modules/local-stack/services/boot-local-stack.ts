import { runtimeUrl, serviceWorkerUrl } from 'virtual:volt-web-runtime';
import { startBrowserStack } from '@volt/web-runtime/host/browser-stack';
import { startServiceWorkerRelay } from '@volt/web-runtime/host/service-worker-relay';
import type { LocalStackPhaseId } from '@volt/local-stack/provision';

export type LocalStackPhaseStatus = 'running' | 'done' | 'error';

export interface LocalStackBootObserver {
    onPhase: (id: LocalStackPhaseId, status: LocalStackPhaseStatus) => void;
    onLog: (stream: 'stdout' | 'stderr', line: string) => void;
}

// One tab runs the stack: its workers hold the origin's files open.
const LOCK_NAME = 'volt-local-stack';
const RELOAD_KEY = 'volt:local-stack:isolating';

const holdTabLock = (): Promise<boolean> => new Promise((resolve) => {
    void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        resolve(lock !== null);
        // Held for as long as this page lives.
        return lock ? new Promise<never>(() => {}) : undefined;
    });
});

// The page is served by the relay, cross-origin isolated, only once it loads through it: the first
// start reloads it once.
const ensureServedByRelay = async (): Promise<boolean> => {
    if (await startServiceWorkerRelay(serviceWorkerUrl)) {
        sessionStorage.removeItem(RELOAD_KEY);
        return true;
    }
    if (sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.removeItem(RELOAD_KEY);
        throw new Error('This browser cannot isolate the page, which the local backend needs (SharedArrayBuffer).');
    }
    sessionStorage.setItem(RELOAD_KEY, '1');
    window.location.reload();
    return false;
};

// Resolves once the local stack serves this page's backend requests; false while the page reloads.
export const bootLocalStack = async (observer: LocalStackBootObserver): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !navigator.locks || !navigator.storage?.getDirectory) {
        throw new Error('This browser lacks what the local backend needs (service workers, Web Locks and the origin private file system).');
    }
    if (!await ensureServedByRelay()) {
        return false;
    }
    if (!await holdTabLock()) {
        throw new Error('VOLT is already running in another tab of this browser. Close it, or use that tab.');
    }

    await startBrowserStack({
        runtimeUrl,
        clientOrigin: window.location.origin,
        log: observer.onLog,
        phase: async (id, run) => {
            observer.onPhase(id, 'running');
            try {
                const result = await run();
                observer.onPhase(id, 'done');
                return result;
            } catch (error) {
                observer.onPhase(id, 'error');
                throw error;
            }
        }
    });
    return true;
};
