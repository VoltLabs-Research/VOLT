const ENDPOINT_KEY = 'volt:backend:endpoint';

export const endpointStorage = {
    getEndpoint: (): string | null => localStorage.getItem(ENDPOINT_KEY),
    setEndpoint: (origin: string): void => localStorage.setItem(ENDPOINT_KEY, origin),
    clearEndpoint: (): void => localStorage.removeItem(ENDPOINT_KEY)
};
