import type { RuntimeLifecycleEvent } from './events';
import type { MetricsSnapshot } from './metrics';

export interface DaemonHealthResponse {
    ok: boolean;
    ready: boolean;
    metrics: MetricsSnapshot;
    latestLifecycleEvent: RuntimeLifecycleEvent | null;
};

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

export interface UpdateContainerRequest {
    action: ContainerAction;
};

export interface WriteContainerFileRequest {
    path: string;
    content: string;
};

export interface CreateNotebookRequest {
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

export interface CreateNotebookSessionRequest {
    requestedBy: string;
};

export interface NotebookSessionJupyterInfo {
    url: string;
    ready: boolean;
};

export interface CreateNotebookSessionResponse {
    jupyter: NotebookSessionJupyterInfo;
};

export interface QueueDispatchRequest {
    queueName: string;
    payload: Record<string, unknown>;
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

export interface AnalysisStartRequest {
    analysisId: string;
    payload: {
        teamId: string;
        trajectoryId: string;
        jobs: AnalysisQueueJobPayload[];
    };
};

export interface TrajectoryPreprocessRequest {
    trajectoryId: string;
    payload: Record<string, unknown>;
};

export interface NativeTrajectoryPreprocessRequest {
    trajectoryId: string;
    timestep: number;
    objectKey?: string;
};

export interface NativeTrajectoryMetadataRequest {
    trajectoryId: string;
    timestep: number;
    objectKey?: string;
};

export interface NativeTrajectoryPropertyStatsRequest extends NativeTrajectoryMetadataRequest {
    property: string;
};

export interface NativeTrajectoryUniqueValuesRequest extends NativeTrajectoryPropertyStatsRequest {
    maxValues?: number;
};

export interface NativeTrajectoryAtomsPageRequest extends NativeTrajectoryMetadataRequest {
    page: number;
    limit: number;
};

export interface NativeTrajectoryFilterPreviewRequest extends NativeTrajectoryMetadataRequest {
    property: string;
    operator: string;
    value: number;
    externalValuesBase64?: string;
};

export interface NativeTrajectoryColorModelRequest extends NativeTrajectoryPropertyStatsRequest {
    objectKey: string;
    startValue: number;
    endValue: number;
    gradient: string;
    externalValuesBase64?: string;
};

export interface NativeTrajectoryParticleFilterModelRequest extends NativeTrajectoryMetadataRequest {
    objectKey: string;
    action: 'delete' | 'highlight';
    maskBase64: string;
};

export interface UninstallRequest {
    reason?: string;
};
