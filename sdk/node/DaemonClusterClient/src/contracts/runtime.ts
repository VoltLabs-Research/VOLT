/**
 * Wire types for the heartbeat plane and the runtime.* commands.
 *
 * These shapes travel as JSON between a daemon and the Volt server control
 * plane; both sides import them from here instead of declaring parallel copies.
 * Dates cross the wire as ISO strings, but consumers that persist them (the
 * server) may hold `Date` instances, so the date fields accept both.
 */

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

/**
 * What a host can do, observed rather than configured.
 *
 * Reported on every heartbeat instead of once at registration, so it follows
 * the machine: a user who installs a container runtime later sees the features
 * that need one light up without re-enrolling the cluster.
 */
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

/** System metrics snapshot reported on every heartbeat. */
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

/** Payload of the `runtime-heartbeat` command a daemon invokes on the control plane. */
export interface TeamClusterDaemonHeartbeatCommand {
    teamClusterId: string;
    daemonPassword: string;
    installedVersion?: string;
    runtime?: {
        roleConfig: TeamClusterDaemonRuntimeRoleConfig;
    };
    metrics?: TeamClusterDaemonHeartbeatMetrics;
    /** Absent from daemons older than the capability probe; that is not "no runtime". */
    hostCapabilities?: TeamClusterDaemonHostCapabilities;
};

/** Payload of the `runtime-lifecycle` command. */
export interface TeamClusterDaemonLifecycleCommand {
    teamClusterId: string;
    daemonPassword: string;
    status: string;
    installedVersion?: string;
};

/** Payload of the `runtime-delete-completed` command. */
export interface TeamClusterDaemonDeleteCompletedCommand {
    teamClusterId: string;
    daemonPassword: string;
};
