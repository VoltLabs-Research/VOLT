import { TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER, TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER, TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureSourceKind, TeamClusterServiceExposureStatus, type TeamClusterServiceExposure } from '@/contracts';
import { logger } from '@/core/logger';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { DaemonConfig } from '@/core/config';
import type { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import type { Server } from 'node:http';
import type { ObjectGatewayTelemetryService } from '@/core/observability/infrastructure/ObjectGatewayTelemetryService';

const OBJECT_GATEWAY_API_BASE_PATH = '/internal/object-gateway/v1';
const OBJECT_GATEWAY_BUCKETS_PATH = `${OBJECT_GATEWAY_API_BASE_PATH}/buckets/`;
const OBJECT_GATEWAY_EXPOSURE_ID = 'daemon:object-gateway';
const OBJECT_GATEWAY_EXPOSURE_NAME = 'object-gateway';
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 1_000;
const OBJECT_METADATA_HEADER_PREFIX = 'x-object-meta-';
const MINIO_METADATA_HEADER_PREFIX = 'x-amz-meta-';
const LOOPBACK_HOST = '127.0.0.1';

const OBJECT_COLLECTION_ROUTE = `${OBJECT_GATEWAY_BUCKETS_PATH}:bucket/objects`;

type ObjectGatewayCollectionOperation = 'list' | 'delete-prefix';
type ObjectGatewayObjectOperation = 'head' | 'get' | 'put' | 'delete';

const isWildcardHost = (value: string): boolean => {
    return value === '0.0.0.0' || value === '::' || value === '[::]';
};

interface ObjectStatLike {
    size?: unknown;
    etag?: unknown;
    lastModified?: unknown;
    metaData?: Record<string, unknown>;
};

interface ObjectGatewayCapabilityGuard {
    ensureServesStorageReads(command: string): void;
    ensureAcceptsStorageWrites(command: string): void;
}

interface ObjectGatewayDirectAccessClaims {
    ownerClusterId: string;
    exposureId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

interface ObjectGatewaySecurity {
    capabilityGuard?: ObjectGatewayCapabilityGuard;
    verifyDirectAccessToken?: (token: string) => ObjectGatewayDirectAccessClaims | null;
}

interface StatusCodeError {
    code?: unknown;
    message: string;
    statusCode: number;
}

class ObjectGatewayHttpError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        Object.setPrototypeOf(this, ObjectGatewayHttpError.prototype);
    }
}

const isStatusCodeError = (error: unknown): error is StatusCodeError => {
    return typeof error === 'object'
        && error !== null
        && typeof (error as { statusCode?: unknown }).statusCode === 'number'
        && typeof (error as { message?: unknown }).message === 'string';
};

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

const readBooleanHeader = (value: string | string[] | undefined): boolean => {
    const rawValue = readSingleHeaderValue(value);
    return rawValue === '1' || rawValue === 'true';
};

