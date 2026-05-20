import type { EntrypointType } from '@/core/runtime/contracts/http-runtime';
import type { NestedPluginDefinition, PluginReferenceExecutionRequest, TrajectoryFrame, WorkflowDefinition } from '@/modules/analysis/contracts/http-workflow';
import type { WorkflowValueMap } from '@/modules/analysis/contracts/workflow.types';
import type { DaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import type { JobIdentity } from '@/support/contracts/job-identity';

export type WithTrace<T> = T & { traceContext?: DaemonTraceContext };

export interface AnalysisValueMap {
    [key: string]: AnalysisValue;
}

type AnalysisValue =
    | AnalysisValueMap
    | AnalysisValue[]
    | boolean
    | null
    | number
    | string
    | undefined

export interface PluginSyncRequest {
    pluginId: string;
    objectKey: string;
    ownerClusterId: string;
    expectedHash?: string;
}

export interface PluginWarmupRequest {
    pluginId: string;
    binaryObjectPath: string;
    ownerClusterId?: string;
    requirementsFile: string;
    entrypointScript?: string;
    expectedHash?: string;
}

export interface PluginWarmupResponse {
    queued: boolean;
    jobId: string;
}

interface ResolvedObjectRef {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    expectedHash?: string;
    sizeBytes?: number;
}

interface AnalysisExposureExportDefinition {
    exporter: string;
    type: string;
    options?: AnalysisValueMap;
}

interface AnalysisNodeOutputSnapshots {
    [nodeId: string]: WorkflowValueMap;
}

export interface AnalysisExposureDefinition {
    nodeId: string;
    name: string;
    results: string;
    export?: AnalysisExposureExportDefinition;
}

export interface DaemonAnalysisDocument {
    _id: string;
    plugin?: string;
    pluginDisplayName: string;
    computeClusterId?: string;
    storageClusterId?: string;
    config?: AnalysisValueMap;
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
}

export interface AnalysisExecutionDataReference {
    key: string;
    storedAt: string;
    ttlSeconds: number;
}

export interface AnalysisEntrypointSnapshot {
    binaryObjectPath: string;
    ownerClusterId?: string;
    arguments: string;
    type: EntrypointType;
    requirementsFile?: string;
    entrypointScript?: string;
    binaryRef?: ResolvedObjectRef;
}

export interface AnalysisExecutionIdentity extends Omit<JobIdentity, 'jobId'> {
    pluginId: string;
    trajectoryId: string;
    analysisId: string;
    computeClusterId?: string;
    storageClusterId?: string;
}

export interface AnalysisWorkflowSnapshot {
    definition: WorkflowDefinition;
    nestedPlugins: NestedPluginDefinition[];
    pluginReferenceExecutions?: PluginReferenceExecutionRequest[];
    exposures: AnalysisExposureDefinition[];
    forEachNodeId?: string;
    nodeOutputSnapshots: AnalysisNodeOutputSnapshots;
}

export interface AnalysisJobExecutionData {
    entrypoint: AnalysisEntrypointSnapshot;
    identity: AnalysisExecutionIdentity;
    workflow: AnalysisWorkflowSnapshot;
    trajectoryFrames: TrajectoryFrame[];
    traceContext?: Record<string, string>;
}

export interface PlannedExecutionItem {
    timestep?: number;
    path?: string;
    frame?: number;
}

export interface AnalysisJobMetadata {
    trajectoryId: string;
    analysisId: string;
    name: string;
    config: AnalysisValueMap;
    plugin: string;
    totalItems: number;
    traceContext?: Record<string, string>;
    inputFile?: string;
    timestep?: number;
    itemIndex?: number;
    forEachItem?: PlannedExecutionItem;
    forEachIndex?: number;
}

export interface AnalysisQueueJobPayload<TMetadata = AnalysisJobMetadata> extends JobIdentity {
    sessionId?: string;
    status: string;
    queueType: string;
    name: string;
    maxRetries?: number;
    metadata?: TMetadata;
    completedAt?: string;
    error?: string;
    startTime?: string;
    progress?: number;
    message?: string;
    workerId?: number;
    executionDataReference?: AnalysisExecutionDataReference;
    createdAt: string;
    updatedAt: string;
}

export interface AnalysisStartTransportRequest {
    analysis: DaemonAnalysisDocument;
    analysisId: string;
    pluginId: string;
    pluginDisplayName: string;
    teamId: string;
    teamClusterId: string;
    trajectoryId: string;
    trajectoryFramesCompressed: string;
    workflowCompressed: string;
    nestedPluginsCompressed: string;
    pluginReferenceExecutionsCompressed: string;
    config: AnalysisValueMap;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
}

export interface AnalysisStartRequest extends AnalysisStartTransportRequest {
    trajectoryFrames: TrajectoryFrame[];
    workflow: WorkflowDefinition;
    nestedPlugins: NestedPluginDefinition[];
    pluginReferenceExecutions: PluginReferenceExecutionRequest[];
}

export type AnalysisStartRequestWithTrace = WithTrace<AnalysisStartRequest>;
export type AnalysisStartTransportPayload = WithTrace<AnalysisStartTransportRequest>;

export interface RetryJobsRequest {
    jobIds: string[];
}

export interface RemoveRunningJobsRequest {
    jobIds: string[];
}

export interface AnalysisRuntimeCleanupRequest {
    analysisId: string;
    jobIds?: string[];
}

export interface RuntimeStateCleanupResponse {
    deletedKeys: number;
}

export interface JobsActionResponse {
    affectedJobs: number;
    affectedJobIds: string[];
}

export interface QueuedJobNotification extends JobIdentity {
    name?: string;
    queueType: string;
}

export interface AnalysisStartResponse {
    queued: boolean;
    totalJobs: number;
    jobs: QueuedJobNotification[];
}
