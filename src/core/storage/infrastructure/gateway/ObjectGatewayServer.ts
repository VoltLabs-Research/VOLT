import { TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureSourceKind, TeamClusterServiceExposureStatus } from '@/core/runtime/contracts/service-exposure';
import { Factory } from '@/core/decorators/service';
import { TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER, TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER } from '@/core/storage/contracts/http-object-store';
import type { LocalClusterObjectStat, LocalClusterObjectStoreGateway } from '@/core/storage/contracts/cluster-object-store';
import type { ObjectGatewayDirectAccessClaims, ObjectGatewaySecurity } from '@/core/storage/contracts/object-gateway';
import { logger } from '@/core/logger';
import type { DaemonConfig } from '@/core/config';
import ApplicationError from '@/app/coordination/ApplicationError';
import type { TeamClusterServiceExposure } from '@/core/runtime/contracts/service-exposure';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ObjectGatewayTelemetry } from '@/core/observability/infrastructure/ObjectGatewayTelemetry';
import type { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import { verifyTeamClusterDirectAccessToken } from '@/modules/container/application/access/team-cluster-direct-access-token-verifier';
import type { Readable } from 'node:stream';
import express, { type NextFunction, type Request, type Response } from 'express';

type ObjectGatewayCollectionOperation = 'list' | 'delete-prefix';
type ObjectGatewayObjectOperation = 'head' | 'get' | 'put' | 'delete';

interface StatusCodeError extends Error {
    code?: string;
    statusCode: number;
}

interface ObjectGatewayRouteParams {
    bucket: string;
}

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

export class ObjectGatewayServer {
    private readonly app = express();
    private server: Server | null = null;
    private bindHost: string | null = null;
    private bindPort: number | null = null;
    private localTargetHost: string | null = null;
    private exposure: TeamClusterServiceExposure | null = null;
    private readonly allowedBuckets: Set<string>;

    constructor(
        private readonly config: DaemonConfig,
        private readonly objectStore: LocalClusterObjectStoreGateway,
        private readonly telemetryService: ObjectGatewayTelemetry,
        private readonly security: ObjectGatewaySecurity = {}
    ) {
        this.allowedBuckets = new Set(this.objectStore.listBuckets());
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

        const address = this.server.address() as AddressInfo | null;
        if (!address) {
            throw new Error('Object gateway server did not expose a TCP address');
        }

        this.bindHost = address.address;
        this.bindPort = address.port;
        this.localTargetHost = address.address === '0.0.0.0' || address.address === '::' || address.address === '[::]'
            ? LOOPBACK_HOST
            : address.address;
        this.exposure = {
            id: OBJECT_GATEWAY_EXPOSURE_ID,
            teamClusterId: this.config.teamClusterId,
            teamId: this.config.teamId ?? this.config.teamClusterId,
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

        logger.info(`Started daemon object gateway for teamClusterId=${this.config.teamClusterId}, host=${this.bindHost}, port=${this.bindPort}`);
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
        this.exposure = null;

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
        if (this.exposure === null) {
            throw new Error('Object gateway server is not listening');
        }

        return this.exposure;
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
            this.handleCollectionRequest('list', request, response, next);
        });

        this.app.delete(OBJECT_COLLECTION_ROUTE, (request, response, next) => {
            this.handleCollectionRequest('delete-prefix', request, response, next);
        });

        this.app.all(OBJECT_COLLECTION_ROUTE, (request, _response, next) => {
            next(new ApplicationError(
                'ObjectGateway::UnsupportedCollectionMethod',
                `Unsupported method for object collection: ${request.method}`,
                405
            ));
        });

        this.app.use(OBJECT_COLLECTION_ROUTE, (request, response, next) => {
            this.handleObjectRoute(request, response).catch(next);
        });

        this.app.use((_request, _response, next) => {
            next(new ApplicationError('ObjectGateway::RouteNotFound', 'Object gateway route not found', 404));
        });

        this.app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
            this.handleRequestFailure(response, error);
        });
    }

    private async handleCollectionRequest(
        operation: ObjectGatewayCollectionOperation,
        request: Request<ObjectGatewayRouteParams>,
        response: Response,
        next: NextFunction
    ): Promise<void> {
        const tracker = this.telemetryService.beginRequest(operation);

        try {
            const searchParams = new URL(request.originalUrl, 'http://localhost').searchParams;
            const bucket = this.readAllowedBucket(request.params.bucket);

            if (operation === 'list') {
                await this.handleListCollectionRequest(bucket, searchParams, response, tracker);
                return;
            }

            await this.handleDeletePrefixCollectionRequest(bucket, searchParams, response, tracker);
        } catch (error) {
            const statusCode = (error as Partial<StatusCodeError>).statusCode;
            tracker.complete({
                statusCode: error instanceof ApplicationError || statusCode !== undefined ? statusCode as number : 500,
                hasError: true
            });
            next(error);
        }
    }

    private async handleObjectRoute(
        request: Request<ObjectGatewayRouteParams>,
        response: Response
    ): Promise<void> {
        const objectKeyPath = request.path.replace(/^\/+/, '');
        if (!objectKeyPath) {
            throw new ApplicationError('ObjectGateway::RouteNotFound', 'Object gateway route not found', 404);
        }

        const operation = this.readObjectOperation(request.method);
        const tracker = this.telemetryService.beginRequest(operation);

        try {
            const bucket = this.readAllowedBucket(request.params.bucket);
            const objectKey = this.decodePathComponent(objectKeyPath, 'objectKey');

            if (operation === 'head') {
                await this.handleHeadObjectRequest(bucket, objectKey, response, tracker);
                return;
            }

            if (operation === 'get') {
                await this.handleGetObjectRequest(request, bucket, objectKey, response, tracker);
                return;
            }

            if (operation === 'put') {
                await this.handlePutObjectRequest(request, bucket, objectKey, response, tracker);
                return;
            }

            await this.handleDeleteObjectRequest(bucket, objectKey, response, tracker);
        } catch (error) {
            const statusCode = (error as Partial<StatusCodeError>).statusCode;
            tracker.complete({
                statusCode: error instanceof ApplicationError || statusCode !== undefined ? statusCode as number : 500,
                hasError: true
            });
            throw error;
        }
    }

    private readAllowedBucket(encodedBucket: string): string {
        const bucket = this.decodePathComponent(encodedBucket, 'bucket');
        if (!this.allowedBuckets.has(bucket)) {
            throw new ApplicationError('ObjectGateway::BucketNotAllowed', `Bucket is not allowed: ${bucket}`, 403);
        }

        return bucket;
    }

    private decodePathComponent(value: string, fieldName: string): string {
        try {
            return decodeURIComponent(value);
        } catch {
            throw new ApplicationError('ObjectGateway::InvalidPathEncoding', `${fieldName} contains invalid path encoding`, 400);
        }
    }

    private readContentLength(request: Pick<Request, 'get'>): number {
        const contentLength = Number(request.get('content-length'));
        if (!Number.isFinite(contentLength) || contentLength < 0 || !Number.isInteger(contentLength)) {
            throw new ApplicationError('ObjectGateway::MissingContentLength', 'content-length header is required for uploads', 400);
        }

        return contentLength;
    }

    private assertDirectAccessClaims(claims: ObjectGatewayDirectAccessClaims | null): void {
        if (
            !claims
            || claims.ownerClusterId !== this.config.teamClusterId
            || claims.exposureId !== OBJECT_GATEWAY_EXPOSURE_ID
            || claims.exposureName !== OBJECT_GATEWAY_EXPOSURE_NAME
            || claims.accessMode !== TeamClusterServiceExposureAccessMode.Http
        ) {
            throw new ApplicationError('ObjectGateway::InvalidDirectAccessToken', 'Direct access token is invalid or expired', 401);
        }
    }

    private async handleListCollectionRequest(
        bucket: string,
        searchParams: URLSearchParams,
        response: Response,
        tracker: ReturnType<ObjectGatewayTelemetry['beginRequest']>
    ): Promise<void> {
        const limitParam = searchParams.get('limit');
        const limit = limitParam === null ? DEFAULT_LIST_LIMIT : Number(limitParam);
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new ApplicationError('ObjectGateway::InvalidListLimit', 'limit must be a positive integer', 400);
        }

        const result = await this.objectStore.listObjectsPage({
            bucket,
            prefix: searchParams.get('prefix') ?? '',
            cursor: searchParams.get('cursor') ?? undefined,
            limit: Math.min(limit, MAX_LIST_LIMIT)
        });

        const bytesOut = this.writeJson(response, 200, result);
        tracker.complete({
            statusCode: 200,
            bytesOut
        });
    }

    private async handleDeletePrefixCollectionRequest(
        bucket: string,
        searchParams: URLSearchParams,
        response: Response,
        tracker: ReturnType<ObjectGatewayTelemetry['beginRequest']>
    ): Promise<void> {
        const prefix = searchParams.get('prefix');
        if (!prefix) {
            throw new ApplicationError('ObjectGateway::MissingPrefix', 'prefix query parameter is required', 400);
        }
        const deletedCount = await this.objectStore.deleteByPrefix(bucket, prefix);
        const bytesOut = this.writeJson(response, 200, {
            deleted: true,
            deletedCount
        });

        tracker.complete({
            statusCode: 200,
            bytesOut
        });
    }

    private async handleHeadObjectRequest(
        bucket: string,
        objectKey: string,
        response: Response,
        tracker: ReturnType<ObjectGatewayTelemetry['beginRequest']>
    ): Promise<void> {
        const stat = await this.readObjectStat(bucket, objectKey);
        this.writeObjectHeaders(response, stat);
        response.status(200).end();

        tracker.complete({
            statusCode: 200
        });
    }

    private async handleGetObjectRequest(
        request: Request<ObjectGatewayRouteParams>,
        bucket: string,
        objectKey: string,
        response: Response,
        tracker: ReturnType<ObjectGatewayTelemetry['beginRequest']>
    ): Promise<void> {
        const skipMetadataHeader = request.get(TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER);
        const skipMetadata = skipMetadataHeader === '1' || skipMetadataHeader === 'true';
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
    }

    private async handlePutObjectRequest(
        request: Request<ObjectGatewayRouteParams>,
        bucket: string,
        objectKey: string,
        response: Response,
        tracker: ReturnType<ObjectGatewayTelemetry['beginRequest']>
    ): Promise<void> {
        const contentLength = this.readContentLength(request);

        await this.objectStore.putObjectStream({
            bucket,
            objectKey,
            stream: request,
            size: contentLength,
            metadata: this.readUploadMetadata(request)
        });

        response.status(201).end();
        tracker.complete({
            statusCode: 201,
            bytesIn: contentLength
        });
    }

    private async handleDeleteObjectRequest(
        bucket: string,
        objectKey: string,
        response: Response,
        tracker: ReturnType<ObjectGatewayTelemetry['beginRequest']>
    ): Promise<void> {
        await this.readObjectStat(bucket, objectKey);
        await this.objectStore.removeObject(bucket, objectKey);
        response.status(204).end();
        tracker.complete({
            statusCode: 204
        });
    }

    private readObjectOperation(method: string): ObjectGatewayObjectOperation {
        if (method === 'HEAD') return 'head';
        if (method === 'GET') return 'get';
        if (method === 'PUT') return 'put';
        if (method === 'DELETE') return 'delete';
        throw new ApplicationError('ObjectGateway::UnsupportedObjectMethod', `Unsupported method for object resource: ${method}`, 405);
    }

    private async readObjectStat(bucket: string, objectKey: string): Promise<LocalClusterObjectStat> {
        try {
            return await this.objectStore.statObject(bucket, objectKey);
        } catch (error) {
            if (error instanceof Error && 'code' in error && (error.code === 'NotFound' || error.code === 'NoSuchKey')) {
                throw new ApplicationError('ObjectGateway::ObjectNotFound', `Object not found: ${bucket}/${objectKey}`, 404);
            }

            throw error;
        }
    }

    private async readObjectStream(bucket: string, objectKey: string): Promise<Readable> {
        try {
            return await this.objectStore.getObjectStream(bucket, objectKey);
        } catch (error) {
            if (error instanceof Error && 'code' in error && (error.code === 'NotFound' || error.code === 'NoSuchKey')) {
                throw new ApplicationError('ObjectGateway::ObjectNotFound', `Object not found: ${bucket}/${objectKey}`, 404);
            }

            throw error;
        }
    }

    private readUploadMetadata(request: Request<ObjectGatewayRouteParams>): Record<string, string> | undefined {
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
            if (!headerName.toLowerCase().startsWith(OBJECT_METADATA_HEADER_PREFIX)) {
                continue;
            }

            const headerSuffix = headerName.slice(OBJECT_METADATA_HEADER_PREFIX.length);
            const singleValue = request.get(headerName);
            if (headerSuffix && singleValue) {
                metadata[`${MINIO_METADATA_HEADER_PREFIX}${headerSuffix}`] = singleValue;
            }
        }

        return Object.keys(metadata).length > 0 ? metadata : undefined;
    }

    private writeObjectHeaders(response: Response, stat: LocalClusterObjectStat): void {
        const metadata: Record<string, string> = {};
        const sourceMetadata = stat.metaData as Record<string, string>;

        for (const [key, value] of Object.entries(sourceMetadata)) {
            metadata[key.toLowerCase()] = value;
        }

        const contentType = metadata['content-type'];
        const contentEncoding = metadata['content-encoding'];

        if (contentType) {
            response.setHeader('content-type', contentType);
        }

        response.setHeader('content-length', stat.size);

        if (contentEncoding) {
            response.setHeader('content-encoding', contentEncoding);
        }

        if (stat.etag) {
            response.setHeader('etag', stat.etag);
        }

        if (stat.lastModified) {
            response.setHeader('last-modified', stat.lastModified.toUTCString());
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

    private writeJson(response: Response, statusCode: number, payload: object): number {
        const body = Buffer.from(JSON.stringify(payload));
        response.status(statusCode);
        response.setHeader('content-type', 'application/json');
        response.setHeader('content-length', body.length);
        response.end(body);
        return body.length;
    }

    private handleRequestFailure(response: Response, error: Error): void {
        if (response.headersSent) {
            response.destroy(error);
            return;
        }

        if (error instanceof ApplicationError) {
            this.writeJson(response, error.statusCode, {
                code: error.code,
                message: error.message
            });
            return;
        }

        const statusCodeError = error as Partial<StatusCodeError>;
        if (statusCodeError.statusCode !== undefined) {
            this.writeJson(response, statusCodeError.statusCode, {
                code: statusCodeError.code,
                message: error.message
            });
            return;
        }

        logger.error(`Object gateway request failed: ${error.message}`);
        this.writeJson(response, 500, {
            message: 'Object gateway request failed'
        });
    }

    private authorizeRequest(request: Request): void {
        const token = request.get(TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER);
        if (!token) {
            throw new ApplicationError('ObjectGateway::DirectAccessTokenRequired', 'Direct access token is required', 401);
        }

        const verifyDirectAccessToken = this.security.verifyDirectAccessToken;
        const claims = verifyDirectAccessToken ? verifyDirectAccessToken(token) : null;
        this.assertDirectAccessClaims(claims);
    }
}

export const OBJECT_GATEWAY_EXPOSURE = Object.freeze({
    id: OBJECT_GATEWAY_EXPOSURE_ID,
    exposureName: OBJECT_GATEWAY_EXPOSURE_NAME
});

export const provideObjectGatewayServer = Factory('objectGatewayServer')((
    config: DaemonConfig,
    minioService: MinioService,
    objectGatewayTelemetry: ObjectGatewayTelemetry
) => new ObjectGatewayServer(config, minioService, objectGatewayTelemetry, {
    verifyDirectAccessToken: (token) => verifyTeamClusterDirectAccessToken(config.daemonPassword, token)
}));
