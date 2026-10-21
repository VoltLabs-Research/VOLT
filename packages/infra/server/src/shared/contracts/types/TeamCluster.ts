import type {
    TeamClusterEffectiveCapabilities,
    TeamClusterHostCapabilities,
    TeamClusterQueueConcurrency,
    TeamClusterQueueScopeLimits,
    TeamClusterRuntimeRoleConfig,
    TeamClusterStatus
} from '@volt/contracts/modules/cluster/domain';

export interface TeamClusterServiceProps {
    port: number | null;
    username?: string;
    password?: string;
}

export interface TeamClusterDaemonServiceProps {
    port: number | null;
    password?: string;
}

export interface TeamClusterServicesProps {
    postgres: TeamClusterServiceProps;
    daemon: TeamClusterDaemonServiceProps;
}

export interface TeamClusterRoleCapabilitiesProps {
    canStore: boolean;
    canCompute: boolean;
}

export interface TeamClusterProps {
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    enrollmentTokenHash: string | null;
    installedVersion: string | null;
    installRoot: string | null;
    lastHeartbeatAt: Date | null;
    lastDisconnectAt: Date | null;
    services: TeamClusterServicesProps;
    queueConcurrency: TeamClusterQueueConcurrency;
    queueScopeLimits: TeamClusterQueueScopeLimits;
    roleConfig: TeamClusterRuntimeRoleConfig;
    effectiveCapabilities?: TeamClusterEffectiveCapabilities;
    hostCapabilities: TeamClusterHostCapabilities | null;
    createdAt: Date;
    updatedAt: Date;
}
