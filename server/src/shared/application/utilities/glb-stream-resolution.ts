import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
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

const isZstdObjectName = (objectName: string): boolean => objectName.endsWith('.zst');

const stripTrailingZstdExtension = (objectName: string): string => (
    isZstdObjectName(objectName) ? objectName.slice(0, -'.zst'.length) : objectName
);

export const getClusterGlbStream = async (
    objectGatewayClient: ITeamClusterObjectGatewayClient,
    teamClusterId: string,
    objectName: string,
    _requestContext: GlbStreamRequestContext
): Promise<ResolvedGlbStream> => {
    if (!isZstdObjectName(objectName)) {
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            'The requested exposure does not expose a GLB model'
        );
    }

    const response = await objectGatewayClient.getStream(teamClusterId, TEAM_CLUSTER_BUCKETS.MODELS, objectName);

    return {
        stream: response.stream,
        objectName: stripTrailingZstdExtension(objectName),
        size: response.contentLength,
        contentEncoding: 'identity'
    };
};
