import type {
    AnalysisFrameLogIdentity,
    StoredAnalysisFrameLogRecord
} from '@modules/analysis/contracts/analysis-execution-log';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import ApplicationError from '@shared/errors/ApplicationError';
import { Buffer } from 'node:buffer';
import { TEAM_CLUSTER_OBJECT_STORE_BUCKET } from '@voltstack/daemon-cluster-client';

const frameLogObjectKey = (trajectoryId: string, analysisId: string, timestep: number): string => {
    return `trajectory-${trajectoryId}/analysis-${analysisId}/frame-${timestep}.json`;
};

export const readStoredFrameLog = async (
    storageClusterId: string,
    identity: AnalysisFrameLogIdentity
): Promise<StoredAnalysisFrameLogRecord | null> => {
    try {
        const buffer = await objectGatewayClient.getBuffer(
            storageClusterId,
            TEAM_CLUSTER_OBJECT_STORE_BUCKET.AnalysisLogs,
            frameLogObjectKey(identity.trajectoryId, identity.analysisId, identity.timestep)
        );
        return JSON.parse(buffer.toString('utf8')) as StoredAnalysisFrameLogRecord;
    } catch (error) {
        if (error instanceof ApplicationError && error.statusCode === 404) {
            return null;
        }

        throw error;
    }
};

export const writeStoredFrameLog = async (
    storageClusterId: string,
    record: StoredAnalysisFrameLogRecord
): Promise<void> => {
    const buffer = Buffer.from(JSON.stringify(record), 'utf8');
    await objectGatewayClient.putBuffer(storageClusterId, {
        bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.AnalysisLogs,
        objectKey: frameLogObjectKey(record.trajectoryId, record.analysisId, record.timestep),
        buffer,
        contentLength: buffer.length,
        contentType: 'application/json'
    });
};
