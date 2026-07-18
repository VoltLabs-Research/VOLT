import type {
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRole,
    TeamClusterRuntimeRoleConfigProps
} from '@shared/contracts/types/TeamCluster';

export const DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY: TeamClusterQueueConcurrencyProps = {
    analysis: 8,
    rasterizer: 8,
    glbPreprocessing: 16,
    artifactUpload: 16,
    pluginWarmup: 4
};

export const DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS: TeamClusterQueueScopeLimitsProps = {
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

export const DEFAULT_TEAM_CLUSTER_ROLE: TeamClusterRole = 'cluster';

export const createDefaultTeamClusterRoleConfig = (
    role: TeamClusterRole = DEFAULT_TEAM_CLUSTER_ROLE
): TeamClusterRuntimeRoleConfigProps => {
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
