import {
    TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    TeamClusterServiceExposureAccessMode,
    type TeamClusterDirectAccessGrantResponse
} from '@/shared/contracts';
import { Readable } from 'node:stream';
import type { DaemonConfig } from '@/core/config';
import type { Readable as NodeReadable } from 'node:stream';
import http from 'node:http';
import https from 'node:https';
import { TeamClusterDirectAccessGrantClient } from './TeamClusterDirectAccessGrantClient';

interface ObjectStoreErrorPayload {
    code?: unknown;
    message?: unknown;
}

export interface DirectObjectStoreHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

export interface DirectObjectStoreStreamResponse extends DirectObjectStoreHeadResponse {
    stream: NodeReadable;
}

interface ObjectStoreListResponse {
    keys?: unknown;
    nextCursor?: unknown;
}

interface ObjectStoreDeleteResponse {
    deletedCount?: unknown;
}

interface RawHttpResponse {
    statusCode: number;
    headers: Headers;
    stream: NodeReadable;
}

interface RawRequestInit {
    method: string;
    headers?: HeadersInit;
    body?: Buffer | NodeReadable;
}

class DirectObjectStoreError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'DirectObjectStoreError';
    }
}

const OBJECT_GATEWAY_BASE_PATH = '/internal/object-gateway/v1';

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

