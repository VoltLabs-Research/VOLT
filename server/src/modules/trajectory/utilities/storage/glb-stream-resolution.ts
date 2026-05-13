import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import {
    isZstdObjectName,
    stripTrailingZstdExtension
} from './trajectory-storage-codec';
import type { Readable } from 'node:stream';

export type GlbContentEncoding = 'zstd' | 'identity';

interface ResolvedGlbStream {
    stream: Readable;
    objectName: string;
    size?: number;
    contentEncoding: GlbContentEncoding;
}

interface GlbStreamRequestContext {
    acceptEncoding: string | undefined;
}

export const getClusterGlbStream = async (
    objectGatewayClient: TeamClusterObjectGatewayClient,
    teamClusterId: string,
    objectName: string,
    _requestContext: GlbStreamRequestContext
): Promise<ResolvedGlbStream> => {
    if (!isZstdObjectName(objectName)) {
        throw new Error(`Unsupported GLB object key: ${objectName}`);
    }

    const response = await objectGatewayClient.getStream(teamClusterId, TEAM_CLUSTER_BUCKETS.MODELS, objectName);

    return {
        stream: response.stream,
        objectName: stripTrailingZstdExtension(objectName),
        size: response.contentLength,
        contentEncoding: 'identity'
    };
};
