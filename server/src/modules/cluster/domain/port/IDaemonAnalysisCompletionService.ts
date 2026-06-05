import type { JobStatus } from '@modules/jobs/domain/entities/Job';
import type { AnalysisStageStatus, AnalysisStageType } from '@modules/analysis/domain/entities/Analysis';

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

export interface IDaemonAnalysisCompletionService {
    initializeSession(analysisId: string, totalJobs: number, teamId: string, trajectoryId?: string): Promise<void>;
    initializeGlbSession(trajectoryId: string, totalJobs: number, teamId: string): Promise<void>;
    handleJobsQueued(jobs: QueuedJobNotification[], teamId: string, teamClusterId: string): Promise<void>;
    handleQueuedJobs(jobs: QueuedDaemonJobNotification[], cleanupScope: string, teamClusterId: string): Promise<void>;
    handleJobCompletion(input: DaemonJobCompletionInput): Promise<void>;
    handleAnalysisJobStatus(input: DaemonAnalysisJobStatusInput): Promise<void>;
    handleAnalysisStageStatus(input: DaemonAnalysisStageStatusInput): Promise<void>;
    handleRasterJobStatus(input: DaemonRasterJobStatusInput): Promise<void>;
    handleGlbJobStatus(input: DaemonGlbJobStatusInput): Promise<void>;
    handleArtifactUploadJobStatus(input: DaemonArtifactUploadJobStatusInput): Promise<void>;
}