const headersFromIncoming = (headers: http.IncomingHttpHeaders): Headers => {
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

const headersToObject = (headers: Headers): Record<string, string> => {
    const normalized: Record<string, string> = {};
    headers.forEach((value, key) => {
        normalized[key] = value;
    });
    return normalized;
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

const parseHeadResponse = (headers: Headers): DirectObjectStoreHeadResponse => {
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

export class TeamClusterDirectObjectStoreClient {
    private readonly grantClient: TeamClusterDirectAccessGrantClient;

    constructor(
        private readonly config: DaemonConfig
    ) {
        this.grantClient = new TeamClusterDirectAccessGrantClient(config);
    }

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

        const response = await this.fetchJson<ObjectStoreListResponse>(
            ownerClusterId,
            this.buildCollectionPath(request.bucket, query),
            { method: 'GET' }
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

    async head(ownerClusterId: string, bucket: string, objectKey: string): Promise<DirectObjectStoreHeadResponse> {
        const response = await this.fetch(ownerClusterId, this.buildObjectPath(bucket, objectKey), {
            method: 'HEAD'
        });

        return parseHeadResponse(response.headers);
    }

    async getStream(ownerClusterId: string, bucket: string, objectKey: string): Promise<DirectObjectStoreStreamResponse> {
        const response = await this.fetch(ownerClusterId, this.buildObjectPath(bucket, objectKey), {
            method: 'GET'
        });

        return {
            ...parseHeadResponse(response.headers),
            stream: response.stream
        };
    }

    async getBuffer(ownerClusterId: string, bucket: string, objectKey: string): Promise<Buffer> {
        const response = await this.fetch(ownerClusterId, this.buildObjectPath(bucket, objectKey), {
            method: 'GET'
        });

        return this.readResponseBuffer(response.stream);
    }

    async putBuffer(ownerClusterId: string, request: {
        bucket: string;
        objectKey: string;
        buffer: Buffer;
        contentType?: string;
        contentEncoding?: string;
        metadata?: Record<string, string>;
    }): Promise<void> {
        await this.fetch(ownerClusterId, this.buildObjectPath(request.bucket, request.objectKey), {
            method: 'PUT',
            headers: this.buildUploadHeaders(request.buffer.length, request.contentType, request.contentEncoding, request.metadata),
            body: request.buffer
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
        await this.fetch(ownerClusterId, this.buildObjectPath(request.bucket, request.objectKey), {
            method: 'PUT',
            headers: this.buildUploadHeaders(
                request.contentLength,
                request.contentType,
                request.contentEncoding,
                request.metadata
            ),
            body: request.stream
        });
    }

    async deleteObject(ownerClusterId: string, bucket: string, objectKey: string): Promise<void> {
        await this.fetch(ownerClusterId, this.buildObjectPath(bucket, objectKey), {
            method: 'DELETE'
        });
    }

    async deleteByPrefix(ownerClusterId: string, bucket: string, prefix: string): Promise<number | undefined> {
        const query = new URLSearchParams();
        query.set('prefix', prefix);

        const response = await this.fetchJson<ObjectStoreDeleteResponse>(
            ownerClusterId,
            this.buildCollectionPath(bucket, query),
            { method: 'DELETE' }
        );

        return typeof response.deletedCount === 'number'
            ? response.deletedCount
            : undefined;
    }

    private async fetchJson<T>(ownerClusterId: string, path: string, init?: RawRequestInit): Promise<T> {
        const response = await this.fetch(ownerClusterId, path, init);
        return JSON.parse((await this.readResponseBuffer(response.stream)).toString('utf8')) as T;
    }

    private async fetch(ownerClusterId: string, path: string, init?: RawRequestInit): Promise<RawHttpResponse> {
        const grant = await this.grantClient.getGrant({
            ownerClusterId,
            exposureName: 'object-gateway',
            accessMode: TeamClusterServiceExposureAccessMode.Http
        });
        const headers = new Headers(init?.headers);
        headers.set(TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER, grant.token);

        const response = await this.performRawRequest(this.buildDirectUrl(grant, path), {
            method: init?.method || 'GET',
            headers,
            body: init?.body
        });

        if (response.statusCode >= 200 && response.statusCode < 300) {
            return response;
        }

        let payload: ObjectStoreErrorPayload | undefined;
        try {
            payload = JSON.parse((await this.readResponseBuffer(response.stream)).toString('utf8')) as ObjectStoreErrorPayload;
        } catch {
            payload = undefined;
        }

        throw new DirectObjectStoreError(
            response.statusCode,
            typeof payload?.code === 'string'
                ? payload.code
                : 'TeamCluster::DirectObjectStoreRequestFailed',
            typeof payload?.message === 'string'
                ? payload.message
                : `Direct object store request failed with status ${response.statusCode}`
        );
    }

    private async performRawRequest(
        urlString: string,
        init: {
            method: string;
            headers: Headers;
            body?: Buffer | NodeReadable;
        }
    ): Promise<RawHttpResponse> {
        const targetUrl = new URL(urlString);
        const transport = targetUrl.protocol === 'https:' ? https : http;

        return new Promise<RawHttpResponse>((resolve, reject) => {
            const request = transport.request({
                protocol: targetUrl.protocol,
                hostname: targetUrl.hostname,
                port: targetUrl.port,
                path: `${targetUrl.pathname}${targetUrl.search}`,
                method: init.method,
                headers: headersToObject(init.headers)
            }, (response) => {
                resolve({
                    statusCode: response.statusCode || 0,
                    headers: headersFromIncoming(response.headers),
                    stream: response
                });
            });

            request.once('error', reject);

            if (!init.body) {
                request.end();
                return;
            }

            if (Buffer.isBuffer(init.body)) {
                request.end(init.body);
                return;
            }

            init.body.once('error', (error) => {
                request.destroy(error);
            });
            init.body.pipe(request);
        });
    }

    private async readResponseBuffer(stream: NodeReadable): Promise<Buffer> {
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
    }

    private buildDirectUrl(grant: TeamClusterDirectAccessGrantResponse, path: string): string {
        return new URL(path, `${grant.endpoint.protocol}://${grant.endpoint.host}:${grant.endpoint.port}`).toString();
    }

    private buildCollectionPath(bucket: string, query?: URLSearchParams): string {
        const basePath = `${OBJECT_GATEWAY_BASE_PATH}/buckets/${encodePathComponent(bucket)}/objects`;
        const queryString = query?.toString();
        return queryString
            ? `${basePath}?${queryString}`
            : basePath;
    }

    private buildObjectPath(bucket: string, objectKey: string): string {
        return `${this.buildCollectionPath(bucket)}/${encodeObjectKeyPath(objectKey)}`;
    }

    private buildUploadHeaders(
        contentLength: number,
        contentType?: string,
        contentEncoding?: string,
        metadata?: Record<string, string>
    ): Record<string, string> {
        const headers: Record<string, string> = {
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
}
