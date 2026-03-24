import {
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH
} from '@/shared/contracts';
import { Readable } from 'node:stream';
import type { DaemonConfig } from '@/core/config';
import type { Readable as NodeReadable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

interface ObjectStoreProxyJsonError {
    code?: unknown;
    message?: unknown;
}

export interface ProxyObjectHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

export interface ProxyObjectStreamResponse extends ProxyObjectHeadResponse {
    stream: NodeReadable;
}

interface ObjectStoreProxyListResponse {
    keys?: unknown;
    nextCursor?: unknown;
}

interface ObjectStoreProxyDeleteResponse {
    deletedCount?: unknown;
}

class ObjectStoreProxyError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'ObjectStoreProxyError';
    }
}

const readHeaderValue = (value: string | null): string | undefined => {
    return value && value.length > 0
        ? value
        : undefined;
};

const encodePathComponent = (value: string): string => {
    return encodeURIComponent(value);
};

const encodeObjectKeyPath = (objectKey: string): string => {
    return objectKey.split('/').map(encodePathComponent).join('/');
};

const normalizeMetadataHeaders = (headers: Headers): Record<string, string> => {
    const metadata: Record<string, string> = {};

    headers.forEach((headerValue, headerName) => {
        if (!headerName.startsWith(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX)) {
            return;
        }

        metadata[headerName.slice(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX.length)] = headerValue;
    });

    return metadata;
};

const parseHeadResponse = (headers: Headers): ProxyObjectHeadResponse => {
    const contentLength = readHeaderValue(headers.get('content-length'));

    return {
        contentLength: typeof contentLength === 'string' && contentLength.length > 0
            ? Number(contentLength)
            : undefined,
        contentType: readHeaderValue(headers.get('content-type')),
        contentEncoding: readHeaderValue(headers.get('content-encoding')),
        etag: readHeaderValue(headers.get('etag')),
        lastModified: readHeaderValue(headers.get('last-modified'))
            ? new Date(headers.get('last-modified')!)
            : undefined,
        metadata: normalizeMetadataHeaders(headers)
    };
};

export class VoltServerObjectStoreProxyClient {
    constructor(
        private readonly config: DaemonConfig
    ) {}

    async list(
        ownerClusterId: string,
        request: {
            bucket: string;
            prefix?: string;
            cursor?: string;
            limit?: number;
        }
    ): Promise<{ keys: string[]; nextCursor?: string; }> {
        const query = new URLSearchParams();
        if (request.prefix) {
            query.set('prefix', request.prefix);
        }

        if (request.cursor) {
            query.set('cursor', request.cursor);
        }

        if (typeof request.limit === 'number' && Number.isFinite(request.limit)) {
            query.set('limit', String(request.limit));
        }

        const response = await this.fetchJson<ObjectStoreProxyListResponse>(
            this.buildCollectionUrl(ownerClusterId, request.bucket, query)
        );

        return {
            keys: Array.isArray(response.keys)
                ? response.keys.filter((value): value is string => typeof value === 'string')
                : [],
            nextCursor: typeof response.nextCursor === 'string'
                ? response.nextCursor
                : undefined
        };
    }

    async head(ownerClusterId: string, bucket: string, objectKey: string): Promise<ProxyObjectHeadResponse> {
        const response = await this.fetch(this.buildObjectUrl(ownerClusterId, bucket, objectKey), {
            method: 'HEAD'
        });

        return parseHeadResponse(response.headers);
    }

    async getStream(ownerClusterId: string, bucket: string, objectKey: string): Promise<ProxyObjectStreamResponse> {
        const response = await this.fetch(this.buildObjectUrl(ownerClusterId, bucket, objectKey), {
            method: 'GET'
        });

        if (!response.body) {
            throw new Error('Object store proxy returned an empty response body');
        }

        return {
            ...parseHeadResponse(response.headers),
            stream: Readable.fromWeb(response.body as unknown as WebReadableStream)
        };
    }

    async getBuffer(ownerClusterId: string, bucket: string, objectKey: string): Promise<Buffer> {
        const response = await this.fetch(this.buildObjectUrl(ownerClusterId, bucket, objectKey), {
            method: 'GET'
        });

        return Buffer.from(await response.arrayBuffer());
    }

