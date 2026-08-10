import type {
    TeamClusterDaemonHostCapabilities,
    TeamClusterDaemonQueueConcurrency as DaemonQueueConcurrencyWire,
    TeamClusterDaemonQueueScopeLimit,
    TeamClusterDaemonQueueScopeLimits as DaemonQueueScopeLimitsWire,
    TeamClusterDaemonRole,
    TeamClusterDaemonRoleDrainState,
    TeamClusterDaemonRuntimeRoleConfig
} from '@voltstack/daemon-cluster-client';

/**
 * The runtime role/queue/capability shapes are heartbeat wire contracts owned by
 * `@voltstack/daemon-cluster-client`; these aliases keep the historical local
 * names used across the daemon.
 */
export type TeamClusterRole = TeamClusterDaemonRole;
export type TeamClusterRoleDrainState = TeamClusterDaemonRoleDrainState;
export type TeamClusterRuntimeRoleConfig = TeamClusterDaemonRuntimeRoleConfig;
export type TeamClusterQueueScopeLimit = TeamClusterDaemonQueueScopeLimit;
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