const readInteger = (rawValue: string | undefined, fieldName: string, fallback: number): number => {
    if (!rawValue) {
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

const normalizeObjectMetadata = (metadata: Record<string, unknown> | undefined): Record<string, string> => {
    const normalizedMetadata: Record<string, string> = {};

    for (const [key, value] of Object.entries(metadata ?? {})) {
        if (typeof value === 'string') {
            normalizedMetadata[key.toLowerCase()] = value;
        }
    }

    return normalizedMetadata;
};

export class ObjectGatewayServer {
    private readonly app = express();
    private server: Server | null = null;
    private bindHost: string | null = null;
    private bindPort: number | null = null;
    private localTargetHost: string | null = null;
    private readonly allowedBuckets: Set<string>;

    constructor(
        private readonly config: DaemonConfig,
        private readonly minioService: MinioService,
        private readonly telemetryService: ObjectGatewayTelemetryService,
        private readonly security: ObjectGatewaySecurity = {}
    ) {
        this.allowedBuckets = new Set(this.minioService.listBuckets());
        this.configureRoutes();
    }

    async start(): Promise<void> {
        if (this.server && this.bindHost && this.bindPort) {
            return;
        }

        this.server = await new Promise<Server>((resolve, reject) => {
            const server = this.app.listen(this.config.port, this.config.host, () => {
                resolve(server);
            });

            server.once('error', reject);
        });

        const address = this.server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Object gateway server did not expose a TCP address');
        }

        this.bindHost = address.address;
        this.bindPort = address.port;
        this.localTargetHost = isWildcardHost(address.address)
            ? LOOPBACK_HOST
            : address.address;

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

    private configureRoutes(): void {
        this.app.disable('x-powered-by');

        this.app.use((request, _response, next) => {
            try {
                this.authorizeRequest(request);
                next();
            } catch (error) {
                next(error);
            }
        });

        this.app.get(OBJECT_COLLECTION_ROUTE, (request, response, next) => {
            this.handleCollectionRequest(request, response, 'list').catch(next);
        });

        this.app.delete(OBJECT_COLLECTION_ROUTE, (request, response, next) => {
            this.handleCollectionRequest(request, response, 'delete-prefix').catch(next);
        });

        this.app.all(OBJECT_COLLECTION_ROUTE, (request, _response, next) => {
            next(new ObjectGatewayHttpError(405, `Unsupported method for object collection: ${request.method}`));
        });

        this.app.use(OBJECT_COLLECTION_ROUTE, (request, response, next) => {
            this.handleObjectRoute(request, response).catch(next);
        });

        this.app.use((_request, _response, next) => {
            next(new ObjectGatewayHttpError(404, 'Object gateway route not found'));
        });

        this.app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
            this.handleRequestFailure(response, error);
        });
    }

    private async handleCollectionRequest(
        request: Request<{ bucket: string }>,
        response: Response,
        operation: ObjectGatewayCollectionOperation
    ): Promise<void> {
        const tracker = this.telemetryService.beginRequest(operation);

        try {
            const bucket = decodePathComponent(request.params.bucket, 'bucket');
            this.ensureAllowedBucket(bucket);

            if (operation === 'list') {
                this.security.capabilityGuard?.ensureServesStorageReads('object-gateway.list');
                const limit = Math.min(
                    readInteger(this.readQueryValue(request.query.limit), 'limit', DEFAULT_LIST_LIMIT),
                    MAX_LIST_LIMIT
                );
                const result = await this.minioService.listObjectsPage({
                    bucket,
                    prefix: this.readQueryValue(request.query.prefix) ?? '',
                    cursor: this.readQueryValue(request.query.cursor),
                    limit
                });
                const bytesOut = this.writeJson(response, 200, result as unknown as Record<string, unknown>);

                tracker.complete({
                    statusCode: 200,
                    bytesOut
                });

                return;
            }

                this.security.capabilityGuard?.ensureAcceptsStorageWrites('object-gateway.delete-prefix');
            const prefix = this.readQueryValue(request.query.prefix);
            if (prefix === undefined) {
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
        } catch (error) {
            tracker.complete({
                statusCode: error instanceof ObjectGatewayHttpError || isStatusCodeError(error)
                    ? error.statusCode
                    : 500,
                error
            });
            throw error;
        }
    }

    private async handleObjectRoute(
        request: Request<{ bucket: string }>,
        response: Response
    ): Promise<void> {
        const objectKeyPath = request.path.replace(/^\/+/, '');
        if (!objectKeyPath) {
            throw new ObjectGatewayHttpError(404, 'Object gateway route not found');
        }

        const operation = this.readObjectOperation(request.method);
        const tracker = this.telemetryService.beginRequest(operation);

        try {
            const bucket = decodePathComponent(request.params.bucket, 'bucket');
            const objectKey = decodePathComponent(objectKeyPath, 'objectKey');
            this.ensureAllowedBucket(bucket);

            if (operation === 'head') {
                this.security.capabilityGuard?.ensureServesStorageReads('object-gateway.head');
                const stat = await this.readObjectStat(bucket, objectKey);
                this.writeObjectHeaders(response, stat);
                response.status(200).end();

                tracker.complete({
                    statusCode: 200
                });

                return;
            }

            if (operation === 'get') {
                this.security.capabilityGuard?.ensureServesStorageReads('object-gateway.get');
                const skipMetadata = readBooleanHeader(request.headers[TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER]);
                const [stat, stream] = skipMetadata
                    ? [null, await this.readObjectStream(bucket, objectKey)] as const
                    : await Promise.all([
                        this.readObjectStat(bucket, objectKey),
                        this.readObjectStream(bucket, objectKey)
                    ]);

                if (stat) {
                    this.writeObjectHeaders(response, stat);
                }

                response.status(200);
                let bytesOut = 0;
                let statusCode = 200;

                await new Promise<void>((resolve, reject) => {
                    const handleFinish = (): void => {
                        cleanup();
                        resolve();
                    };
                    const handleClose = (): void => {
                        if (!response.writableEnded) {
                            statusCode = 499;
                            stream.destroy();
                        }

                        cleanup();
                        resolve();
                    };
                    const handleError = (error: Error): void => {
                        cleanup();
                        reject(error);
                    };
                    const cleanup = (): void => {
                        stream.removeListener('error', handleError);
                        response.removeListener('finish', handleFinish);
                        response.removeListener('close', handleClose);
                    };

                    stream.on('data', (chunk) => {
                        bytesOut += chunk.length;
                        tracker.markFirstByte();
                    });
                    stream.once('error', handleError);
                    response.once('finish', handleFinish);
                    response.once('close', handleClose);
                    stream.pipe(response);
                });

                tracker.complete({
                    statusCode,
                    bytesOut
                });

                return;
            }

            if (operation === 'put') {
                this.security.capabilityGuard?.ensureAcceptsStorageWrites('object-gateway.put');
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

                response.status(201).end();
                tracker.complete({
                    statusCode: 201,
                    bytesIn: contentLength
                });

                return;
            }

            this.security.capabilityGuard?.ensureAcceptsStorageWrites('object-gateway.delete');
            await this.readObjectStat(bucket, objectKey);
            await this.minioService.removeObject(bucket, objectKey);
            response.status(204).end();
            tracker.complete({
                statusCode: 204
            });
        } catch (error) {
            tracker.complete({
                statusCode: error instanceof ObjectGatewayHttpError || isStatusCodeError(error)
                    ? error.statusCode
                    : 500,
                error
            });
            throw error;
        }
    }

    private ensureAllowedBucket(bucket: string): void {
        if (!this.allowedBuckets.has(bucket)) {
            throw new ObjectGatewayHttpError(403, `Bucket is not allowed: ${bucket}`);
        }
    }

    private readObjectOperation(method: string): ObjectGatewayObjectOperation {
        if (method === 'HEAD') return 'head';
        if (method === 'GET') return 'get';
        if (method === 'PUT') return 'put';
        if (method === 'DELETE') return 'delete';
        throw new ObjectGatewayHttpError(405, `Unsupported method for object resource: ${method || 'unknown'}`);
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

    private readUploadMetadata(headers: Request['headers']): Record<string, string> | undefined {
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
            if (headerSuffix && singleValue) {
                metadata[`${MINIO_METADATA_HEADER_PREFIX}${headerSuffix}`] = singleValue;
            }
        }

        return Object.keys(metadata).length > 0
            ? metadata
            : undefined;
    }

    private writeObjectHeaders(response: Response, stat: ObjectStatLike): void {
        const metadata = normalizeObjectMetadata(stat.metaData);
        const contentType = metadata['content-type'] || 'application/octet-stream';
        const contentEncoding = metadata['content-encoding'];
        const contentLength = typeof stat.size === 'number' ? stat.size : undefined;
        const etag = typeof stat.etag === 'string' ? stat.etag : undefined;
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
            if (metadataKey.startsWith(MINIO_METADATA_HEADER_PREFIX)) {
                response.setHeader(
                    `${OBJECT_METADATA_HEADER_PREFIX}${metadataKey.slice(MINIO_METADATA_HEADER_PREFIX.length)}`,
                    metadataValue
                );
            }
        }
    }

    private writeJson(response: Response, statusCode: number, payload: Record<string, unknown>): number {
        const body = Buffer.from(JSON.stringify(payload));
        response.status(statusCode);
        response.setHeader('content-type', 'application/json');
        response.setHeader('content-length', String(body.length));
        response.end(body);
        return body.length;
    }

    private handleRequestFailure(response: Response, error: unknown): void {
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

        if (isStatusCodeError(error)) {
            this.writeJson(response, error.statusCode, {
                ...(typeof error.code === 'string' ? { code: error.code } : {}),
                message: error.message
            });
            return;
        }

        logger.error({ err: error }, 'Object gateway request failed');
        this.writeJson(response, 500, {
            message: 'Object gateway request failed'
        });
    }

    private authorizeRequest(request: Request): void {
        const token = readSingleHeaderValue(request.headers[TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER]);
        if (!token) {
            throw new ObjectGatewayHttpError(401, 'Direct access token is required');
        }

        const claims = this.security.verifyDirectAccessToken?.(token) ?? null;
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

    private readQueryValue(value: unknown): string | undefined {
        if (typeof value === 'string') {
            return value;
        }

        if (Array.isArray(value)) {
            return typeof value[0] === 'string' ? value[0] : undefined;
        }

        return undefined;
    }
}

export const OBJECT_GATEWAY_EXPOSURE = Object.freeze({
    id: OBJECT_GATEWAY_EXPOSURE_ID,
    exposureName: OBJECT_GATEWAY_EXPOSURE_NAME
});
