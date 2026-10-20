import FetchHttpClient from '../core/FetchHttpClient';
import AxiosHttpClient from '../core/AxiosHttpClient';
import VoltClient from '../core/VoltClient';
import type { CredentialProvider } from '../auth/CredentialProvider';
import type { VoltClientOptions } from '../core/VoltClient';

export interface VoltClientFactoryOptions {
    credential?: CredentialProvider;
    adapter?: 'fetch' | 'axios';
    timeout?: number;
    teamId?: string;
};

export const createVoltClient = (
    baseUrl: string,
    options: VoltClientFactoryOptions = {}
): VoltClient => {
    const { credential, adapter = 'fetch', timeout, teamId } = options;

    const httpOpts = { baseUrl, credential, timeout };

    const http =
        adapter === 'axios'
            ? new AxiosHttpClient(httpOpts)
            : new FetchHttpClient(httpOpts);

    const clientOpts: VoltClientOptions = teamId
        ? { useRBAC: true, getTeamId: () => teamId }
        : {};

    return new VoltClient(http, '', clientOpts);
};
