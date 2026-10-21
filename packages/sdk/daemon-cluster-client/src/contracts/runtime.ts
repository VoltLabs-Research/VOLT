
export type TeamClusterDaemonRole = 'cluster' | 'storage-server' | 'compute-node';

export interface TeamClusterDaemonRoleDrainState {
    compute: boolean;
    storage: boolean;
};

export interface TeamClusterDaemonRuntimeRoleConfig {
    desiredRole: TeamClusterDaemonRole;
    effectiveRole: TeamClusterDaemonRole;
    runtimeVersion: number;
    draining: TeamClusterDaemonRoleDrainState;
    lastAppliedAt?: string | Date | null;
};

export interface TeamClusterDaemonQueueScopeLimit {
    maxRunningPerTrajectory: number;
};

export interface TeamClusterDaemonQueueScopeLimits {
    analysisProcessing: TeamClusterDaemonQueueScopeLimit;
    artifactUpload: TeamClusterDaemonQueueScopeLimit;
    trajectoryRasterization: TeamClusterDaemonQueueScopeLimit;
    trajectoryGlbConversion: TeamClusterDaemonQueueScopeLimit;
};

export interface TeamClusterDaemonQueueConcurrency {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    pluginWarmup: number;
};

export interface TeamClusterDaemonHostCapabilities {
    containerRuntime: boolean;
    platform?: string;
};

export interface TeamClusterDaemonRuntimeConfig {
    queueConcurrency: TeamClusterDaemonQueueConcurrency;
    queueScopeLimits: TeamClusterDaemonQueueScopeLimits;
    roleConfig: TeamClusterDaemonRuntimeRoleConfig;
};

export interface TeamClusterDaemonRoleApplyPayload {
    roleConfig: TeamClusterDaemonRuntimeRoleConfig;
};

export type TeamClusterDaemonRoleApplyResult =
    | { accepted: true; roleConfig: TeamClusterDaemonRuntimeRoleConfig }
    | { accepted: false; error: string };

export type TeamClusterDaemonQueueConcurrencyApplyPayload = Omit<TeamClusterDaemonRuntimeConfig, 'roleConfig'>;

export type TeamClusterDaemonQueueConcurrencyApplyResult =
    | ({ accepted: true } & TeamClusterDaemonQueueConcurrencyApplyPayload)
    | { accepted: false; error: string };

export const DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY: TeamClusterDaemonQueueConcurrency = Object.freeze({
    analysis: 8,
    rasterizer: 8,
    glbPreprocessing: 16,
    artifactUpload: 16,
    pluginWarmup: 4
});

// Zero means "no per-trajectory limit".
export const DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS: TeamClusterDaemonQueueScopeLimits = Object.freeze({
    analysisProcessing: Object.freeze({ maxRunningPerTrajectory: 0 }),
    artifactUpload: Object.freeze({ maxRunningPerTrajectory: 0 }),
    trajectoryRasterization: Object.freeze({ maxRunningPerTrajectory: 0 }),
    trajectoryGlbConversion: Object.freeze({ maxRunningPerTrajectory: 0 })
});

export const createDefaultTeamClusterRuntimeRoleConfig = (
    role: TeamClusterDaemonRole = 'cluster'
): TeamClusterDaemonRuntimeRoleConfig => ({
    desiredRole: role,
    effectiveRole: role,
    runtimeVersion: 1,
    draining: {
        compute: false,
        storage: false
    },
    lastAppliedAt: null
});

export interface TeamClusterDaemonMemoryMetrics {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
};

export interface TeamClusterDaemonDiskMetrics {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
};

export interface TeamClusterDaemonDiskOperationMetrics {
    readMegabytesPerSecond: number;
    writeMegabytesPerSecond: number;
    readIOPS: number;
    writeIOPS: number;
    totalIOPS: number;
};

export interface TeamClusterDaemonNetworkMetrics {
    incomingKilobytesPerSecond: number;
    outgoingKilobytesPerSecond: number;
    totalKilobytesPerSecond: number;
};

export interface TeamClusterDaemonHeartbeatMetrics {
    timestamp: string;
    hostname: string;
    uptimeSeconds: number;
    cpuUsagePercent: number;
    cpuLoadAverage: number[];
    cpuPerCoreUsagePercent: number[];
    memory: TeamClusterDaemonMemoryMetrics;
    disk: TeamClusterDaemonDiskMetrics;
    diskOperations: TeamClusterDaemonDiskOperationMetrics;
    network: TeamClusterDaemonNetworkMetrics;
    cloudLatencyMs: number | null;
};

export interface TeamClusterDaemonHeartbeatCommand {
    teamClusterId: string;
    daemonPassword: string;
    installedVersion?: string;
    // Null until the daemon has fetched its runtime config from the server.
    runtime?: Pick<TeamClusterDaemonRuntimeConfig, 'roleConfig'> | null;
    metrics?: TeamClusterDaemonHeartbeatMetrics;
    hostCapabilities?: TeamClusterDaemonHostCapabilities;
};

export interface TeamClusterDaemonLifecycleCommand {
    teamClusterId: string;
    daemonPassword: string;
    status: string;
    installedVersion?: string;
};

export interface TeamClusterDaemonDeleteCompletedCommand {
    teamClusterId: string;
    daemonPassword: string;
};
