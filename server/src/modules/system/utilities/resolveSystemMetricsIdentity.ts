import os from 'node:os';

export interface SystemMetricsIdentity {
    clusterId: string;
    serverId: string;
    teamClusterId: string | null;
};

const readIdentityEnv = (key: string): string | null => {
    const value = process.env[key]?.trim();
    return value ? value : null;
};

// TODO: Remove CLUSTER_ID
export const resolveSystemMetricsIdentity = (): SystemMetricsIdentity => {
    const teamClusterId = readIdentityEnv('TEAM_CLUSTER_ID');
    const serverId = readIdentityEnv('CLUSTER_ID') ?? os.hostname();

    return {
        clusterId: teamClusterId ?? serverId,
        serverId,
        teamClusterId
    };
};
