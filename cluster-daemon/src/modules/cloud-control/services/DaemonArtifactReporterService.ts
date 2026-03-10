import type { VoltCloudConnection } from './VoltCloudConnection';

export type ArtifactSourceType = 'color-coding' | 'particle-filter' | 'plugin-exposure';
export type ArtifactStatus = 'ready' | 'failed';

export interface ReportArtifactInput {
    trajectory: string;
    teamCluster?: string;
    analysis?: string;
    plugin?: string;
    sourceType: ArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: Record<string, unknown>;
    displayName: string;
    status: ArtifactStatus;
    metadata?: Record<string, unknown>;
};

export interface DaemonArtifactReporterService {
    reportArtifact(input: ReportArtifactInput): Promise<void>;
};

export const createDaemonArtifactReporterService = (voltCloudConnection: VoltCloudConnection): DaemonArtifactReporterService => ({
    async reportArtifact(input) {
        await voltCloudConnection.sendServerCommand('trajectory.scene-artifact.upsert', {
            teamClusterId: voltCloudConnection.getTeamClusterId(),
            daemonPassword: voltCloudConnection.getDaemonPassword(),
            ...input
        });
    }
});
