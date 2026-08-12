
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
};

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
    runtime?: {
        roleConfig: TeamClusterDaemonRuntimeRoleConfig;
    };
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
