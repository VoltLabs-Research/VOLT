import {
    TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER,
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureSourceKind,
    TeamClusterServiceExposureStatus,
    type TeamClusterServiceExposure
} from '@/shared/contracts';
import { logger } from '@/core/logger';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DaemonConfig } from '@/core/config';
import type { MinioService } from '@/modules/platform/services';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ObjectGatewayTelemetryService } from './ObjectGatewayTelemetryService';
import type { RuntimeCapabilityGuard } from './RuntimeCapabilityGuard';
import { RuntimeCapabilityError } from './RuntimeCapabilityGuard';
import { verifyTeamClusterDirectAccessToken } from './TeamClusterDirectAccessTokenVerifier';

const OBJECT_GATEWAY_API_BASE_PATH = '/internal/object-gateway/v1';
const OBJECT_GATEWAY_BUCKETS_PATH = `${OBJECT_GATEWAY_API_BASE_PATH}/buckets/`;
const OBJECT_GATEWAY_EXPOSURE_ID = 'daemon:object-gateway';
const OBJECT_GATEWAY_EXPOSURE_NAME = 'object-gateway';
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 1_000;
const OBJECT_METADATA_HEADER_PREFIX = 'x-object-meta-';
const MINIO_METADATA_HEADER_PREFIX = 'x-amz-meta-';
const LOOPBACK_HOST = '127.0.0.1';

const isWildcardHost = (value: string): boolean => {
    return value === '0.0.0.0' || value === '::' || value === '[::]';
};

interface ObjectStatLike {
    size?: unknown;
    etag?: unknown;
    lastModified?: unknown;
    metaData?: Record<string, unknown>;
};

class ObjectGatewayHttpError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        Object.setPrototypeOf(this, ObjectGatewayHttpError.prototype);
    }
}

type ObjectGatewayOperationName =
    | 'list'
    | 'head'
    | 'get'
    | 'put'
    | 'delete'
    | 'delete-prefix';

const isMinioNotFoundError = (error: unknown): boolean => {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return false;
    }

    return error.code === 'NotFound' || error.code === 'NoSuchKey';
};

const readSingleHeaderValue = (value: string | string[] | undefined): string | undefined => {
    if (Array.isArray(value)) {
        return value[0];
    }

    return value;
};

const readInteger = (
    rawValue: string | null,
    fieldName: string,
    fallback: number
): number => {
    if (rawValue === null || rawValue.trim().length === 0) {
        return fallback;
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) {
        throw new ObjectGatewayHttpError(400, `${fieldName} must be a positive integer`);
    }

    return value;
};

const decodePathComponent = (value: string, fieldName: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        throw new ObjectGatewayHttpError(400, `${fieldName} contains invalid path encoding`);
    }
};

/**
 * Internal object data-plane exposed over HTTP and reached exclusively through
 * reverse-channel tunnel sessions.
 *
 * API surface:
 * - `GET /internal/object-gateway/v1/buckets/:bucket/objects?prefix=&cursor=&limit=`
 * - `DELETE /internal/object-gateway/v1/buckets/:bucket/objects?prefix=...`
 * - `HEAD /internal/object-gateway/v1/buckets/:bucket/objects/*`
 * - `GET /internal/object-gateway/v1/buckets/:bucket/objects/*`
 * - `PUT /internal/object-gateway/v1/buckets/:bucket/objects/*`
 * - `DELETE /internal/object-gateway/v1/buckets/:bucket/objects/*`
 */
export class ObjectGatewayServer {
    private server: http.Server | null = null;
    private bindHost: string | null = null;
    private bindPort: number | null = null;
    private localTargetHost: string | null = null;
    private readonly allowedBuckets: Set<string>;

    constructor(
        private readonly config: DaemonConfig,
        private readonly minioService: MinioService,
        private readonly telemetryService: ObjectGatewayTelemetryService,
        private readonly runtimeCapabilityGuard?: RuntimeCapabilityGuard
    ) {
        this.allowedBuckets = new Set(this.minioService.listBuckets());
    }

