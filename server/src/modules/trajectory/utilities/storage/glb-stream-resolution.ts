import { SYS_BUCKETS } from '@core/config/minio';
import type TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import {
    buildTrajectoryGlbObjectName,
    createZstdDecompressionStream,
    isZstdObjectName,
    stripTrailingZstdExtension
} from './trajectory-storage-codec';
import type { Readable } from 'node:stream';

export interface ResolvedGlbStream {
    stream: Readable;
    objectName: string;
    size?: number;
}

export const resolveTrajectoryGlbObjectName = async (
    trajectoryId: string,
    timestep: string | number,
    checker: (objectName: string) => Promise<boolean>
): Promise<string> => {
    const compressed = buildTrajectoryGlbObjectName(trajectoryId, timestep);
    if (await checker(compressed)) {
        return compressed;
    }

    throw new Error(`GLB model not found for trajectory=${trajectoryId} timestep=${timestep}`);
};

export const getClusterGlbStream = async (
    objectGatewayClient: TeamClusterObjectGatewayClient,
    teamClusterId: string,
    objectName: string
): Promise<ResolvedGlbStream> => {
    if (!isZstdObjectName(objectName)) {
        throw new Error(`Unsupported GLB object key: ${objectName}`);
    }

    const response = await objectGatewayClient.getStream(teamClusterId, SYS_BUCKETS.MODELS, objectName);
    const decompressed = createZstdDecompressionStream(response.stream);
    void decompressed.completion;
    return {
        stream: decompressed.stream,
        objectName: stripTrailingZstdExtension(objectName)
    };
};

export const getLocalGlbStream = async (
    storageService: IStorageService,
    objectName: string
): Promise<ResolvedGlbStream> => {
    if (!isZstdObjectName(objectName)) {
        throw new Error(`Unsupported GLB object key: ${objectName}`);
    }

    const stream = await storageService.getStream(SYS_BUCKETS.MODELS, objectName);

    const decompressed = createZstdDecompressionStream(stream);
    void decompressed.completion;
    return {
        stream: decompressed.stream,
        objectName: stripTrailingZstdExtension(objectName)
    };
};
