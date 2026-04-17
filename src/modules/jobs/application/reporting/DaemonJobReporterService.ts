import type { TeamClusterDaemonExecutionLogSegment, TeamClusterDaemonServerEventMessage } from '@/contracts';

export type RasterJobStatus = 'running' | 'completed' | 'failed';
export type GlbJobStatus = 'running' | 'completed' | 'failed';
export type SshImportJobStatus = 'running' | 'completed' | 'failed';

interface ReportJobCompletionInput {
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    timestep?: number;
    success: boolean;
    error?: string;
};

interface ReportAnalysisJobStatusInput {
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    status: 'running' | 'completed' | 'failed';
    error?: string;
};

interface ReportRasterJobStatusInput {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: RasterJobStatus;
    error?: string;
};

interface ReportGlbJobStatusInput {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: GlbJobStatus;
    error?: string;
};

interface ReportSshImportJobStatusInput {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    status: SshImportJobStatus;
    error?: string;
};

interface ReportArtifactUploadJobStatusInput {
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: 'queued' | 'running' | 'completed' | 'failed';
    error?: string;
};

interface ReportAnalysisLogChunkInput {
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    segments: TeamClusterDaemonExecutionLogSegment[];
};

interface ReportDebugLogChunkInput {
    sessionId: string;
    nodeId: string;
    segments: TeamClusterDaemonExecutionLogSegment[];
};

export interface DaemonJobReporterService {
    reportJobCompletion(input: ReportJobCompletionInput): Promise<void>;
    reportAnalysisJobStatus(input: ReportAnalysisJobStatusInput): Promise<void>;
    reportAnalysisLogChunk(input: ReportAnalysisLogChunkInput): Promise<void>;
    reportDebugLogChunk(input: ReportDebugLogChunkInput): Promise<void>;
    reportRasterJobStatus(input: ReportRasterJobStatusInput): Promise<void>;
    reportGlbJobStatus(input: ReportGlbJobStatusInput): Promise<void>;
    reportSshImportJobStatus(input: ReportSshImportJobStatusInput): Promise<void>;
    reportArtifactUploadJobStatus(input: ReportArtifactUploadJobStatusInput): Promise<void>;
};

interface DaemonEventPublisher {
    emitBufferedMessage(message: TeamClusterDaemonServerEventMessage, options?: { dedupeKey?: string }): void;
    emitMessage(message: TeamClusterDaemonServerEventMessage): void;
    getTeamClusterId(): string;
    getDaemonPassword(): string;
}

export const createDaemonJobReporterService = (voltCloudConnection: DaemonEventPublisher): DaemonJobReporterService => {
    const teamClusterId = voltCloudConnection.getTeamClusterId();
    const daemonPassword = voltCloudConnection.getDaemonPassword();
    const emitBufferedWithAuth = (type: TeamClusterDaemonServerEventMessage['type'], input: object, dedupeKey: string): void => {
        voltCloudConnection.emitBufferedMessage({
            type,
            teamClusterId,
            daemonPassword,
            ...(input as Record<string, unknown>)
        } as unknown as TeamClusterDaemonServerEventMessage, { dedupeKey });
    };
    const emitWithAuth = (type: TeamClusterDaemonServerEventMessage['type'], input: object): void => {
        voltCloudConnection.emitMessage({
            type,
            teamClusterId,
            daemonPassword,
            ...(input as Record<string, unknown>)
        } as never);
    };
    const hasSegments = (segments: TeamClusterDaemonExecutionLogSegment[]): boolean => segments.length > 0;

    return {
        async reportJobCompletion(input) {
            emitBufferedWithAuth(
                'analysis-job-completion',
                input,
                `analysis.job-completion:${input.jobId}:${input.success ? 'completed' : 'failed'}:${input.timestep ?? 'none'}`
            );
        },

        async reportAnalysisJobStatus(input) {
            emitBufferedWithAuth(
                'analysis-job-status',
                input,
                `analysis.job-status:${input.jobId}:${input.status}:${input.timestep ?? 'none'}`
            );
        },

        async reportAnalysisLogChunk(input) {
            if (!hasSegments(input.segments)) return;
            emitWithAuth('analysis-log-chunk', input);
        },

        async reportDebugLogChunk(input) {
            if (!hasSegments(input.segments)) return;
            emitWithAuth('debug-log-chunk', input);
        },

        async reportRasterJobStatus(input) {
            emitBufferedWithAuth(
                'trajectory-raster-job-status',
                input,
                `trajectory.raster-job-status:${input.jobId}:${input.status}:${input.timestep ?? 'none'}`
            );
        },

        async reportGlbJobStatus(input) {
            emitBufferedWithAuth(
                'trajectory-glb-job-status',
                input,
                `trajectory.glb-job-status:${input.jobId}:${input.status}:${input.timestep ?? 'none'}`
            );
        },

        async reportSshImportJobStatus(input) {
            emitBufferedWithAuth('ssh-import-job-status', input, `ssh-import.job-status:${input.jobId}:${input.status}`);
        },

        async reportArtifactUploadJobStatus(input) {
            emitBufferedWithAuth('artifact-upload-job-status', input, `artifact-upload.job-status:${input.jobId}:${input.status}`);
        }
    };
};
