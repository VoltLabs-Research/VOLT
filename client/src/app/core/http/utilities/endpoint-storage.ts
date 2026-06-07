const ENDPOINT_KEY = 'volt:backend:endpoint';

class EndpointStorage {
    getEndpoint(): string | null {
        return localStorage.getItem(ENDPOINT_KEY);
    }

    setEndpoint(origin: string): void {
        localStorage.setItem(ENDPOINT_KEY, origin);
    }

    clearEndpoint(): void {
        localStorage.removeItem(ENDPOINT_KEY);
    }
};

export const endpointStorage = new EndpointStorage();
