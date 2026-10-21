import type { AnalysisStageKind, AnalysisStageStatus } from '../analysis/domain';
import type { JobStatus } from '../jobs/domain';
import type { SceneArtifactParams, SceneArtifactSourceType, SceneArtifactStatus } from '../trajectory/domain';

// Messages the daemon reports to the server over its event channel, plus the payloads of the
// streams it opens for large or chatty reports.

export interface DaemonIdentity{
    teamClusterId: string;
    daemonPassword: string;
}

type DaemonEvent<TType extends string, TPayload extends object> = DaemonIdentity & TPayload & { type: TType };

export interface DaemonJobIdentity{
    jobId: string;
    teamId: string;
    trajectoryId?: string;
    analysisId?: string;
    pluginId?: string;
    timestep?: number;
}

export type DaemonJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;

export interface AnalysisJobReport extends DaemonJobIdentity{
    analysisId: string;
    name: string;
}

export interface AnalysisStageStatusReport extends AnalysisJobReport{
    stageKey: string;
    label: string;
    stageType: AnalysisStageKind;
    stageStatus: AnalysisStageStatus;
    pluginDisplayName?: string;
    nodeId?: string;
    exposureId?: string;
    configHash?: string;
    cacheHit?: boolean;
    detail?: string;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
    producedArtifacts?: boolean;
}

export interface AnalysisProvenance{
    pluginName: string;
    pluginVersion: string;
    parameters: Record<string, unknown>;
    inputFrameContentHash: string;
    atomCount: number;
    frameIndex: number;
    trajectoryId: string;
    analysisId: string;
    teamId: string;
    coreToolkitVersion: string;
    rngSeed?: number;
    executedAt: string;
    executedBy: string;
    executionTimeMs: number;
    outputArtifactIds: string[];
}

export interface TrajectoryJobStatusReport extends DaemonJobIdentity{
    trajectoryId: string;
    status: DaemonJobStatus;
    error?: string;
}

export interface ArtifactUploadJobStatusReport extends TrajectoryJobStatusReport{
    analysisId: string;
}

export type AnalysisJobStatusEvent = DaemonEvent<'analysis-job-status', AnalysisJobReport & { status: JobStatus.Running }>;
export type AnalysisJobCompletionEvent = DaemonEvent<'analysis-job-completion', AnalysisJobReport & { success: boolean; error?: string }>;
export type AnalysisStageStatusEvent = DaemonEvent<'analysis-stage-status', AnalysisStageStatusReport>;
export type AnalysisProvenanceEvent = DaemonEvent<'analysis-provenance', AnalysisProvenance>;
export type RasterJobStatusEvent = DaemonEvent<'trajectory-raster-job-status', TrajectoryJobStatusReport>;
export type GlbJobStatusEvent = DaemonEvent<'trajectory-glb-job-status', TrajectoryJobStatusReport>;
export type ArtifactUploadJobStatusEvent = DaemonEvent<'artifact-upload-job-status', ArtifactUploadJobStatusReport>;

export type DaemonJobEvent =
    | AnalysisJobStatusEvent
    | AnalysisJobCompletionEvent
    | AnalysisStageStatusEvent
    | AnalysisProvenanceEvent
    | RasterJobStatusEvent
    | GlbJobStatusEvent
    | ArtifactUploadJobStatusEvent;

export interface ExecutionLogSegment{
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
    occurredAt: string;
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    pluginId?: string;
    executionPath?: string[];
}

// Large or chatty reports travel as reverse-channel streams whose stream id is the event type.
export const DAEMON_STREAM_ID = Object.freeze({
    AnalysisLogChunk: 'analysis-log-chunk',
    DebugLogChunk: 'debug-log-chunk',
    TrajectorySceneArtifactUpsertBatch: 'trajectory-scene-artifact-upsert-batch'
});

export interface AnalysisLogChunk{
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    segments: ExecutionLogSegment[];
}

export interface DebugLogChunk{
    sessionId: string;
    nodeId: string;
    segments: ExecutionLogSegment[];
}

export interface SceneArtifactUpsertItem{
    trajectory: string;
    storageClusterId: string;
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactParams;
    displayName: string;
    status: SceneArtifactStatus;
    metadata?: Record<string, unknown>;
}

export interface SceneArtifactUpsertBatch{
    items: SceneArtifactUpsertItem[];
}

// Jobs the daemon admitted to one of its queues, reported back so the server can track them.
export interface QueuedJobNotification extends DaemonJobIdentity{
    name?: string;
    queueType: string;
    trajectoryName?: string;
}

// Analysis and pipeline starts always report the analysis each queued job runs.
export interface QueuedAnalysisJobNotification extends QueuedJobNotification{
    analysisId: string;
}

export type AnalysisLogChunkEvent = DaemonEvent<typeof DAEMON_STREAM_ID.AnalysisLogChunk, AnalysisLogChunk>;
export type DebugLogChunkEvent = DaemonEvent<typeof DAEMON_STREAM_ID.DebugLogChunk, DebugLogChunk>;
export type SceneArtifactUpsertBatchEvent = DaemonEvent<typeof DAEMON_STREAM_ID.TrajectorySceneArtifactUpsertBatch, SceneArtifactUpsertBatch>;

export type DaemonStreamEvent = AnalysisLogChunkEvent | DebugLogChunkEvent | SceneArtifactUpsertBatchEvent;
