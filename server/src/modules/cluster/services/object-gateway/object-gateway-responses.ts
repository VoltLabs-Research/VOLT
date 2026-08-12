
import { TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX } from '@shared/contracts/types/TeamClusterObjectGateway';
import type { IncomingHttpHeaders } from 'node:http';
import type { Readable as NodeReadable } from 'node:stream';
import type {
    TeamClusterObjectGatewayHeadResponse,
    TeamClusterObjectGatewayListEntry
} from '@shared/contracts/types/TeamClusterObjectGateway';


export interface ObjectGatewayJsonListEntry {
    key: string;
    contentLength?: number;
    etag?: string;
    lastModified?: string;
}

export interface ObjectGatewayJsonListResponse {
    keys: string[];
    objects: ObjectGatewayJsonListEntry[];
    nextCursor?: string;
}

export interface ObjectGatewayJsonError {
    code?: string;
    message?: string;
}

export interface RawHttpResponse {
    statusCode: number;
    headers: Headers;
    stream: NodeReadable;
}

export const headersFromIncoming = (headers: IncomingHttpHeaders): Headers => {
    const normalized = new Headers();

    for (const [headerName, headerValue] of Object.entries(headers)) {
        if (Array.isArray(headerValue)) {
            for (const value of headerValue) {
                normalized.append(headerName, value);
            }
            continue;
        }

        if (typeof headerValue === 'string') {
            normalized.set(headerName, headerValue);
        }
    }

    return normalized;
};

export const headersToObject = (headers: Headers): Record<string, string> => {
    const normalized: Record<string, string> = {};
    headers.forEach((headerValue, headerName) => {
        normalized[headerName] = headerValue;
    });
    return normalized;
};

export const normalizeMetadataHeaders = (headers: Headers): Record<string, string> => {
    const metadata: Record<string, string> = {};

    headers.forEach((headerValue, headerName) => {
        if (headerName.startsWith(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX)) {
            metadata[headerName.slice(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX.length)] = headerValue;
        }
    });

    return metadata;
};

export const parseHeadResponse = (headers: Headers): TeamClusterObjectGatewayHeadResponse => {
    const contentLength = headers.get('content-length');
    const lastModified = headers.get('last-modified');

    return {
        contentLength: contentLength
            ? Number(contentLength)
            : undefined,
        contentType: headers.get('content-type') || undefined,
        contentEncoding: headers.get('content-encoding') || undefined,
        etag: headers.get('etag') || undefined,
        lastModified: lastModified
            ? new Date(lastModified)
            : undefined,
        metadata: normalizeMetadataHeaders(headers)
    };
};

export const parseListEntry = (entry: ObjectGatewayJsonListEntry): TeamClusterObjectGatewayListEntry => ({
    key: entry.key,
    contentLength: entry.contentLength,
    etag: entry.etag,
    lastModified: entry.lastModified
        ? new Date(entry.lastModified)
        : undefined
});
