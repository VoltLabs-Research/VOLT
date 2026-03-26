import type { TeamClusterServiceExposureAccessMode } from './serviceExposure';

export enum ObjectBucketName {
    Dumps = 'volt-dumps',
    Models = 'volt-models',
    Plugins = 'volt-plugins',
    Rasterizer = 'volt-rasterizer'
};

export const TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH = '/internal/team-cluster/object-store/v1';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER = 'x-team-cluster-id';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER = 'x-team-cluster-daemon-password';
export const TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX = 'x-object-meta-';
export const TEAM_CLUSTER_DIRECT_ACCESS_BASE_PATH = '/internal/team-cluster/direct-access/v1';
export const TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER = 'x-team-cluster-direct-access-token';
export const VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID = '__volt_server__';

export enum TextEncoding {
    Utf8 = 'utf8',
    Base64 = 'base64'
};

export enum ContainerAction {
    Start = 'start',
    Stop = 'stop',
    Restart = 'restart'
};

export enum EntrypointType {
    Executable = 'executable',
    PythonScript = 'python-script'
};

export interface TeamClusterDirectAccessGrantRequest {
    ownerClusterId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export interface TeamClusterDirectAccessGrantResponse {
    ownerClusterId: string;
    exposureName: string;
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    endpoint: {
        protocol: 'http' | 'https' | 'ws' | 'wss' | 'tcp';
        host: string;
        port: number;
    };
    token: string;
    expiresAt: string;
}

export enum OrchestrationAction {
    AnalysisStart = 'analysis-start',
    ContainerCreate = 'container-create',
    TrajectoryPreprocess = 'trajectory-preprocess',
    NativeTrajectoryPreprocess = 'native-trajectory-preprocess',
    QueueDispatch = 'queue-dispatch',
    PluginSync = 'plugin-sync',
    ObjectUpload = 'object-upload',
    NativeColorModelExport = 'native-color-model-export',
    NativeParticleFilterExport = 'native-particle-filter-export',
    Uninstall = 'uninstall'
};

export interface ContainerEnvironmentVariable {
    key: string;
    value: string;
};

export interface ContainerPortMapping {
    private: number;
    public?: number;
};

export interface CreateContainerRequest {
    image: string;
    name: string;
    operationId?: string;
    user?: string;
    env?: ContainerEnvironmentVariable[];
    ports?: ContainerPortMapping[];
    memoryInMegabytes: number;
    cpus: number;
    binds?: string[];
    labels?: Record<string, string>;
    networkMode?: string;
    cmd?: string[];
};

export interface NotebookSessionSnapshot {
    _id: string;
    teamId: string;
    notebookPath: string;
    content?: Record<string, unknown>;
};

export interface NotebookContainerResources {
    cpus: number;
    memoryMB: number;
};

export interface CreateNotebookSessionRequest {
    requestedBy: string;
    publicBasePath: string;
    notebook: NotebookSessionSnapshot;
    containerResources: NotebookContainerResources;
};

export type NotebookContainerStage = 'creating' | 'starting' | 'ready';

export interface CreateNotebookSessionResponse {
    jupyter: {
        internalPath: string;
        url: string;
        ready: boolean;
        containerStage: NotebookContainerStage;
    };
};

export interface ObjectUploadRequest {
    bucket: ObjectBucketName;
    objectKey: string;
    content: string;
    encoding?: TextEncoding;
    metadata?: Record<string, string>;
};

export interface ObjectDeleteRequest {
    bucket: ObjectBucketName;
    objectKey?: string;
    prefix?: string;
};

export interface PluginSyncRequest {
    pluginId: string;
    objectKey: string;
    ownerClusterId?: string;
    expectedHash?: string;
};

export interface ResolvedObjectRef {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    expectedHash?: string;
    sizeBytes?: number;
}

export interface ResolvedObjectWrite {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    expectedHash?: string;
    sizeBytes?: number;
    contentType?: string;
}

export interface AnalysisQueueJobPayload extends Record<string, unknown> {
    jobId: string;
    teamId: string;
    timestep?: number;
    sessionId?: string;
    status: string;
    queueType: string;
    name: string;
    maxRetries?: number;
    metadata?: Record<string, unknown>;
    completedAt?: string;
    error?: string;
    startTime?: string;
    progress?: number;
    message?: string;
    workerId?: number;
    executionData?: AnalysisJobExecutionData;
    executionDataCompressed?: string;
    executionDataReference?: AnalysisExecutionDataReference;
    createdAt: string;
    updatedAt: string;
};

export interface RasterQueueJobPayload extends Record<string, unknown> {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep: number;
    modelObjectKey: string;
    modelOwnerClusterId?: string;
    outputObjectKey: string;
    outputOwnerClusterId?: string;
    status: string;
    queueType: string;
    metadata?: Record<string, unknown>;
    error?: string;
    createdAt: string;
    updatedAt: string;
};

export interface AnalysisExposureDefinition {
    nodeId: string;
    name: string;
    results: string;
    iterable?: string;
    export?: {
        exporter: string;
        type: string;
        options?: Record<string, unknown>;
    };
};

export interface DaemonAnalysisDocument {
    _id: string;
    plugin?: string;
    pluginDisplayName: string;
    computeClusterId?: string;
    storageClusterId?: string;
    config?: Record<string, unknown>;
    trajectory?: string;
    createdBy?: string;
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: string | Date;
    finishedAt?: string | Date;
    team?: string;
    status?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
};

export interface WorkflowEdgeDefinition {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
};

export interface WorkflowNodeDefinition {
    id: string;
    type: string;
    position: {
        x: number;
        y: number;
    };
    data: Record<string, unknown>;
};

export interface WorkflowDefinition {
    nodes: WorkflowNodeDefinition[];
    edges: WorkflowEdgeDefinition[];
};

export interface NestedPluginDefinition {
    pluginId: string;
    workflow: WorkflowDefinition;
};

export interface PluginReferenceExecutionRequest {
    referencePath: string;
    pluginId: string;
    config: Record<string, unknown>;
};

export interface TrajectoryFrame {
    timestep: number;
    natoms: number;
    simulationCell: string;
};

export interface TrajectoryDumpDescriptor extends TrajectoryFrame {
    path: string;
    originalPath?: string;
};

export interface AnalysisExecutionDataReference {
    key: string;
    storedAt: string;
    ttlSeconds: number;
};

export interface AnalysisJobExecutionData {
    binaryObjectPath: string;
    entrypointType?: EntrypointType;
    arguments: string;
    requirementsFile?: string;
    entrypointScript?: string;
    pluginId: string;
    trajectoryId: string;
    analysisId: string;
    teamId?: string;
    trajectoryFrames: TrajectoryFrame[];
    computeClusterId?: string;
    storageClusterId?: string;
    pluginBinaryRef?: ResolvedObjectRef;
    exposures: AnalysisExposureDefinition[];
    forEachNodeId?: string;
    nodeOutputSnapshots: Record<string, Record<string, unknown>>;
    workflow: WorkflowDefinition;
    nestedPlugins: NestedPluginDefinition[];
    pluginReferenceExecutions?: PluginReferenceExecutionRequest[];
    batchTrajectoryDumps?: TrajectoryDumpDescriptor[];
    allDumpUrls?: string[];
    batchMode?: boolean;
    contextNodeId?: string;
    traceContext?: Record<string, string>;
};

export interface AnalysisStartTransportRequest {
    analysis: DaemonAnalysisDocument;
    analysisId: string;
    pluginId: string;
    pluginDisplayName: string;
    teamId: string;
    teamClusterId: string;
    trajectoryId: string;
    trajectoryName?: string;
    trajectoryFrames?: TrajectoryFrame[];
    trajectoryFramesCompressed?: string;
    workflow?: WorkflowDefinition;
    workflowCompressed?: string;
    nestedPlugins?: NestedPluginDefinition[];
    nestedPluginsCompressed?: string;
    pluginReferenceExecutions?: PluginReferenceExecutionRequest[];
    pluginReferenceExecutionsCompressed?: string;
    config: Record<string, unknown>;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
};

export interface AnalysisStartRequest extends AnalysisStartTransportRequest {
    trajectoryFrames: TrajectoryFrame[];
    workflow: WorkflowDefinition;
    nestedPlugins: NestedPluginDefinition[];
};

export interface RetryJobsRequest {
    jobIds: string[];
};

export interface RemoveRunningJobsRequest {
    jobIds: string[];
};

export interface ClearJobsHistoryRequest {
    teamId: string;
    jobIds: string[];
};

export interface JobsActionResponse {
    affectedJobs: number;
};

export interface RasterizeTrajectoryRequest {
    trajectoryId: string;
    teamId: string;
    trajectoryName?: string;
    storageClusterId?: string;
    config?: Record<string, unknown>;
};

export interface RasterizeTrajectoryResponse {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
};

export interface GlbConversionQueueJobPayload extends Record<string, unknown> {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep: number;
    objectKey: string;
    ownerClusterId?: string;
    status: string;
    queueType: string;
    metadata?: Record<string, unknown>;
    error?: string;
    createdAt: string;
    updatedAt: string;
};

export interface EnqueuePreprocessingFrameDescriptor {
    timestep: number;
    objectKey: string;
    ownerClusterId?: string;
};

export interface EnqueuePreprocessingRequest {
    trajectoryId: string;
    teamId: string;
    trajectoryName?: string;
    storageClusterId?: string;
    frames: EnqueuePreprocessingFrameDescriptor[];
};

export interface QueuedJobNotification {
    jobId: string;
    name: string;
    teamId: string;
    timestep: number;
    trajectoryId: string;
    trajectoryName?: string;
    analysisId: string;
    queueType: string;
};

export interface AnalysisStartResponse {
    queued: boolean;
    totalJobs: number;
    jobs: QueuedJobNotification[];
};

export interface EnqueuePreprocessingResponse {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
};
