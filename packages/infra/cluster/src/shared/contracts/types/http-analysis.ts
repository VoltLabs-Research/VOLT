import type { IExportData } from '@volt/contracts/modules/plugin/workflow';
import type { WorkflowValueMap } from '@shared/contracts/types/workflow.types';
import type { DaemonTraceContext } from '@shared/observability/daemon-instrumentation';
import { EntrypointType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflow } from '@volt/contracts/modules/plugin/workflow';
import type { DaemonJobIdentity } from '@volt/contracts/modules/cluster/daemon-events';
import type {
    AnalysisStartTransportRequest,
    AnalysisStartRequest,
    PipelineStartTransportRequest,
    PipelineStartRequest,
    NestedPluginDefinition,
    PluginReferenceExecutionRequest,
    TrajectoryFrame
} from '@volt/contracts/modules/analysis/daemon';

type WithTrace<T> = T & { traceContext?: DaemonTraceContext };

export type AnalysisValueMap = Record<string, unknown>;

interface AnalysisNodeOutputSnapshots {
    [nodeId: string]: WorkflowValueMap;
}

export interface AnalysisExposureDefinition {
    nodeId: string;
    name: string;
    results: string;
    id?: string;
    export?: IExportData;
}

export interface AnalysisExecutionDataReference {
    key: string;
    storedAt: string;
    ttlSeconds: number;
}

interface AnalysisEntrypointSnapshot {
    binaryObjectPath: string;
    ownerClusterId?: string;
    arguments: string;
    type: EntrypointType;
    requirementsFile?: string;
    entrypointScript?: string;
}

export interface AnalysisExecutionIdentity extends Omit<DaemonJobIdentity, 'jobId'> {
    pluginId: string;
    trajectoryId: string;
    analysisId: string;
    computeClusterId?: string;
    storageClusterId?: string;
}

interface AnalysisWorkflowSnapshot {
    definition: IWorkflow;
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

export interface AnalysisQueueJobPayload<TMetadata = AnalysisJobMetadata> extends DaemonJobIdentity {
    sessionId?: string;
    status: string;
    queueType: string;
    name: string;
    metadata?: TMetadata;
    error?: string;
    startTime?: string;
    message?: string;
    workerId?: number;
    executionDataReference?: AnalysisExecutionDataReference;
    createdAt: string;
    updatedAt: string;
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

export type PipelineStartTransportPayload = WithTrace<PipelineStartTransportRequest>;
export type PipelineStartRequestWithTrace = WithTrace<PipelineStartRequest>;

export interface PipelinePlannedStage {
    kind: 'plugin' | 'slice' | 'expression';
    analysisId?: string;
    pluginId?: string;
    pluginDisplayName?: string;
    executionDataReference?: AnalysisExecutionDataReference;
    cacheHit?: boolean;
    cacheSourceAnalysisId?: string;
    sharedExposureIds?: string[];
    config?: AnalysisValueMap;
}

export interface PipelineQueueJobPayload extends DaemonJobIdentity {
    status: string;
    queueType: string;
    name: string;
    trajectoryId: string;
    storageClusterId?: string;
    timestep: number;
    stages: PipelinePlannedStage[];
    traceContext?: Record<string, string>;
    createdAt: string;
    updatedAt: string;
}
