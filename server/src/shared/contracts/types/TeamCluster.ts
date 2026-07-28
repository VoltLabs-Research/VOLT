import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import type { TeamClusterRole } from '@volt/contracts/modules/cluster/domain';

export { TeamClusterStatus };
export type { TeamClusterRole };


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
    minio: TeamClusterServiceProps;
    redis: TeamClusterServiceProps;
    mongodb: TeamClusterServiceProps;
    daemon: TeamClusterDaemonServiceProps;
}

export interface TeamClusterQueueConcurrencyProps {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    pluginWarmup: number;
}

export interface TeamClusterQueueScopeLimitProps {
    maxRunningPerTrajectory: number;
}

export interface TeamClusterQueueScopeLimitsProps {
    analysisProcessing: TeamClusterQueueScopeLimitProps;
    artifactUpload: TeamClusterQueueScopeLimitProps;
    trajectoryRasterization: TeamClusterQueueScopeLimitProps;
    trajectoryGlbConversion: TeamClusterQueueScopeLimitProps;
}


export interface TeamClusterRoleCapabilitiesProps {
    canStore: boolean;
    canCompute: boolean;
}

export interface TeamClusterRoleDrainProps {
    compute: boolean;
    storage: boolean;
}

export interface TeamClusterRuntimeRoleConfigProps {
    desiredRole: TeamClusterRole;
    effectiveRole: TeamClusterRole;
    runtimeVersion: number;
    draining: TeamClusterRoleDrainProps;
    lastAppliedAt?: Date | null;
}

export interface TeamClusterEffectiveCapabilitiesProps {
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
    servesStorageReads: boolean;
    servesArtifactDownloads: boolean;
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
    queueConcurrency: TeamClusterQueueConcurrencyProps;
    queueScopeLimits: TeamClusterQueueScopeLimitsProps;
    roleConfig: TeamClusterRuntimeRoleConfigProps;
    effectiveCapabilities?: TeamClusterEffectiveCapabilitiesProps;
    isDemo: boolean;
    demoExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface TeamClusterLike {
    _id: string;
    props: TeamClusterProps;
}
