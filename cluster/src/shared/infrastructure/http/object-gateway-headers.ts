import {
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX
} from '@shared/contracts/types/http-object-store';
import type { LocalClusterObjectStat } from '@shared/contracts/types/cluster-object-store';
import type { ObjectByteRange } from '@shared/infrastructure/http/object-gateway-range';
import type { Request, Response } from 'express';

const S3_METADATA_HEADER_PREFIX = 'x-amz-meta-';

const readObjectMetadata = (stat: LocalClusterObjectStat): Record<string, string> => {
    const metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(stat.metaData)) {
        metadata[key.toLowerCase()] = value;
    }
    return metadata;
};

const writeEntityHeaders = (
    response: Response,
    stat: LocalClusterObjectStat,
    metadata: Record<string, string>
): void => {
    const contentType = metadata['content-type'];
    const contentEncoding = metadata['content-encoding'];

    if (contentType) {
        response.setHeader('content-type', contentType);
    }

    if (contentEncoding) {
        response.setHeader('content-encoding', contentEncoding);
    }

    if (stat.etag) {
        response.setHeader('etag', stat.etag);
    }

    if (stat.lastModified) {
        response.setHeader('last-modified', stat.lastModified.toUTCString());
    }
};

export const writeObjectHeaders = (response: Response, stat: LocalClusterObjectStat): void => {
    const metadata = readObjectMetadata(stat);
    writeEntityHeaders(response, stat, metadata);
    response.setHeader('content-length', stat.size);

    for (const [metadataKey, metadataValue] of Object.entries(metadata)) {
        if (metadataKey.startsWith(S3_METADATA_HEADER_PREFIX)) {
            response.setHeader(
                `${TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX}${metadataKey.slice(S3_METADATA_HEADER_PREFIX.length)}`,
                metadataValue
            );
        }
    }
};

export const writePartialObjectHeaders = (
    response: Response,
    stat: LocalClusterObjectStat,
    range: ObjectByteRange,
    includeMetadata: boolean
): void => {
    if (includeMetadata) {
        writeObjectHeaders(response, stat);
    } else {
        writeEntityHeaders(response, stat, readObjectMetadata(stat));
    }

    response.setHeader('accept-ranges', 'bytes');
    response.setHeader('content-length', String(range.length));
    response.setHeader('content-range', `bytes ${range.start}-${range.end}/${stat.size}`);
};

export const readUploadMetadata = (request: Pick<Request, 'get' | 'headers'>): Record<string, string> | undefined => {
    const metadata: Record<string, string> = {};
    const contentType = request.get('content-type');
    const contentEncoding = request.get('content-encoding');

    if (contentType) {
        metadata['Content-Type'] = contentType;
    }

    if (contentEncoding) {
        metadata['Content-Encoding'] = contentEncoding;
    }

    for (const headerName of Object.keys(request.headers)) {
        if (!headerName.toLowerCase().startsWith(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX)) {
            continue;
        }

        const headerSuffix = headerName.slice(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX.length);
        const singleValue = request.get(headerName);
        if (headerSuffix && singleValue) {
            metadata[`${S3_METADATA_HEADER_PREFIX}${headerSuffix}`] = singleValue;
        }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
};
