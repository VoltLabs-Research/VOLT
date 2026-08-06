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
    /* What the bytes on the wire actually carry, which for a `.zst` object is zstd. */
    contentEncoding: GlbContentEncoding;
    /*
     * Only set once the caller has advertised zstd, so the response can carry a
     * standard `Content-Encoding` and let the browser decode in C++ instead of
     * shipping 100 MiB through a JS decompressor on the renderer's main thread.
     * A `Content-Encoding` nobody asked for is a decode failure, not a fallback,
     * so this stays null unless it was negotiated.
     */
    negotiatedContentEncoding: 'zstd' | null;
    /* Forwarded from the daemon so caches and intermediaries get real validators. */
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

            /* `zstd;q=0` is an explicit refusal, not an offer. */
            return !parameters.some((parameter) => parameter.replace(/\s/g, '') === 'q=0');
        })
);

const stripTrailingZstdExtension = (objectName: string): string => (
    isZstdObjectName(objectName) ? objectName.slice(0, -'.zst'.length) : objectName
);

export const getClusterGlbStream = async (
    objectGatewayClient: ITeamClusterObjectGatewayClient,
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
