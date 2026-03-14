import type { VoltCloudConnection } from './VoltCloudConnection';

export interface DaemonJobReporterService {
    reportJobCompletion(input: {
        jobId: string;
        analysisId: string;
        teamId: string;
        timestep?: number;
        success: boolean;
        error?: string;
    }): Promise<void>;
};

export const createDaemonJobReporterService = (voltCloudConnection: VoltCloudConnection): DaemonJobReporterService => ({
    async reportJobCompletion(input) {
        await voltCloudConnection.sendServerCommand('analysis.job-complete', {
            teamClusterId: voltCloudConnection.getTeamClusterId(),
            daemonPassword: voltCloudConnection.getDaemonPassword(),
            ...input
        });
    }
});
