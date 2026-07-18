

export type TeamClusterStatusWire =
    | 'waiting-for-connection'
    | 'healthcheck-received'
    | 'preparing-environment'
    | 'connected'
    | 'disconnected'
    | 'deleting';

export type TeamClusterRole = 'compute-and-storage' | 'compute-only' | 'storage-only';

export type StoragePlacementScopeType = 'trajectory' | 'analysis';

export interface TeamClusterServiceWire{
    port: number | null;
}

export interface TeamClusterServicesWire{
    minio: TeamClusterServiceWire;
    redis: TeamClusterServiceWire;
    mongodb: TeamClusterServiceWire;
    daemon: TeamClusterServiceWire;
}

export interface TeamClusterCredentialServiceWire extends TeamClusterServiceWire{
    username: string;
    password: string;
}

export interface TeamClusterDaemonCredentialServiceWire extends TeamClusterServiceWire{
    password: string;
}

export interface TeamClusterCredentialServicesWire{
    minio: TeamClusterCredentialServiceWire;
    redis: TeamClusterCredentialServiceWire;
    mongodb: TeamClusterCredentialServiceWire;
    daemon: TeamClusterDaemonCredentialServiceWire;
}

export interface TeamClusterQueueConcurrencyWire{
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    pluginWarmup: number;
}

export interface TeamClusterQueueScopeLimitWire{
    maxRunningPerTrajectory: number;
}

export interface TeamClusterQueueScopeLimitsWire{
    analysisProcessing: TeamClusterQueueScopeLimitWire;
    artifactUpload: TeamClusterQueueScopeLimitWire;
    trajectoryRasterization: TeamClusterQueueScopeLimitWire;
    trajectoryGlbConversion: TeamClusterQueueScopeLimitWire;
}

export interface TeamClusterRuntimeRoleConfigWire{
    desiredRole: TeamClusterRole;
    effectiveRole: TeamClusterRole;
    runtimeVersion: number;
    draining: {
        compute: boolean;
        storage: boolean;
    };
    lastAppliedAt?: string | null;
}

export interface TeamClusterEffectiveCapabilitiesWire{
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
    servesStorageReads: boolean;
    servesArtifactDownloads: boolean;
}

export interface StoragePlacementBucketRefWire{
    bucket: string;
    prefix: string;
}

export interface ClusterTransferJobWire{
    _id: string;
    team: string;
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    sourceClusterId: string;
    destinationClusterId: string;
    buckets: StoragePlacementBucketRefWire[];
    state: string;
    reason: string;
    cleanupSource: boolean;
    requestedBy: string;
    cursor: { bucketIndex: number; lastObjectKey: string | null };
    stats: {
        copiedObjects: number;
        copiedBytes: number;
        verifiedObjects: number;
        verifiedBytes: number;
        deletedObjects: number;
    };
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TeamClusterWire{
    _id: string;
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatusWire;
    installedVersion: string | null;
    lastHeartbeatAt: string | null;
    lastDisconnectAt: string | null;
    services: TeamClusterServicesWire;
    queueConcurrency: TeamClusterQueueConcurrencyWire;
    queueScopeLimits: TeamClusterQueueScopeLimitsWire;
    roleConfig: TeamClusterRuntimeRoleConfigWire;
    effectiveCapabilities: TeamClusterEffectiveCapabilitiesWire;
    activeTransfers?: ClusterTransferJobWire[];
    isDemo: boolean;
    demoExpiresAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTeamClusterResponse{
    teamCluster: TeamClusterWire;
    enrollmentToken: string;
}

export interface GetTeamClusterResponse{
    teamCluster: TeamClusterWire;
}

export interface ProvisionDemoTeamClusterResponse{
    teamCluster: TeamClusterWire;
}

export interface GetDemoTeamClusterStatusResponse{
    teamCluster: TeamClusterWire | null;
    remainingMs: number | null;
    hasActiveDemo: boolean;
}

export interface DeleteDemoTeamClusterResponse{
    teardownScheduled: boolean;
}

export interface DeleteTeamClusterResponse{
    success: boolean;
    deleted: boolean;
    manualUninstallRequired: boolean;
    message: string;
    manualUninstallCommand?: string;
    teamCluster?: TeamClusterWire;
}

export interface UpdateTeamClusterRoleResponse{
    message: string;
    teamCluster: TeamClusterWire;
}

export interface UpdateTeamClusterQueueConcurrencyResponse{
    message: string;
    teamCluster: TeamClusterWire;
}

export interface RegenerateTeamClusterEnrollmentTokenResponse{
    enrollmentToken: string;
}

export interface RevealTeamClusterCredentialsResponse{
    teamClusterId: string;
    services: TeamClusterCredentialServicesWire;
}

export interface ClusterResourceLimitsResponse{
    resourceLimits: {
        maxCpus: number | null;
        maxMemoryMB: number | null;
        status: string | null;
        lastUpdatedAt: string | null;
    };
}

export interface QueueCountsSnapshotWire{
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
}

export interface GetTeamClusterRuntimeSnapshotResponse{
    capturedAt: string;
    queueConcurrency: TeamClusterQueueConcurrencyWire;
    daemonQueues: Array<{ name: string; counts: QueueCountsSnapshotWire }>;
    serverQueues: Array<{ name: string; location: 'server'; concurrency: number }>;
}

export interface CreateTeamClusterTransferRequestResponse{
    message: string;
    sourceClusterId: string;
    destinationClusterId: string;
    requestedJobs: ClusterTransferJobWire[];
}

export type TeamClusterRemoteAccessTarget = 'mongo-documents' | 'redis-data' | 'minio';

export interface TeamClusterRemoteAccessSessionWire{
    sessionId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    createdAt: string;
    expiresAt: string;
}

export interface CreateTeamClusterRemoteAccessSessionResponse{
    session: TeamClusterRemoteAccessSessionWire;
}

export interface TeamClusterRemoteExplorerEntryWire{
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
    entries: TeamClusterRemoteExplorerEntryWire[];
}

export interface TeamClusterRemoteExplorerNodeWire{
    path: string;
    title: string;
    type: string;
    contentType: string;
    textContent: string | null;
    mongoDocuments: Array<{ id: string; value: Record<string, unknown> }>;
}

export interface GetTeamClusterRemoteExplorerNodeResponse{
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    node: TeamClusterRemoteExplorerNodeWire;
}

export interface TeamClusterInstallManifestPortsWire{
    minio: number;
    redis: number;
    mongodb: number;
    daemon: number;
}

export interface TeamClusterInstallManifestWire{
    manifestVersion: string;
    composeProjectName: string;
    buildContextArchiveBase64?: string;
    files: Array<{ path: string; contents: string; mode: string }>;
    images: { minio: string; redis: string; mongodb: string; daemon: string };
}

export interface GenerateTeamClusterInstallManifestResponse{
    manifest: TeamClusterInstallManifestWire;
}

export interface ProcessTeamClusterHealthcheckResponse{
    teamCluster: TeamClusterWire;
    daemonPassword: string;
}
