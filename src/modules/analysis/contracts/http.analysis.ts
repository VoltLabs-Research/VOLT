import type { EntrypointType } from '@/core/runtime/contracts/http.runtime';
import type { NestedPluginDefinition, PluginReferenceExecutionRequest, TrajectoryDumpDescriptor, TrajectoryFrame, WorkflowDefinition } from '@/modules/analysis/contracts/http.workflow';

export interface PluginSyncRequest {
    pluginId: string;
    objectKey: string;
    ownerClusterId?: string;
    expectedHash?: string;
};

interface ResolvedObjectRef {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    expectedHash?: string;
    sizeBytes?: number;
}

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

export interface AnalysisExecutionDataReference {
    key: string;
    storedAt: string;
    ttlSeconds: number;
};

export interface AnalysisJobExecutionData {
    binaryObjectPath: string;
    entrypointType?: EntrypointType;
    arguments: string;
    timeoutMs?: number;
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

interface TrajectoryQueueJobPayload extends Record<string, unknown> {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep: number;
    status: string;
    queueType: string;
    metadata?: Record<string, unknown>;
    error?: string;
    createdAt: string;
    updatedAt: string;
};

interface TrajectoryQueueRequest {
    trajectoryId: string;
    teamId: string;
    trajectoryName?: string;
    storageClusterId?: string;
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

export interface QueuedJobNotification {
    jobId: string;
    teamId: string;
    name?: string;
    timestep?: number;
    trajectoryId?: string;
    trajectoryName?: string;
    analysisId?: string;
    queueType: string;
};

interface TrajectoryQueueResponse {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    jobs?: QueuedJobNotification[];
};

export interface RasterQueueJobPayload extends TrajectoryQueueJobPayload {
    modelObjectKey: string;
    modelOwnerClusterId?: string;
    outputObjectKey: string;
    outputOwnerClusterId?: string;
};

export interface RasterizeTrajectoryRequest extends TrajectoryQueueRequest {
    config?: Record<string, unknown>;
};

export interface RasterizeTrajectoryResponse extends TrajectoryQueueResponse {
    alreadyRasterizedJobs: number;
    jobs: QueuedJobNotification[];
};

export interface GlbConversionQueueJobPayload extends TrajectoryQueueJobPayload {
    objectKey: string;
    ownerClusterId?: string;
};

export interface EnqueuePreprocessingFrameDescriptor {
    timestep: number;
    objectKey: string;
    ownerClusterId?: string;
};

export interface EnqueuePreprocessingRequest extends TrajectoryQueueRequest {
    frames: EnqueuePreprocessingFrameDescriptor[];
};

export interface EnqueuePreprocessingResponse extends TrajectoryQueueResponse {};

export interface AnalysisStartResponse {
    queued: boolean;
    totalJobs: number;
    jobs: QueuedJobNotification[];
};
