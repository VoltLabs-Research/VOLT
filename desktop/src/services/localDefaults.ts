import { LOCAL_ACCOUNT_EMAIL } from '@volt/contracts/modules/auth/local-account';

export const LOCAL_DEFAULTS = {
    fullName: 'Local',
    email: LOCAL_ACCOUNT_EMAIL,
    password: 'volt-local-desktop',
    teamName: 'Local',
    clusterName: 'Local Cluster'
} as const;
