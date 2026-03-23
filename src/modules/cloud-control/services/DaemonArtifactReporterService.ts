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

const SCENE_ARTIFACT_BATCH_SIZE = 64;
const SCENE_ARTIFACT_BATCH_FLUSH_INTERVAL_MS = 250;

export const createDaemonArtifactReporterService = (voltCloudConnection: VoltCloudConnection): DaemonArtifactReporterService => {
    const pendingArtifacts = new Map<string, ReportArtifactInput>();
    let flushTimer: NodeJS.Timeout | null = null;

    const flushBatch = (): void => {
        flushTimer = null;

        if (pendingArtifacts.size === 0) {
            return;
        }

        const batch = Array.from(pendingArtifacts.values()).slice(0, SCENE_ARTIFACT_BATCH_SIZE);
        for (const artifact of batch) {
            pendingArtifacts.delete(artifact.objectName);
        }

        voltCloudConnection.emitBufferedMessage({
            type: 'trajectory-scene-artifact-upsert-batch',
            teamClusterId: voltCloudConnection.getTeamClusterId(),
            daemonPassword: voltCloudConnection.getDaemonPassword(),
            items: batch
        });

        if (pendingArtifacts.size > 0) {
            scheduleFlush(0);
        }
    };

    const scheduleFlush = (delayMs: number): void => {
        if (flushTimer) {
            return;
        }

        flushTimer = setTimeout(() => {
            flushBatch();
        }, delayMs);
        flushTimer.unref();
    };

    return {
        async reportArtifact(input) {
            pendingArtifacts.set(input.objectName, input);

            if (pendingArtifacts.size >= SCENE_ARTIFACT_BATCH_SIZE) {
                if (flushTimer) {
                    clearTimeout(flushTimer);
                    flushTimer = null;
                }
                flushBatch();
                return;
            }

            scheduleFlush(SCENE_ARTIFACT_BATCH_FLUSH_INTERVAL_MS);
        }
    };
};