    async putBuffer(ownerClusterId: string, request: {
        bucket: string;
        objectKey: string;
        buffer: Buffer;
        contentType?: string;
        contentEncoding?: string;
        metadata?: Record<string, string>;
    }): Promise<void> {
        await this.fetch(this.buildObjectUrl(ownerClusterId, request.bucket, request.objectKey), {
            method: 'PUT',
            headers: this.buildUploadHeaders(request.buffer.length, request.contentType, request.contentEncoding, request.metadata),
            body: new Uint8Array(request.buffer)
        });
    }

    async putStream(ownerClusterId: string, request: {
        bucket: string;
        objectKey: string;
        stream: NodeReadable;
        contentLength: number;
        contentType?: string;
        contentEncoding?: string;
        metadata?: Record<string, string>;
    }): Promise<void> {
        await this.fetch(this.buildObjectUrl(ownerClusterId, request.bucket, request.objectKey), {
            method: 'PUT',
            headers: this.buildUploadHeaders(
                request.contentLength,
                request.contentType,
                request.contentEncoding,
                request.metadata
            ),
            body: Readable.toWeb(request.stream) as unknown as BodyInit
        });
    }

    async deleteObject(ownerClusterId: string, bucket: string, objectKey: string): Promise<void> {
        await this.fetch(this.buildObjectUrl(ownerClusterId, bucket, objectKey), {
            method: 'DELETE'
        });
    }

    async deleteByPrefix(ownerClusterId: string, bucket: string, prefix: string): Promise<number | undefined> {
        const query = new URLSearchParams();
        query.set('prefix', prefix);

        const response = await this.fetchJson<ObjectStoreProxyDeleteResponse>(
            this.buildCollectionUrl(ownerClusterId, bucket, query),
            {
                method: 'DELETE'
            }
        );

        return typeof response.deletedCount === 'number'
            ? response.deletedCount
            : undefined;
    }

    private buildCollectionUrl(ownerClusterId: string, bucket: string, query?: URLSearchParams): string {
        const baseUrl = `${this.config.voltCloudUrl}${TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH}/owners/${encodePathComponent(ownerClusterId)}/buckets/${encodePathComponent(bucket)}/objects`;
        const queryString = query?.toString();
        return queryString
            ? `${baseUrl}?${queryString}`
            : baseUrl;
    }

    private buildObjectUrl(ownerClusterId: string, bucket: string, objectKey: string): string {
        return `${this.buildCollectionUrl(ownerClusterId, bucket)}/${encodeObjectKeyPath(objectKey)}`;
    }

    private buildAuthHeaders(): Record<string, string> {
        return {
            [TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER]: this.config.teamClusterId,
            [TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER]: this.config.daemonPassword
        };
    }

    private buildUploadHeaders(
        contentLength: number,
        contentType?: string,
        contentEncoding?: string,
        metadata?: Record<string, string>
    ): Record<string, string> {
        const headers: Record<string, string> = {
            ...this.buildAuthHeaders(),
            'content-length': String(contentLength)
        };

        if (contentType) {
            headers['content-type'] = contentType;
        }

        if (contentEncoding) {
            headers['content-encoding'] = contentEncoding;
        }

        for (const [key, value] of Object.entries(metadata ?? {})) {
            headers[`${TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX}${key.toLowerCase()}`] = value;
        }

        return headers;
    }

    private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
        const response = await this.fetch(url, init);
        return response.json() as Promise<T>;
    }

    private async fetch(url: string, init?: RequestInit): Promise<Response> {
        const headers = new Headers(init?.headers);
        for (const [headerName, headerValue] of Object.entries(this.buildAuthHeaders())) {
            if (!headers.has(headerName)) {
                headers.set(headerName, headerValue);
            }
        }

        const response = await fetch(url, {
            ...init,
            headers,
            duplex: init?.body && !Buffer.isBuffer(init.body)
                ? 'half'
                : undefined
        } as RequestInit & { duplex?: 'half'; });

        if (response.ok) {
            return response;
        }

        let payload: ObjectStoreProxyJsonError | undefined;
        try {
            payload = await response.json() as ObjectStoreProxyJsonError;
        } catch {
            payload = undefined;
        }

        throw new ObjectStoreProxyError(
            response.status,
            typeof payload?.code === 'string' ? payload.code : 'TeamCluster::ObjectStoreProxyRequestFailed',
            typeof payload?.message === 'string'
                ? payload.message
                : `Object store proxy request failed with status ${response.status}`
        );
    }
}
