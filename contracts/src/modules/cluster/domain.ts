export enum TeamClusterStatus{
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

export type TeamClusterRole = 'cluster' | 'storage-server' | 'compute-node';

export type StoragePlacementScopeType = 'trajectory' | 'analysis' | 'plugin-binary';

export interface TeamClusterService{
    port: number | null;
}

export interface TeamClusterServices{
    postgres: TeamClusterService;
    daemon: TeamClusterService;
}

export interface TeamClusterCredentialService extends TeamClusterService{
    username: string;
    password: string;
}

export interface TeamClusterDaemonCredentialService extends TeamClusterService{
    password: string;
}

export interface TeamClusterCredentialServices{
    postgres: TeamClusterCredentialService;
    daemon: TeamClusterDaemonCredentialService;
}

export interface TeamClusterQueueConcurrency{
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    pluginWarmup: number;
}

export interface TeamClusterQueueScopeLimit{
    maxRunningPerTrajectory: number;
}

export interface TeamClusterQueueScopeLimits{
    analysisProcessing: TeamClusterQueueScopeLimit;
    artifactUpload: TeamClusterQueueScopeLimit;
    trajectoryRasterization: TeamClusterQueueScopeLimit;
    trajectoryGlbConversion: TeamClusterQueueScopeLimit;
}

export interface TeamClusterRoleDraining{
    compute: boolean;
    storage: boolean;
}

export interface TeamClusterRuntimeRoleConfig{
    desiredRole: TeamClusterRole;
    effectiveRole: TeamClusterRole;
    runtimeVersion: number;
    draining: TeamClusterRoleDraining;
    lastAppliedAt: string | null;
}

export interface TeamClusterEffectiveCapabilities{
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
    servesStorageReads: boolean;
    servesArtifactDownloads: boolean;
}

export interface TeamClusterHostCapabilities{
    containerRuntime: boolean;
}

export type ClusterTransferJobState =
    | 'queued'
    | 'freezing'
    | 'copying'
    | 'verifying'
    | 'switching'
    | 'cleaning'
    | 'completed'
    | 'failed'
    | 'cancelled';

export type ClusterTransferJobReason = 'manual' | 'soft-limit' | 'hard-limit';

export interface ClusterTransferJobCursor{
    bucketIndex: number;
    lastObjectKey: string | null;
}

export interface ClusterTransferJobStats{
    copiedObjects: number;
    copiedBytes: number;
    verifiedObjects: number;
    verifiedBytes: number;
    deletedObjects: number;
}

export interface ClusterTransferJob{
    _id: string;
    team: string;
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    sourceClusterId: string;
    destinationClusterId: string;
    state: ClusterTransferJobState;
    reason: ClusterTransferJobReason;
    cleanupSource: boolean;
    requestedBy: string;
    cursor: ClusterTransferJobCursor;
    stats: ClusterTransferJobStats;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TeamCluster{
    _id: string;
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    installedVersion: string | null;
    lastHeartbeatAt: string | null;
    lastDisconnectAt: string | null;
    services: TeamClusterServices;
    queueConcurrency: TeamClusterQueueConcurrency;
    queueScopeLimits: TeamClusterQueueScopeLimits;
    roleConfig: TeamClusterRuntimeRoleConfig;
    effectiveCapabilities: TeamClusterEffectiveCapabilities;
    hostCapabilities: TeamClusterHostCapabilities | null;
    activeTransfers?: ClusterTransferJob[];
    createdAt: string;
    updatedAt: string;
}

export interface TeamClusterLifecycleEvent{
    teamClusterId: string;
    teamId: string;
    deleted: boolean;
    teamCluster?: TeamCluster;
    status?: TeamClusterStatus;
    timestamp: string;
}

export enum ClusterStatus{
    Healthy = 'Healthy',
    Warning = 'Warning',
    Critical = 'Critical'
}

export interface ClusterCpuMetrics{
    usage: number;
    cores: number;
    coresUsage: number[];
    loadAvg: number[];
}

export interface ClusterMemoryMetrics{
    total: number;
    used: number;
    free: number;
    usagePercent: number;
}

export interface ClusterDiskMetrics{
    total: number;
    used: number;
    free: number;
    usagePercent: number;
}

export interface ClusterNetworkMetrics{
    incoming: number;
    outgoing: number;
}

export interface ClusterResponseTimes{
    postgres: number;
    self: number;
}

export interface ClusterDatabaseMetrics{
    queries: number;
    connections: number;
    latency: number;
}

export interface ClusterDiskOperationsMetrics{
    read: number;
    write: number;
    speed: number;
}

export interface ClusterMetrics{
    timestamp?: string;
    clusterId: string;
    teamClusterId?: string;
    serverId?: string;
    status: ClusterStatus;
    cpu: ClusterCpuMetrics;
    memory: ClusterMemoryMetrics;
    disk: ClusterDiskMetrics;
    network: ClusterNetworkMetrics;
    responseTimes: ClusterResponseTimes;
    postgres?: ClusterDatabaseMetrics;
    diskOperations?: ClusterDiskOperationsMetrics;
    uptime: number;
    analysisCount?: number;
}

export interface CreateTeamClusterResponse{
    teamCluster: TeamCluster;
    enrollmentToken: string;
}

export interface GetTeamClusterResponse{
    teamCluster: TeamCluster;
}

export interface DeleteTeamClusterResponse{
    success: boolean;
    deleted: boolean;
    manualUninstallRequired: boolean;
    message: string;
    manualUninstallCommand?: string;
    teamCluster?: TeamCluster;
}

export interface UpdateTeamClusterRoleResponse{
    message: string;
    teamCluster: TeamCluster;
}

export interface UpdateTeamClusterQueueConcurrencyResponse{
    message: string;
    teamCluster: TeamCluster;
}

export interface RegenerateTeamClusterEnrollmentTokenResponse{
    enrollmentToken: string;
}

export interface RevealTeamClusterCredentialsResponse{
    teamClusterId: string;
    services: TeamClusterCredentialServices;
}

export type ClusterResourceStatus = 'Healthy' | 'Warning' | 'Critical';

export interface ClusterResourceLimits{
    maxCpus: number | null;
    maxMemoryMB: number | null;
    status: ClusterResourceStatus | null;
}

export interface ClusterResourceLimitsResponse{
    resourceLimits: ClusterResourceLimits;
}

export interface QueueCountsSnapshot{
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
}

export interface DaemonQueueSnapshot{
    name: string;
    counts: QueueCountsSnapshot;
}

export interface GetTeamClusterRuntimeSnapshotResponse{
    capturedAt: string;
    queueConcurrency: TeamClusterQueueConcurrency;
    daemonQueues: DaemonQueueSnapshot[];
}

export interface CreateTeamClusterTransferRequestResponse{
    message: string;
    sourceClusterId: string;
    destinationClusterId: string;
    requestedJobs: ClusterTransferJob[];
}

export enum TeamClusterRemoteAccessTarget{
    DaemonTables = 'daemon-tables',
    ObjectStore = 'object-store'
}

export interface TeamClusterRemoteAccessSession{
    sessionId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    createdAt: string;
    expiresAt: string;
}

export interface CreateTeamClusterRemoteAccessSessionResponse{
    session: TeamClusterRemoteAccessSession;
}

export interface TeamClusterRemoteExplorerEntry{
    id: string;
    name: string;
    path: string;
    type: string;
    size: number | null;
    updatedAt: string | null;
    description: string | null;
}

export interface ListTeamClusterRemoteExplorerEntriesResponse{
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
    entries: TeamClusterRemoteExplorerEntry[];
}

export interface TeamClusterRemoteExplorerDocument{
    id: string;
    value: Record<string, unknown>;
}

export interface TeamClusterRemoteExplorerNode{
    path: string;
    title: string;
    type: string;
    contentType: string;
    textContent: string | null;
    documents: TeamClusterRemoteExplorerDocument[];
}

export interface GetTeamClusterRemoteExplorerNodeResponse{
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    node: TeamClusterRemoteExplorerNode;
}

export interface TeamClusterInstallManifestPorts{
    postgres: number;
    daemon: number;
}

export interface TeamClusterInstallManifestFile{
    path: string;
    contents: string;
    mode: string;
}

export interface TeamClusterInstallManifestImages{
    postgres: string;
    daemon: string;
}

export interface TeamClusterInstallManifest{
    manifestVersion: string;
    composeProjectName: string;
    buildContextArchiveBase64?: string;
    files: TeamClusterInstallManifestFile[];
    images: TeamClusterInstallManifestImages;
}

export interface GenerateTeamClusterInstallManifestResponse{
    manifest: TeamClusterInstallManifest;
}

export interface ProcessTeamClusterHealthcheckResponse{
    teamCluster: TeamCluster;
    daemonPassword: string;
}

export type ClusterHistoryMetric = ClusterMetrics;
