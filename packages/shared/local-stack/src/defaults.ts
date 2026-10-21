import { LOCAL_ACCOUNT_EMAIL } from '@volt/contracts/modules/auth/local-account';

export const LOCAL_DEFAULTS = {
    fullName: 'Local',
    email: LOCAL_ACCOUNT_EMAIL,
    password: 'volt-local-desktop',
    teamName: 'Local',
    clusterName: 'Local Cluster'
} as const;

export const DEFAULT_SERVER_PORT = 8100;
export const DEFAULT_DAEMON_PORT = 18080;

export const serverOriginFor = (port: number): string => `http://127.0.0.1:${port}`;
