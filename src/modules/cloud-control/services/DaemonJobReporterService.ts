import type { VoltCloudConnection } from './VoltCloudConnection';

export type RasterJobStatus = 'running' | 'completed' | 'failed';

export interface ReportJobCompletionInput {
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    timestep?: number;
    success: boolean;
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

export interface DaemonJobReporterService {
    reportJobCompletion(input: ReportJobCompletionInput): Promise<void>;
    reportRasterJobStatus(input: ReportRasterJobStatusInput): Promise<void>;
};

export const createDaemonJobReporterService = (voltCloudConnection: VoltCloudConnection): DaemonJobReporterService => ({
    async reportJobCompletion(input) {
        await voltCloudConnection.sendServerCommand('analysis.job-complete', {
            teamClusterId: voltCloudConnection.getTeamClusterId(),
            daemonPassword: voltCloudConnection.getDaemonPassword(),
            ...input
        });
    },

    async reportRasterJobStatus(input) {
        await voltCloudConnection.sendServerCommand('trajectory.raster-job-status', {
            teamClusterId: voltCloudConnection.getTeamClusterId(),
            daemonPassword: voltCloudConnection.getDaemonPassword(),
            ...input
        });
    }
});
