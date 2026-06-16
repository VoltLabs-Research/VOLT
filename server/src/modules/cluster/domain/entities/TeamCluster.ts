export {
    TeamClusterStatus
} from '@shared/contracts/types/TeamCluster';
export type {
    TeamClusterServiceProps,
    TeamClusterDaemonServiceProps,
    TeamClusterServicesProps,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRole,
    TeamClusterRoleCapabilitiesProps,
    TeamClusterRoleDrainProps,
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterEffectiveCapabilitiesProps,
    TeamClusterProps
} from '@shared/contracts/types/TeamCluster';

import type {
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRole,
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterEffectiveCapabilitiesProps,
    TeamClusterProps
} from '@shared/contracts/types/TeamCluster';

export {
    resolveTeamClusterRoleCapabilities,
    buildTeamClusterEffectiveCapabilities,
    resolveEffectiveCapabilitiesFromRoleConfig
} from '@shared/domain/utilities/cluster-capabilities';
import { resolveEffectiveCapabilitiesFromRoleConfig } from '@shared/domain/utilities/cluster-capabilities';

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
        maxRunningPerTrajectory: 0,
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

export default class TeamCluster {
    constructor(
        public readonly _id: string,
        public props: TeamClusterProps
    ){}

    public get id(): string {
        return this._id;
    }

    public get effectiveCapabilities(): TeamClusterEffectiveCapabilitiesProps {
        return resolveEffectiveCapabilitiesFromRoleConfig(this.props.roleConfig);
    }
}
