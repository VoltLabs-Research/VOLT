import type {
    TeamClusterDaemonHostCapabilities,
    TeamClusterDaemonQueueConcurrency as DaemonQueueConcurrencyWire,
    TeamClusterDaemonQueueScopeLimits as DaemonQueueScopeLimitsWire,
    TeamClusterDaemonRole,
    TeamClusterDaemonRuntimeRoleConfig
} from '@voltstack/daemon-cluster-client';

export type TeamClusterRole = TeamClusterDaemonRole;
export type TeamClusterRuntimeRoleConfig = TeamClusterDaemonRuntimeRoleConfig;
export type TeamClusterDaemonQueueScopeLimits = DaemonQueueScopeLimitsWire;
export type TeamClusterDaemonQueueConcurrency = DaemonQueueConcurrencyWire;
export type TeamClusterHostCapabilities = TeamClusterDaemonHostCapabilities;

export interface TeamClusterDaemonRoleApplyPayload {
    [key: string]: string | number | boolean | null | TeamClusterRuntimeRoleConfig | undefined;
    roleConfig: TeamClusterRuntimeRoleConfig;
}

export interface TeamClusterDaemonRoleApplyResult {
    accepted: boolean;
    roleConfig: TeamClusterRuntimeRoleConfig;
}

export interface TeamClusterDaemonQueueConcurrencyApplyPayload {
    queueConcurrency: TeamClusterDaemonQueueConcurrency;
    queueScopeLimits: TeamClusterDaemonQueueScopeLimits;
}

export interface TeamClusterDaemonRuntimeConfig {
    queueConcurrency: TeamClusterDaemonQueueConcurrency;
    queueScopeLimits: TeamClusterDaemonQueueScopeLimits;
    roleConfig: TeamClusterRuntimeRoleConfig;
}

export const DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS: TeamClusterDaemonQueueScopeLimits = {
    analysisProcessing: {
        maxRunningPerTrajectory: 0
    },
    artifactUpload: {
        maxRunningPerTrajectory: 0
    },
    trajectoryRasterization: {
        maxRunningPerTrajectory: 0
    },
    trajectoryGlbConversion: {
        maxRunningPerTrajectory: 0
    }
};

export const createDefaultTeamClusterRuntimeRoleConfig = (
    role: TeamClusterRole = 'cluster'
): TeamClusterRuntimeRoleConfig => {
    return {
        desiredRole: role,
        effectiveRole: role,
        runtimeVersion: 1,
        draining: {
            compute: false,
            storage: false
        },
        lastAppliedAt: null
    };
};
