/**
 * Neutral, cross-module TYPE/ENUM contracts for the TeamCluster aggregate.
 *
 * Extracted from `@modules/cluster/entities/TeamCluster` during the
 * detachable-modules migration. Only the pure data shapes live here (enums +
 * `*Props` interfaces + the `TeamClusterRole` alias) — the `TeamCluster` CLASS
 * and its runtime helper functions/constants stay in the cluster module. The
 * original entity file re-exports everything below so existing importers (and
 * the runtime helpers that depend on these types) compile unchanged.
 *
 * This file imports no `@modules/*` code.
 */

export enum TeamClusterStatus {
    WaitingForConnection = 'waiting-for-connection',
    HealthcheckReceived = 'healthcheck-received',
    PreparingEnvironment = 'preparing-environment',
    DependenciesInstallationFailed = 'dependency-installation-failed',
    OperatingSystemNotSupported = 'operating-system-not-supported',
    Connected = 'connected',
    Disconnected = 'disconnected',
    Deleting = 'deleting',
    DeleteFailed = 'delete-failed',
    Updating = 'updating',
    UpdateFailed = 'update-failed'
}

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

export type TeamClusterRole = 'cluster' | 'storage-server' | 'compute-node';

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

/**
 * Structural stand-in for the TeamCluster entity (a class with `props` + an `id`
 * getter in the owner module). Consumers that only need the data shape can use
 * this instead of importing the concrete class from `@modules/cluster`.
 */
export interface TeamClusterLike {
    _id: string;
    props: TeamClusterProps;
}
