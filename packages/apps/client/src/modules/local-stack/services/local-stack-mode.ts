import { readStoredString, removeStoredValue, writeStoredString } from '@/shared/utils/local-storage';
import { serviceWorkerUrl } from 'virtual:volt-web-runtime';
import { stopServiceWorkerRelay } from '@volt/web-runtime/host/service-worker-relay';

// Whether this browser runs its own VOLT: the server and a cluster daemon in workers of the page,
// which is then its own backend.
const LOCAL_STACK_KEY = 'volt:backend:local-stack';

export const localStackMode = {
    isEnabled: (): boolean => readStoredString(LOCAL_STACK_KEY) === 'enabled',
    enable: (): void => writeStoredString(LOCAL_STACK_KEY, 'enabled'),
    disable: async (): Promise<void> => {
        removeStoredValue(LOCAL_STACK_KEY);
        await stopServiceWorkerRelay(serviceWorkerUrl);
    }
};
