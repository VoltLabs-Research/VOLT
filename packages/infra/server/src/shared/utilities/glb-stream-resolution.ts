import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/errors/ApplicationError';
import type { Readable } from 'node:stream';
import type { TeamClusterObjectGatewayStreamResponse } from '@shared/contracts/types/TeamClusterObjectGateway';

export type GlbContentEncoding = 'zstd' | 'identity';

interface ResolvedGlbStream {
    stream: Readable;
    objectName: string;
    size?: number;
    contentEncoding: GlbContentEncoding;
    negotiatedContentEncoding: 'zstd' | null;
    etag?: string;
    lastModified?: Date;
}

interface GlbStreamRequestContext {
    acceptEncoding: string | undefined;
}

const isZstdObjectName = (objectName: string): boolean => objectName.endsWith('.zst');

const acceptsZstd = (acceptEncoding: string | undefined): boolean => (
    (acceptEncoding ?? '')
        .split(',')
        .some((directive) => {
            const [token, ...parameters] = directive.trim().toLowerCase().split(';');
            if (token !== 'zstd') {
                return false;
            }

            return !parameters.some((parameter) => parameter.replace(/\s/g, '') === 'q=0');
        })
);

const stripTrailingZstdExtension = (objectName: string): string => (
    isZstdObjectName(objectName) ? objectName.slice(0, -'.zst'.length) : objectName
);

interface GlbObjectStreamSource {
    getStream(teamClusterId: string, bucket: string, objectKey: string): Promise<TeamClusterObjectGatewayStreamResponse>;
}

export const getClusterGlbStream = async (
    objectGatewayClient: GlbObjectStreamSource,
    teamClusterId: string,
    objectName: string,
    requestContext: GlbStreamRequestContext
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
        contentEncoding: 'zstd',
        negotiatedContentEncoding: acceptsZstd(requestContext.acceptEncoding) ? 'zstd' : null,
        etag: response.etag,
        lastModified: response.lastModified
    };
};