    async start(): Promise<void> {
        if (this.server && this.bindHost && this.bindPort) {
            return;
        }

        this.server = http.createServer((request, response) => {
            this.handleRequest(request, response).catch((error: unknown) => {
                this.handleRequestFailure(response, error);
            });
        });

        await new Promise<void>((resolve, reject) => {
            const server = this.server;
            if (!server) {
                reject(new Error('Object gateway server is not initialized'));
                return;
            }

            const handleError = (error: Error): void => {
                server.off('listening', handleListening);
                reject(error);
            };
            const handleListening = (): void => {
                server.off('error', handleError);
                resolve();
            };

            server.once('error', handleError);
            server.once('listening', handleListening);
            server.listen(this.config.port, this.config.host);
        });

        const address = this.server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Object gateway server did not expose a TCP address');
        }

        const tcpAddress = address as AddressInfo;
        this.bindHost = tcpAddress.address;
        this.bindPort = tcpAddress.port;
        this.localTargetHost = isWildcardHost(tcpAddress.address)
            ? LOOPBACK_HOST
            : tcpAddress.address;

        logger.info({
            action: 'object-gateway.started',
            teamClusterId: this.config.teamClusterId,
            host: this.bindHost,
            port: this.bindPort
        }, 'Started daemon object gateway');
    }

    async stop(): Promise<void> {
        if (!this.server) {
            return;
        }

        const server = this.server;
        this.server = null;
        this.bindHost = null;
        this.bindPort = null;
        this.localTargetHost = null;

        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }

    getExposure(): TeamClusterServiceExposure {
        if (!this.bindHost || !this.bindPort || !this.localTargetHost) {
            throw new Error('Object gateway server is not listening');
        }

        return {
            id: OBJECT_GATEWAY_EXPOSURE_ID,
            teamClusterId: this.config.teamClusterId,
            teamId: this.config.teamId || this.config.teamClusterId,
            sourceKind: TeamClusterServiceExposureSourceKind.Daemon,
            exposureName: OBJECT_GATEWAY_EXPOSURE_NAME,
            accessModes: [TeamClusterServiceExposureAccessMode.Http],
            targetHost: this.localTargetHost,
            targetPort: this.bindPort,
            status: TeamClusterServiceExposureStatus.Active,
            labels: {
                'volt.exposure.api-version': 'v1',
                'volt.exposure.service': OBJECT_GATEWAY_EXPOSURE_NAME,
                'volt.exposure.source-kind': TeamClusterServiceExposureSourceKind.Daemon
            }
        };
    }

    private async handleRequest(
        request: IncomingMessage,
        response: ServerResponse<IncomingMessage>
    ): Promise<void> {
        if (!request.url) {
            throw new ObjectGatewayHttpError(400, 'Request URL is required');
        }

        this.authorizeRequest(request);

        const url = new URL(request.url, 'http://127.0.0.1');
        const resolvedRoute = this.resolveRoute(url.pathname);
        const operation = this.resolveOperation(request, resolvedRoute.type);
        const tracker = this.telemetryService.beginRequest(operation);

        try {
            this.ensureAllowedBucket(resolvedRoute.bucket);

            if (resolvedRoute.type === 'collection') {
                await this.handleCollectionRequest(request, response, url, resolvedRoute.bucket, tracker);
                return;
            }

            await this.handleObjectRequest(request, response, resolvedRoute.bucket, resolvedRoute.objectKey, tracker);
        } catch (error) {
            tracker.complete({
                statusCode: this.resolveErrorStatusCode(error),
                error
            });
            throw error;
        }
    }

    private resolveOperation(
        request: IncomingMessage,
        routeType: 'collection' | 'object'
    ): ObjectGatewayOperationName {
        if (routeType === 'collection') {
            if (request.method === 'GET') {
                return 'list';
            }

            return 'delete-prefix';
        }

        if (request.method === 'HEAD') {
            return 'head';
        }

        if (request.method === 'GET') {
            return 'get';
        }

        if (request.method === 'PUT') {
            return 'put';
        }

        return 'delete';
    }

    private resolveRoute(pathname: string): { bucket: string; type: 'collection'; } | { bucket: string; type: 'object'; objectKey: string; } {
        if (!pathname.startsWith(OBJECT_GATEWAY_BUCKETS_PATH)) {
            throw new ObjectGatewayHttpError(404, 'Object gateway route not found');
        }

        const bucketPath = pathname.slice(OBJECT_GATEWAY_BUCKETS_PATH.length);
        const firstSlashIndex = bucketPath.indexOf('/');
        if (firstSlashIndex < 0) {
            throw new ObjectGatewayHttpError(404, 'Object gateway route not found');
        }

        const bucket = decodePathComponent(bucketPath.slice(0, firstSlashIndex), 'bucket');
        const remainder = bucketPath.slice(firstSlashIndex);

        if (remainder === '/objects' || remainder === '/objects/') {
            return {
                bucket,
                type: 'collection'
            };
        }

        if (!remainder.startsWith('/objects/')) {
            throw new ObjectGatewayHttpError(404, 'Object gateway route not found');
        }

        const encodedObjectKey = remainder.slice('/objects/'.length);
        if (!encodedObjectKey) {
            throw new ObjectGatewayHttpError(400, 'objectKey is required');
        }

        return {
            bucket,
            type: 'object',
            objectKey: decodePathComponent(encodedObjectKey, 'objectKey')
        };
    }

    private ensureAllowedBucket(bucket: string): void {
        if (this.allowedBuckets.has(bucket)) {
            return;
        }

        throw new ObjectGatewayHttpError(403, `Bucket is not allowed: ${bucket}`);
    }

    private async handleCollectionRequest(
        request: IncomingMessage,
        response: ServerResponse<IncomingMessage>,
        url: URL,
        bucket: string,
        tracker: ReturnType<ObjectGatewayTelemetryService['beginRequest']>
    ): Promise<void> {
        if (request.method === 'GET') {
            this.runtimeCapabilityGuard?.ensureServesStorageReads('object-gateway.list');
            const limit = Math.min(
                readInteger(url.searchParams.get('limit'), 'limit', DEFAULT_LIST_LIMIT),
                MAX_LIST_LIMIT
            );
            const result = await this.minioService.listObjectsPage({
                bucket,
                prefix: url.searchParams.get('prefix') || '',
                cursor: url.searchParams.get('cursor') || undefined,
                limit
            });

            const bytesOut = this.writeJson(response, 200, {
                keys: result.keys,
                nextCursor: result.nextCursor
            });
            tracker.complete({
                statusCode: 200,
                bytesOut
            });
            return;
        }

        if (request.method === 'DELETE') {
            this.runtimeCapabilityGuard?.ensureServesStorageReads('object-gateway.delete-prefix');
            const prefix = url.searchParams.get('prefix');
            if (prefix === null) {
                throw new ObjectGatewayHttpError(400, 'prefix query parameter is required');
            }

            const deletedCount = await this.minioService.deleteByPrefix(bucket, prefix);
            const bytesOut = this.writeJson(response, 200, {
                deleted: true,
                deletedCount
            });
            tracker.complete({
                statusCode: 200,
                bytesOut
            });
            return;
        }

        throw new ObjectGatewayHttpError(405, `Unsupported method for object collection: ${request.method || 'unknown'}`);
    }

    private async handleObjectRequest(
        request: IncomingMessage,
        response: ServerResponse<IncomingMessage>,
        bucket: string,
        objectKey: string,
        tracker: ReturnType<ObjectGatewayTelemetryService['beginRequest']>
    ): Promise<void> {
        if (request.method === 'HEAD') {
            this.runtimeCapabilityGuard?.ensureServesStorageReads('object-gateway.head');
            const stat = await this.readObjectStat(bucket, objectKey);
            this.writeObjectHeaders(response, stat);
            response.statusCode = 200;
            response.end();
            tracker.complete({
                statusCode: 200
            });
            return;
        }

        if (request.method === 'GET') {
            this.runtimeCapabilityGuard?.ensureServesStorageReads('object-gateway.get');
            const stat = await this.readObjectStat(bucket, objectKey);
            const stream = await this.readObjectStream(bucket, objectKey);

            this.writeObjectHeaders(response, stat);
            response.statusCode = 200;
            let bytesOut = 0;

            await new Promise<void>((resolve, reject) => {
                stream.on('data', (chunk) => {
                    bytesOut += chunk.length;
                    tracker.markFirstByte();
                });
                stream.once('error', reject);
                response.once('finish', resolve);
                response.once('close', resolve);
                stream.pipe(response);
            });

            tracker.complete({
                statusCode: 200,
                bytesOut
            });

            return;
        }

        if (request.method === 'PUT') {
            this.runtimeCapabilityGuard?.ensureAcceptsStorageWrites('object-gateway.put');
            const contentLengthHeader = readSingleHeaderValue(request.headers['content-length']);
            const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;

            if (!Number.isFinite(contentLength) || contentLength < 0) {
                throw new ObjectGatewayHttpError(400, 'content-length header is required for uploads');
            }

            await this.minioService.putObjectStream({
                bucket,
                objectKey,
                stream: request,
                size: contentLength,
                metadata: this.readUploadMetadata(request.headers)
            });

            response.statusCode = 201;
            response.end();
            tracker.complete({
                statusCode: 201,
                bytesIn: contentLength
            });
            return;
        }

        if (request.method === 'DELETE') {
            this.runtimeCapabilityGuard?.ensureServesStorageReads('object-gateway.delete');
            await this.readObjectStat(bucket, objectKey);
            await this.minioService.removeObject(bucket, objectKey);
            response.statusCode = 204;
            response.end();
            tracker.complete({
                statusCode: 204
            });
            return;
        }

        throw new ObjectGatewayHttpError(405, `Unsupported method for object resource: ${request.method || 'unknown'}`);
    }

    private async readObjectStat(bucket: string, objectKey: string): Promise<ObjectStatLike> {
        try {
            return await this.minioService.statObject(bucket, objectKey) as ObjectStatLike;
        } catch (error) {
            if (isMinioNotFoundError(error)) {
                throw new ObjectGatewayHttpError(404, `Object not found: ${bucket}/${objectKey}`);
            }

            throw error;
        }
    }

    private async readObjectStream(bucket: string, objectKey: string) {
        try {
            return await this.minioService.getObjectStream(bucket, objectKey);
        } catch (error) {
            if (isMinioNotFoundError(error)) {
                throw new ObjectGatewayHttpError(404, `Object not found: ${bucket}/${objectKey}`);
            }

            throw error;
        }
    }

    private readUploadMetadata(headers: IncomingMessage['headers']): Record<string, string> | undefined {
        const metadata: Record<string, string> = {};
        const contentType = readSingleHeaderValue(headers['content-type']);
        const contentEncoding = readSingleHeaderValue(headers['content-encoding']);

        if (contentType) {
            metadata['Content-Type'] = contentType;
        }

        if (contentEncoding) {
            metadata['Content-Encoding'] = contentEncoding;
        }

        for (const [headerName, headerValue] of Object.entries(headers)) {
            if (!headerName.toLowerCase().startsWith(OBJECT_METADATA_HEADER_PREFIX) || !headerValue) {
                continue;
            }

            const headerSuffix = headerName.slice(OBJECT_METADATA_HEADER_PREFIX.length);
            const singleValue = readSingleHeaderValue(headerValue);
            if (!headerSuffix || !singleValue) {
                continue;
            }

            metadata[`${MINIO_METADATA_HEADER_PREFIX}${headerSuffix}`] = singleValue;
        }

        return Object.keys(metadata).length > 0
            ? metadata
            : undefined;
    }

    private writeObjectHeaders(
        response: ServerResponse<IncomingMessage>,
        stat: ObjectStatLike
    ): void {
        const metadata = stat.metaData || {};
        const contentType = typeof metadata['content-type'] === 'string'
            ? metadata['content-type']
            : 'application/octet-stream';
        const contentEncoding = typeof metadata['content-encoding'] === 'string'
            ? metadata['content-encoding']
            : undefined;
        const contentLength = typeof stat.size === 'number'
            ? stat.size
            : undefined;
        const etag = typeof stat.etag === 'string'
            ? stat.etag
            : undefined;
        const lastModified = stat.lastModified instanceof Date
            ? stat.lastModified.toUTCString()
            : undefined;

        response.setHeader('content-type', contentType);

        if (typeof contentLength === 'number') {
            response.setHeader('content-length', String(contentLength));
        }

        if (contentEncoding) {
            response.setHeader('content-encoding', contentEncoding);
        }

        if (etag) {
            response.setHeader('etag', etag);
        }

        if (lastModified) {
            response.setHeader('last-modified', lastModified);
        }

        for (const [metadataKey, metadataValue] of Object.entries(metadata)) {
            if (!metadataKey.startsWith(MINIO_METADATA_HEADER_PREFIX) || typeof metadataValue !== 'string') {
                continue;
            }

            response.setHeader(
                `${OBJECT_METADATA_HEADER_PREFIX}${metadataKey.slice(MINIO_METADATA_HEADER_PREFIX.length)}`,
                metadataValue
            );
        }
    }

    private writeJson(
        response: ServerResponse<IncomingMessage>,
        statusCode: number,
        payload: Record<string, unknown>
    ): number {
        const body = Buffer.from(JSON.stringify(payload));
        response.statusCode = statusCode;
        response.setHeader('content-type', 'application/json');
        response.setHeader('content-length', String(body.length));
        response.end(body);
        return body.length;
    }

    private resolveErrorStatusCode(error: unknown): number {
        if (error instanceof ObjectGatewayHttpError) {
            return error.statusCode;
        }

        if (error instanceof RuntimeCapabilityError) {
            return error.statusCode;
        }

        return 500;
    }

    private handleRequestFailure(
        response: ServerResponse<IncomingMessage>,
        error: unknown
    ): void {
        if (response.headersSent) {
            response.destroy(error instanceof Error ? error : new Error('Object gateway request failed'));
            return;
        }

        if (error instanceof ObjectGatewayHttpError) {
            this.writeJson(response, error.statusCode, {
                message: error.message
            });
            return;
        }

        if (error instanceof RuntimeCapabilityError) {
            this.writeJson(response, error.statusCode, {
                code: error.code,
                message: error.message
            });
            return;
        }

        logger.error({ err: error }, 'Object gateway request failed');
        this.writeJson(response, 500, {
            message: 'Object gateway request failed'
        });
    }

    private authorizeRequest(request: IncomingMessage): void {
        const token = readSingleHeaderValue(request.headers[TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER]);
        if (!token) {
            throw new ObjectGatewayHttpError(401, 'Direct access token is required');
        }

        const claims = verifyTeamClusterDirectAccessToken(this.config.daemonPassword, token);
        if (
            !claims
            || claims.ownerClusterId !== this.config.teamClusterId
            || claims.exposureId !== OBJECT_GATEWAY_EXPOSURE_ID
            || claims.exposureName !== OBJECT_GATEWAY_EXPOSURE_NAME
            || claims.accessMode !== TeamClusterServiceExposureAccessMode.Http
        ) {
            throw new ObjectGatewayHttpError(401, 'Direct access token is invalid or expired');
        }
    }
}

export const OBJECT_GATEWAY_EXPOSURE = Object.freeze({
    id: OBJECT_GATEWAY_EXPOSURE_ID,
    exposureName: OBJECT_GATEWAY_EXPOSURE_NAME
});
