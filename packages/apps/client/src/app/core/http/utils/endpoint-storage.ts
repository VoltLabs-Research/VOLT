import { readStoredString, removeStoredValue, writeStoredString } from '@/shared/utils/local-storage';
const ENDPOINT_KEY = 'volt:backend:endpoint';

export const endpointStorage = {
    getEndpoint: (): string | null => readStoredString(ENDPOINT_KEY),
    setEndpoint: (origin: string): void => writeStoredString(ENDPOINT_KEY, origin),
    clearEndpoint: (): void => removeStoredValue(ENDPOINT_KEY)
};
