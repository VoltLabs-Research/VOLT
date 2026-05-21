import {
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH,
    TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER
} from '@/core/storage/contracts/http-object-store';
import type { DaemonConfig } from '@/core/config';
import type {
    ClusterObjectHeadResponse,
    ClusterObjectListEntry,
    ClusterObjectListRequest,
    ClusterObjectListResponse,
    ClusterObjectReadOptions,
    ClusterObjectStreamResponse,
    RemoteClusterObjectPutBufferRequest,
    RemoteClusterObjectPutStreamRequest,
    RemoteClusterObjectStoreGateway
} from '@/core/storage/contracts/cluster-object-store';
import { readPositiveIntegerEnv } from '@/support/policies/runtime-capacity';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

interface DirectObjectStoreRequestInit {
    method: string;
    headers?: HeadersInit;
    body?: Buffer | Readable;
}

interface DirectObjectStoreFetchInit extends RequestInit {
    duplex?: 'half';
}

interface RawDirectObjectStoreListResponse {
    keys?: string[];
    objects?: ClusterObjectListEntry[];
    nextCursor?: string;
}

interface ObjectStoreErrorPayload {
    code?: string;
    message?: string;
}

const OBJECT_STORE_PROXY_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv(
    'TEAM_CLUSTER_OBJECT_STORE_PROXY_REQUEST_TIMEOUT_MS'
) ?? 10 * 60 * 1000;
const OBJECT_STORE_PROXY_FAST_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv(
    'TEAM_CLUSTER_OBJECT_STORE_PROXY_FAST_REQUEST_TIMEOUT_MS'
) ?? 45_000;

const normalizeListResponse = (payload: RawDirectObjectStoreListResponse): ClusterObjectListResponse => {
    const objects = payload.objects ?? [];
    const keys = payload.keys ?? [];
    const resolvedKeys = keys.length > 0 ? keys : objects.map((object) => object.key);

    return {
        keys: resolvedKeys,
        objects: objects.length > 0
            ? objects
            : resolvedKeys.map((key) => ({ key })),
        nextCursor: payload.nextCursor
    };
};

const parseHeadResponse = (headers: Headers): ClusterObjectHeadResponse => {
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

    const response: ClusterObjectHeadResponse = { metadata };

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

export class DirectObjectStoreClient implements RemoteClusterObjectStoreGateway {
    constructor(
        private readonly config: DaemonConfig
    ) {}

    async list(
        ownerClusterId: string,
        request: ClusterObjectListRequest
    ): Promise<ClusterObjectListResponse> {
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

        const response = await this.fetch(
            this.buildCollectionPath(ownerClusterId, request.bucket, query),
            { method: 'GET' },
            OBJECT_STORE_PROXY_FAST_REQUEST_TIMEOUT_MS
        );
        return normalizeListResponse(await response.json() as RawDirectObjectStoreListResponse);
    }

    readonly head = async (ownerClusterId: string, bucket: string, objectKey: string): Promise<ClusterObjectHeadResponse> => {
        const response = await this.fetch(this.buildObjectPath(ownerClusterId, bucket, objectKey), {
            method: 'HEAD'
        }, OBJECT_STORE_PROXY_FAST_REQUEST_TIMEOUT_MS);

        return parseHeadResponse(response.headers);
    };

    async getStream(
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        options?: ClusterObjectReadOptions
    ): Promise<ClusterObjectStreamResponse> {
        const headers: Record<string, string> = {};
        if (options?.skipMetadata) {
            headers[TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER] = '1';
        }
        // Some callers read object slices via byte ranges. Forward the range
        // so MinIO returns exactly the requested span instead of the full object.
        if (options?.range) {
            const { offset, length } = options.range;
            headers['Range'] = `bytes=${offset}-${offset + length - 1}`;
        }

        const response = await this.fetch(this.buildObjectPath(ownerClusterId, bucket, objectKey), {
            method: 'GET',
            headers: Object.keys(headers).length > 0 ? headers : undefined
        });

        if (!response.body) {
            throw new Error('Object store proxy response did not include a body');
        }

        return {
            ...parseHeadResponse(response.headers),
            stream: Readable.fromWeb(response.body as WebReadableStream)
        };
    }

    readonly putBuffer = async (ownerClusterId: string, request: RemoteClusterObjectPutBufferRequest): Promise<void> => {
        await this.fetch(this.buildObjectPath(ownerClusterId, request.bucket, request.objectKey), {
            method: 'PUT',
            headers: this.buildUploadHeaders(request),
            body: request.buffer
        });
    };

    readonly putStream = async (ownerClusterId: string, request: RemoteClusterObjectPutStreamRequest): Promise<void> => {
        await this.fetch(this.buildObjectPath(ownerClusterId, request.bucket, request.objectKey), {
            method: 'PUT',
            headers: this.buildUploadHeaders(request),
            body: request.stream
        });
    };

    private async fetch(
        path: string,
        init: DirectObjectStoreRequestInit = GET_REQUEST_INIT,
        timeoutMs = OBJECT_STORE_PROXY_REQUEST_TIMEOUT_MS
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

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort(new Error(`Object store proxy request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        timeout.unref();
        requestInit.signal = controller.signal;

        let response: Response;
        try {
            response = await fetch(new URL(path, this.config.voltCloudUrl), requestInit);
        } catch (error) {
            if (controller.signal.aborted) {
                throw Object.assign(
                    new Error(`Object store proxy request timed out after ${timeoutMs}ms`),
                    {
                        name: 'ObjectStoreProxyTimeoutError',
                        statusCode: 504
                    }
                );
            }

            throw error;
        } finally {
            clearTimeout(timeout);
        }

        if (response.ok) {
            return response;
        }

        const payloadText = await response.text();
        let parsedPayload: ObjectStoreErrorPayload | null = null;
        try {
            parsedPayload = JSON.parse(payloadText) as ObjectStoreErrorPayload;
        } catch {
            parsedPayload = null;
        }

        if (parsedPayload && typeof parsedPayload.message === 'string') {
            throw Object.assign(new Error(parsedPayload.message), {
                name: 'ObjectStoreProxyError',
                statusCode: response.status,
                code: parsedPayload.code
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
        request: RemoteClusterObjectPutBufferRequest | RemoteClusterObjectPutStreamRequest
    ): Record<string, string> {
        const headers: Record<string, string> = {
            'content-length': ('buffer' in request ? request.buffer.length : request.contentLength).toString()
        };

        if (request.contentType) {
            headers['content-type'] = request.contentType;
        }

        if (request.contentEncoding) {
            headers['content-encoding'] = request.contentEncoding;
        }

        if (request.metadata) {
            for (const [key, value] of Object.entries(request.metadata)) {
                headers[`${TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX}${key.toLowerCase()}`] = value;
            }
        }

        return headers;
    }
}
