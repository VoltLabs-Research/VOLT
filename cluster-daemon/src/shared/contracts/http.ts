export enum ObjectBucketName {
    Dumps = 'volt-dumps',
    Models = 'volt-models',
    Plugins = 'volt-plugins',
    Rasterizer = 'volt-rasterizer'
};

export enum TextEncoding {
    Utf8 = 'utf8',
    Base64 = 'base64'
};

export enum ContainerAction {
    Start = 'start',
    Stop = 'stop',
    Restart = 'restart'
};

export enum OrchestrationAction {
    AnalysisStart = 'analysis-start',
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
    public: number;
};

export interface CreateContainerRequest {
    image: string;
    name: string;
    env?: ContainerEnvironmentVariable[];
    ports?: ContainerPortMapping[];
    memoryInMegabytes: number;
    cpus: number;
    binds?: string[];
    labels?: Record<string, string>;
    cmd?: string[];
};

export interface CreateNotebookRequest {
    _id?: string;
    teamId: string;
    title: string;
    notebookPath: string;
    trajectories: string[];
    createdBy: string;
    content?: Record<string, unknown>;
};

export interface UpdateNotebookRequest {
    title?: string;
    content?: Record<string, unknown>;
    lastOpenedAt?: string;
};

export interface CreateNotebookSessionResponse {
    jupyter: {
        internalPath: string;
        url: string;
        ready: boolean;
    };
};

export interface ObjectUploadRequest {
    bucket: ObjectBucketName;
    objectKey: string;
    content: string;
    encoding?: TextEncoding;
    metadata?: Record<string, string>;
};

export interface PluginSyncRequest {
    pluginId: string;
    objectKey: string;
};

export interface AnalysisQueueJobPayload {
    jobId: string;
    teamId: string;
    sessionId?: string;
    status: string;
    queueType: string;
    maxRetries?: number;
    metadata?: Record<string, unknown>;
    completedAt?: string;
    error?: string;
    startTime?: string;
    progress?: number;
    message?: string;
    workerId?: number;
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

export interface AnalysisJobExecutionData {
    binaryObjectPath: string;
    arguments: string;
    pluginId: string;
    trajectoryId: string;
    analysisId: string;
    teamClusterId?: string;
    exposures: AnalysisExposureDefinition[];
    forEachNodeId: string;
    nodeOutputSnapshots: Record<string, Record<string, unknown>>;
};

export interface AnalysisStartRequest {
    analysisId: string;
    pluginId: string;
    teamId: string;
    teamClusterId: string;
    trajectoryId: string;
    trajectoryFrames: Array<{ timestep: number; natoms: number; simulationCell: string; }>;
    workflow: WorkflowDefinition;
    config: Record<string, unknown>;
    selectedFrameOnly?: boolean;
    timestep?: number;
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
};
