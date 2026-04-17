import type { RuntimeProgressEvent } from '@voltstack/daemon-cluster-client';
import type { TeamClusterServiceExposure } from '@/core/runtime/contracts/serviceExposure';

export interface TeamClusterDaemonExposureSnapshotPayload {
    type: 'exposure-snapshot';
    exposures: TeamClusterServiceExposure[];
};

export interface TeamClusterDaemonRuntimeProgressPayload extends Pick<
    RuntimeProgressEvent,
    'action' | 'stage' | 'timestamp' | 'payload'
> {
    type: 'runtime-progress';
};

interface TeamClusterDaemonAuthenticatedPayload {
    teamClusterId: string;
    daemonPassword: string;
};

interface TeamClusterDaemonJobPayload extends TeamClusterDaemonAuthenticatedPayload {
    jobId: string;
    teamId: string;
};

interface TeamClusterDaemonAnalysisJobPayload extends TeamClusterDaemonJobPayload {
    name: string;
    analysisId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
};

interface TeamClusterDaemonTrajectoryJobPayload extends TeamClusterDaemonJobPayload {
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
};

interface TeamClusterDaemonErrorPayload {
    error?: string;
};

type TeamClusterDaemonJobStatus = 'running' | 'completed' | 'failed';

interface TeamClusterDaemonStatusPayload<TStatus extends string> extends TeamClusterDaemonErrorPayload {
    status: TStatus;
};

export interface TeamClusterDaemonAnalysisJobCompletionEventPayload
    extends TeamClusterDaemonAnalysisJobPayload, TeamClusterDaemonErrorPayload {
    type: 'analysis-job-completion';
    success: boolean;
};

export interface TeamClusterDaemonAnalysisJobStatusEventPayload
    extends TeamClusterDaemonAnalysisJobPayload, TeamClusterDaemonStatusPayload<TeamClusterDaemonJobStatus> {
    type: 'analysis-job-status';
};

export interface TeamClusterDaemonRasterJobStatusEventPayload
    extends TeamClusterDaemonTrajectoryJobPayload, TeamClusterDaemonStatusPayload<TeamClusterDaemonJobStatus> {
    type: 'trajectory-raster-job-status';
};

export interface TeamClusterDaemonGlbJobStatusEventPayload
    extends TeamClusterDaemonTrajectoryJobPayload, TeamClusterDaemonStatusPayload<TeamClusterDaemonJobStatus> {
    type: 'trajectory-glb-job-status';
};

export interface TeamClusterDaemonSshImportJobStatusEventPayload
    extends TeamClusterDaemonJobPayload, TeamClusterDaemonStatusPayload<TeamClusterDaemonJobStatus> {
    type: 'ssh-import-job-status';
    trajectoryId: string;
    trajectoryName?: string;
};

export interface TeamClusterDaemonArtifactUploadJobStatusEventPayload
    extends TeamClusterDaemonTrajectoryJobPayload,
        TeamClusterDaemonStatusPayload<'queued' | TeamClusterDaemonJobStatus> {
    type: 'artifact-upload-job-status';
    analysisId: string;
};

export interface TeamClusterDaemonExecutionLogSegment {
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
    occurredAt: string;
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    pluginId?: string;
    executionPath?: string[];
};

export interface TeamClusterDaemonAnalysisLogChunkEventPayload extends TeamClusterDaemonAuthenticatedPayload {
    type: 'analysis-log-chunk';
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    segments: TeamClusterDaemonExecutionLogSegment[];
};

export interface TeamClusterDaemonDebugLogChunkEventPayload extends TeamClusterDaemonAuthenticatedPayload {
    type: 'debug-log-chunk';
    sessionId: string;
    nodeId: string;
    segments: TeamClusterDaemonExecutionLogSegment[];
};

export interface TeamClusterDaemonSceneArtifactUpsertBatchItem {
    trajectory: string;
    storageClusterId: string;
    analysis?: string;
    plugin?: string;
    sourceType: 'color-coding' | 'particle-filter' | 'plugin-exposure';
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: Record<string, unknown>;
    displayName: string;
    status: 'ready' | 'failed';
    metadata?: Record<string, unknown>;
};

export interface TeamClusterDaemonSceneArtifactUpsertBatchEventPayload extends TeamClusterDaemonAuthenticatedPayload {
    type: 'trajectory-scene-artifact-upsert-batch';
    items: TeamClusterDaemonSceneArtifactUpsertBatchItem[];
};

export type TeamClusterDaemonServerEventMessage =
    | TeamClusterDaemonAnalysisJobCompletionEventPayload
    | TeamClusterDaemonAnalysisJobStatusEventPayload
    | TeamClusterDaemonAnalysisLogChunkEventPayload
    | TeamClusterDaemonDebugLogChunkEventPayload
    | TeamClusterDaemonRasterJobStatusEventPayload
    | TeamClusterDaemonGlbJobStatusEventPayload
    | TeamClusterDaemonSshImportJobStatusEventPayload
    | TeamClusterDaemonArtifactUploadJobStatusEventPayload
    | TeamClusterDaemonSceneArtifactUpsertBatchEventPayload;
