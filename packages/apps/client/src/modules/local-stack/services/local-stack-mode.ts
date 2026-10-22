import { readStoredString, removeStoredValue, writeStoredString } from '@/shared/utils/local-storage';
import { serviceWorkerUrl } from 'virtual:volt-web-runtime';
import { stopServiceWorkerRelay } from '@volt/web-runtime/host/service-worker-relay';

// Whether this browser runs its own VOLT: the server and a cluster daemon in workers of the page,
// which is then its own backend. The desktop app always does, in its window.
const LOCAL_STACK_KEY = 'volt:backend:local-stack';

// The desktop app's preload exposes window.volt to its page.
const isDesktopApp = (): boolean => 'volt' in window;

export const localStackMode = {
    isEnabled: (): boolean => isDesktopApp() || readStoredString(LOCAL_STACK_KEY) === 'enabled',
    // The desktop app has no other backend to connect to.
    isDesktopApp,
    enable: (): void => writeStoredString(LOCAL_STACK_KEY, 'enabled'),
    disable: async (): Promise<void> => {
        removeStoredValue(LOCAL_STACK_KEY);
        await stopServiceWorkerRelay(serviceWorkerUrl);
    }
};
