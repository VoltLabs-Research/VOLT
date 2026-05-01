export type TeamClusterRole = 'cluster' | 'storage-server' | 'compute-node';

interface TeamClusterRoleDrainState {
    compute: boolean;
    storage: boolean;
}

export interface TeamClusterRuntimeRoleConfig {
    desiredRole: TeamClusterRole;
    effectiveRole: TeamClusterRole;
    runtimeVersion: number;
    draining: TeamClusterRoleDrainState;
    lastAppliedAt?: string | Date | null;
}

export interface TeamClusterQueueScopeLimit {
    maxRunningPerTrajectory: number;
    maxRunningPerTeam: number;
}

export interface TeamClusterDaemonQueueScopeLimits {
    analysisProcessing: TeamClusterQueueScopeLimit;
    artifactUpload: TeamClusterQueueScopeLimit;
    trajectoryRasterization: TeamClusterQueueScopeLimit;
    trajectoryGlbConversion: TeamClusterQueueScopeLimit;
    cloudUpload: TeamClusterQueueScopeLimit;
    trajectoryCompression: TeamClusterQueueScopeLimit;
}

export interface TeamClusterDaemonRoleApplyPayload {
    [key: string]: string | number | boolean | null | TeamClusterRuntimeRoleConfig | undefined;
    roleConfig: TeamClusterRuntimeRoleConfig;
}

export interface TeamClusterDaemonRoleApplyResult {
    accepted: boolean;
    roleConfig: TeamClusterRuntimeRoleConfig;
}

export interface TeamClusterDaemonQueueConcurrency {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    sshImport: number;
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
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    },
    artifactUpload: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    },
    trajectoryRasterization: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    },
    trajectoryGlbConversion: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    },
    cloudUpload: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    },
    trajectoryCompression: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
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
