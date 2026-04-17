import {
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH,
    TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER
} from '@/core/storage/contracts/http.objectStore';
import type { DaemonConfig } from '@/core/config';
import { Readable } from 'node:stream';
import type { Readable as NodeReadable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { z } from 'zod';

interface DirectObjectStoreHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

interface DirectObjectStoreStreamResponse extends DirectObjectStoreHeadResponse {
    stream: NodeReadable;
}

interface DirectObjectStoreListEntry {
    key: string;
    contentLength?: number;
    etag?: string;
    lastModified?: Date;
}

interface DirectObjectStoreReadOptions {
    skipMetadata?: boolean;
}

interface DirectObjectStoreListRequest {
    bucket: string;
    prefix?: string;
    cursor?: string;
    limit?: number;
}

interface DirectObjectStoreListResponse {
    keys: string[];
    objects: DirectObjectStoreListEntry[];
    nextCursor?: string;
}

interface DirectObjectStorePutBufferRequest {
    bucket: string;
    objectKey: string;
    buffer: Buffer;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
}

interface DirectObjectStorePutStreamRequest {
    bucket: string;
    objectKey: string;
    stream: NodeReadable;
    contentLength: number;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
}

interface DirectObjectStoreRequestInit {
    method: string;
    headers?: HeadersInit;
    body?: Buffer | NodeReadable;
}

interface DirectObjectStoreFetchInit extends RequestInit {
    duplex?: 'half';
}

const directObjectStoreListEntrySchema = z.object({
    key: z.string().min(1),
    contentLength: z.number().finite().optional(),
    etag: z.string().optional(),
    lastModified: z.coerce.date().optional()
});

const directObjectStoreListResponseSchema = z.object({
    keys: z.array(z.string().min(1)).default([]),
    objects: z.array(directObjectStoreListEntrySchema).default([]),
    nextCursor: z.string().optional()
}).transform(({ objects, keys, nextCursor }) => {
    const resolvedKeys = keys.length > 0 ? keys : objects.map((object) => object.key);

    return {
        keys: resolvedKeys,
        objects: objects.length > 0
            ? objects
            : resolvedKeys.map((key) => ({ key })),
        nextCursor
    };
});

const objectStoreErrorPayloadSchema = z.object({
    code: z.string(),
    message: z.string()
});

const parseHeadResponse = (headers: Headers): DirectObjectStoreHeadResponse => {
    const contentLengthHeader = headers.get('content-length');
    const contentType = headers.get('content-type');
    const contentEncoding = headers.get('content-encoding');
    const etag = headers.get('etag');
    const lastModified = headers.get('last-modified');
    const metadata: Record<string, string> = {};

    headers.forEach((headerValue, headerName) => {
        if (!headerName.startsWith(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX)) {
            return;
        }

        metadata[headerName.slice(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX.length)] = headerValue;
    });

    const response: DirectObjectStoreHeadResponse = { metadata };

    if (contentLengthHeader) {
        response.contentLength = Number(contentLengthHeader);
    }

    if (contentType !== null) {
        response.contentType = contentType;
    }

    if (contentEncoding !== null) {
        response.contentEncoding = contentEncoding;
    }

    if (etag !== null) {
        response.etag = etag;
    }

    if (lastModified) {
        response.lastModified = new Date(lastModified);
    }

    return response;
};

const GET_REQUEST_INIT: DirectObjectStoreRequestInit = { method: 'GET' };

export class TeamClusterDirectObjectStoreClient {
    constructor(
        private readonly config: DaemonConfig
    ) {}

    async list(
        ownerClusterId: string,
        request: DirectObjectStoreListRequest
    ): Promise<DirectObjectStoreListResponse> {
        const query = new URLSearchParams();
        if (request.prefix) {
            query.set('prefix', request.prefix);
        }

        if (request.cursor) {
            query.set('cursor', request.cursor);
        }

        if (request.limit !== undefined) {
            query.set('limit', request.limit.toString());
        }

        return directObjectStoreListResponseSchema.parse(await (await this.fetch(
            this.buildCollectionPath(ownerClusterId, request.bucket, query),
            { method: 'GET' }
        )).json());
    }

    readonly head = async (ownerClusterId: string, bucket: string, objectKey: string): Promise<DirectObjectStoreHeadResponse> => {
        const response = await this.fetch(this.buildObjectPath(ownerClusterId, bucket, objectKey), {
            method: 'HEAD'
        });

        return parseHeadResponse(response.headers);
    };

    async getStream(
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        options?: DirectObjectStoreReadOptions
    ): Promise<DirectObjectStoreStreamResponse> {
        const headers = options && options.skipMetadata
            ? { [TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER]: '1' }
            : undefined;

        const response = await this.fetch(this.buildObjectPath(ownerClusterId, bucket, objectKey), {
            method: 'GET',
            headers
        });

        if (!response.body) {
            throw new Error('Object store proxy response did not include a body');
        }

        return {
            ...parseHeadResponse(response.headers),
            stream: Readable.fromWeb(response.body as WebReadableStream)
        };
    }

    readonly putBuffer = async (ownerClusterId: string, request: DirectObjectStorePutBufferRequest): Promise<void> => {
        await this.fetch(this.buildObjectPath(ownerClusterId, request.bucket, request.objectKey), {
            method: 'PUT',
            headers: this.buildUploadHeaders(request.buffer.length, request.contentType, request.contentEncoding, request.metadata),
            body: request.buffer
        });
    };

    readonly putStream = async (ownerClusterId: string, request: DirectObjectStorePutStreamRequest): Promise<void> => {
        await this.fetch(this.buildObjectPath(ownerClusterId, request.bucket, request.objectKey), {
            method: 'PUT',
            headers: this.buildUploadHeaders(
                request.contentLength,
                request.contentType,
                request.contentEncoding,
                request.metadata
            ),
            body: request.stream
        });
    };

    private async fetch(
        path: string,
        init: DirectObjectStoreRequestInit = GET_REQUEST_INIT
    ): Promise<Response> {
        const headers = new Headers(init.headers);
        headers.set(TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER, this.config.teamClusterId);
        headers.set(TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER, this.config.daemonPassword);

        const requestInit: DirectObjectStoreFetchInit = {
            method: init.method,
            headers,
            body: init.body as BodyInit | undefined
        };

        if (init.body && !Buffer.isBuffer(init.body)) {
            requestInit.duplex = 'half';
        }

        const response = await fetch(new URL(path, this.config.voltCloudUrl), requestInit);

        if (response.ok) {
            return response;
        }

        const payloadText = await response.text();
        const parsedPayload = objectStoreErrorPayloadSchema.safeParse(JSON.parse(payloadText));

        if (parsedPayload.success) {
            throw Object.assign(new Error(parsedPayload.data.message), {
                name: 'ObjectStoreProxyError',
                statusCode: response.status,
                code: parsedPayload.data.code
            });
        }

        throw Object.assign(new Error(`Object store proxy request failed with status ${response.status}`), {
            name: 'ObjectStoreProxyError',
            statusCode: response.status
        });
    }

    private buildCollectionPath(ownerClusterId: string, bucket: string, query?: URLSearchParams): string {
        const basePath = `${TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH}/owners/${encodeURIComponent(ownerClusterId)}/buckets/${encodeURIComponent(bucket)}/objects`;
        const queryString = query?.toString();
        return queryString
            ? `${basePath}?${queryString}`
            : basePath;
    }

    private buildObjectPath(ownerClusterId: string, bucket: string, objectKey: string): string {
        const encodedObjectKey = objectKey.split('/').map((segment) => encodeURIComponent(segment)).join('/');
        return `${this.buildCollectionPath(ownerClusterId, bucket)}/${encodedObjectKey}`;
    }

    private buildUploadHeaders(
        contentLength: number,
        contentType?: string,
        contentEncoding?: string,
        metadata?: Record<string, string>
    ): Record<string, string> {
        const headers: Record<string, string> = {
            'content-length': contentLength.toString()
        };

        if (contentType) {
            headers['content-type'] = contentType;
        }

        if (contentEncoding) {
            headers['content-encoding'] = contentEncoding;
        }

        if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
                headers[`${TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX}${key.toLowerCase()}`] = value;
            }
        }

        return headers;
    }
}
