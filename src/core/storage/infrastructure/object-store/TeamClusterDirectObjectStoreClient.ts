import { TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER, TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER, TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX, TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH, TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER } from '@/contracts';
import type { DaemonConfig } from '@/core/config';
import { Readable, type Readable as NodeReadable } from 'node:stream';
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

const directObjectStoreListEntrySchema = z.object({
    key: z.string().min(1),
    contentLength: z.number().finite().optional(),
    etag: z.string().optional(),
    lastModified: z.union([z.string(), z.date()]).optional().transform((value) => {
        if (!value) {
            return undefined;
        }

        const parsedDate = value instanceof Date
            ? value
            : new Date(value);

        if (Number.isNaN(parsedDate.getTime())) {
            throw new Error('Object store list response contains an invalid lastModified value');
        }

        return parsedDate;
    })
});

const directObjectStoreListResponseSchema = z.object({
    keys: z.array(z.string().min(1)).optional(),
    objects: z.array(directObjectStoreListEntrySchema).optional(),
    nextCursor: z.string().optional()
});

const objectStoreErrorPayloadSchema = z.object({
    code: z.string().optional(),
    message: z.string().optional()
});

const encodeObjectKeyPath = (objectKey: string): string => {
    return objectKey.split('/').map((segment) => encodeURIComponent(segment)).join('/');
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

const parseHeaderNumber = (value: string | null): number | undefined => {
    if (!value) {
        return undefined;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue)
        ? parsedValue
        : undefined;
};

const parseHeadResponse = (headers: Headers): DirectObjectStoreHeadResponse => {
    const lastModified = headers.get('last-modified');

    return {
        contentLength: parseHeaderNumber(headers.get('content-length')),
        contentType: headers.get('content-type') || undefined,
        contentEncoding: headers.get('content-encoding') || undefined,
        etag: headers.get('etag') || undefined,
        lastModified: lastModified ? new Date(lastModified) : undefined,
        metadata: normalizeMetadataHeaders(headers)
    };
};

export class TeamClusterDirectObjectStoreClient {
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
    ): Promise<{ keys: string[]; objects: DirectObjectStoreListEntry[]; nextCursor?: string; }> {
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

        const response = await this.fetchJson(
            this.buildCollectionPath(ownerClusterId, request.bucket, query),
            directObjectStoreListResponseSchema,
            { method: 'GET' }
        );
        const objects = response.objects ?? [];
        const keys = response.keys ?? objects.map((object) => object.key);

        return {
            keys,
            objects: objects.length > 0
                ? objects
                : keys.map((key) => ({ key })),
            nextCursor: response.nextCursor
        };
    }

    async head(ownerClusterId: string, bucket: string, objectKey: string): Promise<DirectObjectStoreHeadResponse> {
        const response = await this.fetch(this.buildObjectPath(ownerClusterId, bucket, objectKey), {
            method: 'HEAD'
        });

        return parseHeadResponse(response.headers);
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

        if (!response.body) {
            throw new Error('Object store proxy response did not include a body');
        }

        return {
            ...parseHeadResponse(response.headers),
            stream: Readable.fromWeb(response.body as unknown as WebReadableStream<any>)
        };
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
    }

    private async fetchJson<TSchema extends z.ZodTypeAny>(
        path: string,
        schema: TSchema,
        init?: {
            method?: string;
            headers?: HeadersInit;
            body?: Buffer | NodeReadable;
        }
    ): Promise<z.infer<TSchema>> {
        const response = await this.fetch(path, init);
        return schema.parse(await response.json());
    }

    private async fetch(
        path: string,
        init?: {
            method?: string;
            headers?: HeadersInit;
            body?: Buffer | NodeReadable;
        }
    ): Promise<Response> {
        const headers = new Headers(init?.headers);
        headers.set(TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER, this.config.teamClusterId);
        headers.set(TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER, this.config.daemonPassword);

        const response = await fetch(new URL(path, this.config.voltCloudUrl), {
            method: init?.method || 'GET',
            headers,
            body: init?.body,
            duplex: init?.body && !Buffer.isBuffer(init.body)
                ? 'half'
                : undefined
        } as RequestInit & { duplex?: 'half'; });

        if (response.ok) {
            return response;
        }

        const payloadText = await response.text();
        const payload = (() => {
            try {
                return objectStoreErrorPayloadSchema.parse(JSON.parse(payloadText));
            } catch {
                return null;
            }
        })();

        throw new ObjectStoreProxyError(
            response.status,
            payload?.code || 'TeamCluster::ObjectStoreProxyRequestFailed',
            payload?.message || `Object store proxy request failed with status ${response.status}`
        );
    }

    private buildCollectionPath(ownerClusterId: string, bucket: string, query?: URLSearchParams): string {
        const basePath = `${TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH}/owners/${encodeURIComponent(ownerClusterId)}/buckets/${encodeURIComponent(bucket)}/objects`;
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
