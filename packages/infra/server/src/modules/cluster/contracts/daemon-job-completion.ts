import type { JobStatus } from '@volt/contracts/modules/jobs/domain';
import type { AnalysisStageStatus } from '@volt/contracts/modules/analysis/domain';
import type { AnalysisStageType } from '@shared/contracts/types/AnalysisProps';

export interface DaemonJobCompletionInput {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    name: string;
    analysisId: string;
    trajectoryId?: string;
    timestep?: number;
    success: boolean;
    error?: string;
}

export interface DaemonAnalysisJobStatusInput {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    name: string;
    analysisId: string;
    trajectoryId?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

export interface DaemonAnalysisStageStatusInput {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    name: string;
    analysisId: string;
    trajectoryId?: string;
    timestep?: number;
    stageKey: string;
    label: string;
    stageType: AnalysisStageType;
    stageStatus: AnalysisStageStatus;
    pluginId?: string;
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

export interface DaemonRasterJobStatusInput {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

export interface DaemonGlbJobStatusInput {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

export interface DaemonArtifactUploadJobStatusInput {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    analysisId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

export interface QueuedJobNotification {
    jobId: string;
    name: string;
    teamId: string;
    timestep: number;
    trajectoryId: string;
    trajectoryName?: string;
    analysisId: string;
    queueType: string;
}

export interface QueuedDaemonJobNotification {
    jobId: string;
    teamId: string;
    queueType: string;
    name?: string;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
}

type DaemonJobReport<TType extends string, TInput> = TInput & {
    type: TType;
    teamClusterId: string;
    daemonPassword: string;
};

export type ProcessDaemonAnalysisJobCompletionInput = DaemonJobReport<'analysis-job-completion', DaemonJobCompletionInput>;
export type ProcessDaemonAnalysisJobStatusInput = DaemonJobReport<'analysis-job-status', DaemonAnalysisJobStatusInput>;
export type ProcessDaemonAnalysisStageStatusInput = DaemonJobReport<'analysis-stage-status', DaemonAnalysisStageStatusInput>;
export type ProcessDaemonRasterJobStatusInput = DaemonJobReport<'trajectory-raster-job-status', DaemonRasterJobStatusInput>;
export type ProcessDaemonGlbJobStatusInput = DaemonJobReport<'trajectory-glb-job-status', DaemonGlbJobStatusInput>;
export type ProcessDaemonArtifactUploadJobStatusInput = DaemonJobReport<'artifact-upload-job-status', DaemonArtifactUploadJobStatusInput>;

export type ProcessDaemonJobCompletionInput =
    | ProcessDaemonAnalysisJobCompletionInput
    | ProcessDaemonAnalysisJobStatusInput
    | ProcessDaemonAnalysisStageStatusInput
    | ProcessDaemonRasterJobStatusInput
    | ProcessDaemonGlbJobStatusInput
    | ProcessDaemonArtifactUploadJobStatusInput;

export interface ProcessDaemonJobCompletionOutput {
    acknowledged: boolean;
}
