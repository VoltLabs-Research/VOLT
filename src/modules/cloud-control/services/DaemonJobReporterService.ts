import type { VoltCloudConnection } from './VoltCloudConnection';

export type RasterJobStatus = 'running' | 'completed' | 'failed';
export type GlbJobStatus = 'running' | 'completed' | 'failed';
export type AnalysisJobStatus = 'running' | 'completed' | 'failed';
export type SshImportJobStatus = 'running' | 'completed' | 'failed';

export interface ReportJobCompletionInput {
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    timestep?: number;
    success: boolean;
    error?: string;
};

export interface ReportAnalysisJobStatusInput {
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    status: AnalysisJobStatus;
    error?: string;
};

export interface ReportRasterJobStatusInput {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: RasterJobStatus;
    error?: string;
};

export interface ReportGlbJobStatusInput {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: GlbJobStatus;
    error?: string;
};

export interface ReportSshImportJobStatusInput {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    status: SshImportJobStatus;
    error?: string;
};

export interface DaemonJobReporterService {
    reportJobCompletion(input: ReportJobCompletionInput): Promise<void>;
    reportAnalysisJobStatus(input: ReportAnalysisJobStatusInput): Promise<void>;
    reportRasterJobStatus(input: ReportRasterJobStatusInput): Promise<void>;
    reportGlbJobStatus(input: ReportGlbJobStatusInput): Promise<void>;
    reportSshImportJobStatus(input: ReportSshImportJobStatusInput): Promise<void>;
};

export const createDaemonJobReporterService = (voltCloudConnection: VoltCloudConnection): DaemonJobReporterService => ({
    async reportJobCompletion(input) {
        voltCloudConnection.emitBufferedMessage({
            type: 'analysis-job-completion',
            teamClusterId: voltCloudConnection.getTeamClusterId(),
            daemonPassword: voltCloudConnection.getDaemonPassword(),
            ...input
        }, {
            dedupeKey: `analysis.job-completion:${input.jobId}:${input.success ? 'completed' : 'failed'}:${input.timestep ?? 'none'}`
        });
    },

    async reportAnalysisJobStatus(input) {
        voltCloudConnection.emitBufferedMessage({
            type: 'analysis-job-status',
            teamClusterId: voltCloudConnection.getTeamClusterId(),
            daemonPassword: voltCloudConnection.getDaemonPassword(),
            ...input
        }, {
            dedupeKey: `analysis.job-status:${input.jobId}:${input.status}:${input.timestep ?? 'none'}`
        });
    },

    async reportRasterJobStatus(input) {
        voltCloudConnection.emitBufferedMessage({
            type: 'trajectory-raster-job-status',
            teamClusterId: voltCloudConnection.getTeamClusterId(),
            daemonPassword: voltCloudConnection.getDaemonPassword(),
            ...input
        }, {
            dedupeKey: `trajectory.raster-job-status:${input.jobId}:${input.status}:${input.timestep ?? 'none'}`
        });
    },

    async reportGlbJobStatus(input) {
        voltCloudConnection.emitBufferedMessage({
            type: 'trajectory-glb-job-status',
            teamClusterId: voltCloudConnection.getTeamClusterId(),
            daemonPassword: voltCloudConnection.getDaemonPassword(),
            ...input
        }, {
            dedupeKey: `trajectory.glb-job-status:${input.jobId}:${input.status}:${input.timestep ?? 'none'}`
        });
    },

    async reportSshImportJobStatus(input) {
        voltCloudConnection.emitBufferedMessage({
            type: 'ssh-import-job-status',
            teamClusterId: voltCloudConnection.getTeamClusterId(),
            daemonPassword: voltCloudConnection.getDaemonPassword(),
            ...input
        }, {
            dedupeKey: `ssh-import.job-status:${input.jobId}:${input.status}`
        });
    }
});
