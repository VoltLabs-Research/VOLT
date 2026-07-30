import { JobStatus } from '@shared/contracts/types';

import type {
    AnalysisStageStatus,
    AnalysisStageType
} from '@shared/contracts/types';

type RasterJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type GlbJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type ArtifactUploadJobStatus = JobStatus.Queued | JobStatus.Running | JobStatus.Completed | JobStatus.Failed;

export interface ProcessDaemonAnalysisJobCompletionInput {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    timestep?: number;
    success: boolean;
    error?: string;
}

export interface ProcessDaemonAnalysisJobStatusInput {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

export interface ProcessDaemonAnalysisStageStatusInput {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
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

export interface ProcessDaemonRasterJobStatusInput {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

interface ValidProcessDaemonRasterJobStatusInput extends ProcessDaemonRasterJobStatusInput {
    status: RasterJobStatus;
}

export interface ProcessDaemonGlbJobStatusInput {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

interface ValidProcessDaemonGlbJobStatusInput extends ProcessDaemonGlbJobStatusInput {
    status: GlbJobStatus;
}

export interface ProcessDaemonArtifactUploadJobStatusInput {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

interface ValidProcessDaemonArtifactUploadJobStatusInput extends ProcessDaemonArtifactUploadJobStatusInput {
    status: ArtifactUploadJobStatus;
}

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

const GLB_JOB_ID_PREFIXES = ['trajectory-glb:', 'trajectory-frame:'];
const ARTIFACT_UPLOAD_JOB_ID_PREFIX = 'artifact-upload-';

const isGlbJobId = (jobId: string): boolean => (
    GLB_JOB_ID_PREFIXES.some((prefix) => jobId.startsWith(prefix))
);

const isArtifactUploadJobId = (jobId: string): boolean => jobId.startsWith(ARTIFACT_UPLOAD_JOB_ID_PREFIX);

const isValidJobStatus = (status: JobStatus): status is RasterJobStatus => (
    status === JobStatus.Running || status === JobStatus.Completed || status === JobStatus.Failed
);

const isValidArtifactUploadJobStatus = (status: JobStatus): status is ArtifactUploadJobStatus => (
    status === JobStatus.Queued
    || status === JobStatus.Running
    || status === JobStatus.Completed
    || status === JobStatus.Failed
);

const hasAnalysisJobCompletionFields = (input: ProcessDaemonJobCompletionInput): boolean => (
    'name' in input || 'success' in input
);

const hasJobStatusFields = (
    input: ProcessDaemonJobCompletionInput
): input is ProcessDaemonRasterJobStatusInput => (
    'jobId' in input && 'trajectoryId' in input && 'status' in input
);

export const isAnalysisJobStatusInput = (
    input: ProcessDaemonJobCompletionInput
): input is ProcessDaemonAnalysisJobStatusInput => (
    'analysisId' in input && 'name' in input && 'status' in input && !('success' in input)
);

export const isAnalysisStageStatusInput = (
    input: ProcessDaemonJobCompletionInput
): input is ProcessDaemonAnalysisStageStatusInput => (
    'analysisId' in input
    && 'name' in input
    && 'stageKey' in input
    && 'stageStatus' in input
    && 'stageType' in input
);

export const isAnalysisJobCompletionInput = (
    input: ProcessDaemonJobCompletionInput
): input is ProcessDaemonAnalysisJobCompletionInput => (
    'analysisId' in input && 'name' in input && 'success' in input && !hasJobStatusFields(input)
);

export const isGlbJobStatusInput = (
    input: ProcessDaemonJobCompletionInput
): input is ValidProcessDaemonGlbJobStatusInput => (
    hasJobStatusFields(input)
    && !hasAnalysisJobCompletionFields(input)
    && isGlbJobId(input.jobId)
    && isValidJobStatus(input.status)
);

export const isArtifactUploadJobStatusInput = (
    input: ProcessDaemonJobCompletionInput
): input is ValidProcessDaemonArtifactUploadJobStatusInput => (
    hasJobStatusFields(input)
    && !hasAnalysisJobCompletionFields(input)
    && isArtifactUploadJobId(input.jobId)
    && isValidArtifactUploadJobStatus(input.status)
);

export const isRasterJobStatusInput = (
    input: ProcessDaemonJobCompletionInput
): input is ValidProcessDaemonRasterJobStatusInput => (
    hasJobStatusFields(input)
    && !hasAnalysisJobCompletionFields(input)
    && !isGlbJobId(input.jobId)
    && !isArtifactUploadJobId(input.jobId)
    && isValidJobStatus(input.status)
);
