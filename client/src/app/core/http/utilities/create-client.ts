import AxiosHttpClient from '../client/AxiosHttpClient';
import TokenStorage from '@/shared/auth/token-storage';
import VoltClient from '@/app/core/http/client/VoltClient';

interface CreateApiClientOptions {
    useRBAC?: boolean;
    getTeamId?: () => string | null;
};

export const http = new AxiosHttpClient({
    baseUrl: import.meta.env.VITE_API_URL + '/api',
    getToken: () => new TokenStorage().getToken(),
});

/**
 * Create a VoltClient scoped to a base path.
 * Usage: const client = createApiClient('/container', { useRBAC: true });
 */
export const createApiClient = (basePath: string, opts?: CreateApiClientOptions): VoltClient => {
    return new VoltClient(http, basePath, opts);
};
