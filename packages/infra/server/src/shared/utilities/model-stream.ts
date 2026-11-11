import path from 'node:path';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/errors/ApplicationError';
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';
import type { TeamClusterObjectGatewayStreamResponse } from '@shared/contracts/types/TeamClusterObjectGateway';
import { TEAM_CLUSTER_OBJECT_STORE_BUCKET } from '@voltstack/daemon-cluster-client';

// Every model a cluster stores (frames, colour codings, particle filters, plugin exposures) is a
// quantized, meshopt-compressed glTF binary gzipped once when written, under a key ending in
// MODEL_OBJECT_SUFFIX. It is sent exactly as stored with Content-Encoding: gzip, which every
// browser and HTTP client decodes natively, so the server never re-encodes a model and no client
// carries a decompressor. A model's URL only ever names one content, so it caches for good.
export const MODEL_OBJECT_SUFFIX = '.glb.gz';

interface ModelObjectSource {
    getStream(teamClusterId: string, bucket: string, objectKey: string): Promise<TeamClusterObjectGatewayStreamResponse>;
}

export const stripModelEncoding = (objectName: string): string => (
    objectName.endsWith(MODEL_OBJECT_SUFFIX) ? objectName.slice(0, -'.gz'.length) : objectName
);

export const getModelStream = async (
    source: ModelObjectSource,
    teamClusterId: string,
    objectName: string
): Promise<DownloadStreamOutput> => {
    if (!objectName.endsWith(MODEL_OBJECT_SUFFIX)) {
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            'The requested resource is not a model'
        );
    }

    const response = await source.getStream(teamClusterId, TEAM_CLUSTER_OBJECT_STORE_BUCKET.Models, objectName);
    return {
        stream: response.stream,
        headers: {
            'Content-Type': 'model/gltf-binary',
            'Content-Encoding': 'gzip',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Disposition': `inline; filename="${path.posix.basename(stripModelEncoding(objectName))}"`,
            ...((response.contentLength ?? 0) > 0 ? { 'Content-Length': String(response.contentLength) } : {}),
            ...(response.etag ? { ETag: response.etag } : {}),
            ...(response.lastModified ? { 'Last-Modified': response.lastModified.toUTCString() } : {})
        }
    };
};
