import type { EntrypointType } from '@/core/runtime/contracts/http-runtime';
import type { NestedPluginDefinition, PluginReferenceExecutionRequest, TrajectoryDumpDescriptor, TrajectoryFrame, WorkflowDefinition } from '@/modules/analysis/contracts/http-workflow';
import type { WorkflowValueMap } from '@/modules/analysis/contracts/workflow.types';

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
    ownerClusterId?: string;
    expectedHash?: string;
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
    iterable?: string;
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
    arguments: string;
    type: EntrypointType;
    timeout?: number;
    requirementsFile?: string;
    entrypointScript?: string;
    binaryRef?: ResolvedObjectRef;
}

export interface AnalysisExecutionIdentity {
    pluginId: string;
    trajectoryId: string;
    analysisId: string;
    teamId: string;
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

export interface AnalysisBatchSnapshot {
    trajectoryDumps: TrajectoryDumpDescriptor[];
    contextNodeId?: string;
}

export interface AnalysisJobExecutionData {
    entrypoint: AnalysisEntrypointSnapshot;
    identity: AnalysisExecutionIdentity;
    workflow: AnalysisWorkflowSnapshot;
    trajectoryFrames: TrajectoryFrame[];
    batch?: AnalysisBatchSnapshot;
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
    batchMode?: true;
    inputFile?: string;
    timestep?: number;
    itemIndex?: number;
    forEachItem?: PlannedExecutionItem;
    forEachIndex?: number;
}

export interface AnalysisQueueJobPayload<TMetadata = AnalysisJobMetadata> {
    jobId: string;
    teamId: string;
    timestep?: number;
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
    executionData?: AnalysisJobExecutionData;
    executionDataCompressed?: string;
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
    trajectoryFrames?: TrajectoryFrame[];
    trajectoryFramesCompressed?: string;
    workflow?: WorkflowDefinition;
    workflowCompressed?: string;
    nestedPlugins?: NestedPluginDefinition[];
    nestedPluginsCompressed?: string;
    pluginReferenceExecutions?: PluginReferenceExecutionRequest[];
    pluginReferenceExecutionsCompressed?: string;
    config: AnalysisValueMap;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
}

export interface AnalysisStartRequest extends AnalysisStartTransportRequest {
    trajectoryFrames: TrajectoryFrame[];
    workflow: WorkflowDefinition;
    nestedPlugins: NestedPluginDefinition[];
}

export interface RetryJobsRequest {
    jobIds: string[];
}

export interface RemoveRunningJobsRequest {
    jobIds: string[];
}

export interface ClearJobsHistoryRequest {
    teamId: string;
    jobIds: string[];
}

export interface JobsActionResponse {
    affectedJobs: number;
}

export interface QueuedJobNotification {
    jobId: string;
    teamId: string;
    name?: string;
    timestep?: number;
    trajectoryId?: string;
    analysisId?: string;
    queueType: string;
}

export interface AnalysisStartResponse {
    queued: boolean;
    totalJobs: number;
    jobs: QueuedJobNotification[];
}
