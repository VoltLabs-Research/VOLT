import os from 'node:os';

const readIdentityEnv = (key: string): string | null => {
    const value = process.env[key]?.trim();
    return value ? value : null;
};

export const resolveSystemMetricsIdentity = (): string => {
    const teamClusterId = readIdentityEnv('TEAM_CLUSTER_ID');
    const serverId = readIdentityEnv('CLUSTER_ID') ?? os.hostname();

    return teamClusterId ?? serverId;
};
