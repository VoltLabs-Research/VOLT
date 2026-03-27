import {
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH,
    TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER
} from '@/shared/contracts';
import type { DaemonConfig } from '@/core/config';
import type { Readable as NodeReadable } from 'node:stream';
import http from 'node:http';
import https from 'node:https';

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

export interface DirectObjectStoreReadOptions {
    skipMetadata?: boolean;
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
    private readonly httpAgent = new http.Agent({
        keepAlive: true,
        keepAliveMsecs: 30_000,
        maxSockets: 32,
        maxFreeSockets: 8
    });

    private readonly httpsAgent = new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 30_000,
        maxSockets: 32,
        maxFreeSockets: 8
    });

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

        const response = await this.fetchJson<ObjectStoreListResponse>(
            this.buildCollectionPath(ownerClusterId, request.bucket, query),
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
        const response = await this.fetch(this.buildObjectPath(ownerClusterId, bucket, objectKey), {
            method: 'HEAD'
        });

        const head = parseHeadResponse(response.headers);
        await this.readResponseBuffer(response.stream);

        return head;
    }

    async getStream(
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        options?: DirectObjectStoreReadOptions
    ): Promise<DirectObjectStoreStreamResponse> {
        const response = await this.fetch(this.buildObjectPath(ownerClusterId, bucket, objectKey), {
            method: 'GET',
            headers: this.buildReadHeaders(options)
        });

        return {
            ...parseHeadResponse(response.headers),
            stream: response.stream
        };
    }

    async getBuffer(ownerClusterId: string, bucket: string, objectKey: string): Promise<Buffer> {
        const response = await this.fetch(this.buildObjectPath(ownerClusterId, bucket, objectKey), {
            method: 'GET',
            headers: this.buildReadHeaders({ skipMetadata: true })
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
        await this.fetch(this.buildObjectPath(ownerClusterId, request.bucket, request.objectKey), {
            method: 'PUT',
            headers: this.buildUploadHeaders(request.buffer.length, request.contentType, request.contentEncoding, request.metadata),
            body: request.buffer
        }).then((response) => this.readResponseBuffer(response.stream));
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
        await this.fetch(this.buildObjectPath(ownerClusterId, request.bucket, request.objectKey), {
            method: 'PUT',
            headers: this.buildUploadHeaders(
                request.contentLength,
                request.contentType,
                request.contentEncoding,
                request.metadata
            ),
            body: request.stream
        }).then((response) => this.readResponseBuffer(response.stream));
    }

    async deleteObject(ownerClusterId: string, bucket: string, objectKey: string): Promise<void> {
        await this.fetch(this.buildObjectPath(ownerClusterId, bucket, objectKey), {
            method: 'DELETE'
        }).then((response) => this.readResponseBuffer(response.stream));
    }

    async deleteByPrefix(ownerClusterId: string, bucket: string, prefix: string): Promise<number | undefined> {
        const query = new URLSearchParams();
        query.set('prefix', prefix);

        const response = await this.fetchJson<ObjectStoreDeleteResponse>(
            this.buildCollectionPath(ownerClusterId, bucket, query),
            { method: 'DELETE' }
        );

        return typeof response.deletedCount === 'number'
            ? response.deletedCount
            : undefined;
    }

    private async fetchJson<T>(path: string, init?: RawRequestInit): Promise<T> {
        const response = await this.fetch(path, init);
        return JSON.parse((await this.readResponseBuffer(response.stream)).toString('utf8')) as T;
    }

    private async fetch(path: string, init?: RawRequestInit): Promise<RawHttpResponse> {
        const headers = new Headers(init?.headers);
        headers.set(TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER, this.config.teamClusterId);
        headers.set(TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER, this.config.daemonPassword);

        const response = await this.performRawRequest(this.buildProxyUrl(path), {
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

        throw new ObjectStoreProxyError(
            response.statusCode,
            typeof payload?.code === 'string'
                ? payload.code
                : 'TeamCluster::ObjectStoreProxyRequestFailed',
            typeof payload?.message === 'string'
                ? payload.message
                : `Object store proxy request failed with status ${response.statusCode}`
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
        const agent = targetUrl.protocol === 'https:'
            ? this.httpsAgent
            : this.httpAgent;

        return new Promise<RawHttpResponse>((resolve, reject) => {
            const request = transport.request({
                protocol: targetUrl.protocol,
                hostname: targetUrl.hostname,
                port: targetUrl.port,
                path: `${targetUrl.pathname}${targetUrl.search}`,
                method: init.method,
                headers: headersToObject(init.headers),
                agent
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

    private buildProxyUrl(path: string): string {
        return new URL(path, this.config.voltCloudUrl).toString();
    }

    private buildCollectionPath(ownerClusterId: string, bucket: string, query?: URLSearchParams): string {
        const basePath = `${TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH}/owners/${encodePathComponent(ownerClusterId)}/buckets/${encodePathComponent(bucket)}/objects`;
        const queryString = query?.toString();
        return queryString
            ? `${basePath}?${queryString}`
            : basePath;
    }

    private buildObjectPath(ownerClusterId: string, bucket: string, objectKey: string): string {
        return `${this.buildCollectionPath(ownerClusterId, bucket)}/${encodeObjectKeyPath(objectKey)}`;
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

    private buildReadHeaders(options?: DirectObjectStoreReadOptions): Record<string, string> | undefined {
        if (!options?.skipMetadata) {
            return undefined;
        }

        return {
            [TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER]: '1'
        };
    }
}
