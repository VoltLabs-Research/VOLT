import { ErrorCodes } from '@core/constants/error-codes';
import { singleton } from '@shared/application/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import { getMinioService } from '@shared/infrastructure/storage/MinioService';
import { TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureSourceKind, TeamClusterServiceExposureStatus } from '@shared/contracts/types/service-exposure';
import {
    TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER
} from '@shared/contracts/types/http-object-store';
import type {
    LocalClusterObjectComposeInput,
    LocalClusterObjectStat,
    LocalClusterObjectStoreGateway
} from '@shared/contracts/types/cluster-object-store';
import { isObjectNotFoundError } from '@shared/contracts/types/cluster-object-store';
import type { ObjectGatewayDirectAccessClaims, ObjectGatewaySecurity } from '@shared/contracts/types/object-gateway';
import { logger } from '@shared/infrastructure/logger';
import type { DaemonConfig } from '@core/config/daemon';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { TeamClusterServiceExposure } from '@shared/contracts/types/service-exposure';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { verifyTeamClusterDirectAccessToken } from '@shared/infrastructure/http/team-cluster-direct-access-token';
import { parseRangeHeader, type ObjectByteRange } from '@shared/infrastructure/http/object-gateway-range';
import { writeJson, writeRequestFailure } from '@shared/infrastructure/http/object-gateway-response';
import {
    readUploadMetadata,
    writeObjectHeaders,
    writePartialObjectHeaders
} from '@shared/infrastructure/http/object-gateway-headers';
import type { Readable } from 'node:stream';
import express, { type NextFunction, type Request, type Response } from 'express';

interface ObjectGatewayRouteParams {
    bucket: string;
}

/** Body of `POST .../objects/compose`, sent only by the VOLT server. */
type ObjectGatewayComposeRequest = Omit<LocalClusterObjectComposeInput, 'bucket'>;

const OBJECT_GATEWAY_API_BASE_PATH = '/internal/object-gateway/v1';
const OBJECT_GATEWAY_BUCKETS_PATH = `${OBJECT_GATEWAY_API_BASE_PATH}/buckets/`;
const OBJECT_GATEWAY_EXPOSURE_ID = 'daemon:object-gateway';
const OBJECT_GATEWAY_EXPOSURE_NAME = 'object-gateway';
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 1_000;
const LOOPBACK_HOST = '127.0.0.1';

const OBJECT_COLLECTION_ROUTE = `${OBJECT_GATEWAY_BUCKETS_PATH}:bucket/objects`;
const OBJECT_COMPOSE_ROUTE = `${OBJECT_COLLECTION_ROUTE}/compose`;

/*
 * The VOLT server pools keep-alive sessions over the reverse channel and holds
 * each one for TEAM_CLUSTER_OBJECT_GATEWAY_HTTP_SESSION_TTL_MS (30s by default).
 * Node would close an idle connection after 5s, so a pooled session reused after
 * that lands on a socket this side already reset — which the caller sees as a 500
 * `socket hang up`. Outliving the pool keeps the client the party that closes.
 */
const KEEP_ALIVE_TIMEOUT_MS = 120_000;
const HEADERS_TIMEOUT_MS = KEEP_ALIVE_TIMEOUT_MS + 10_000;

export class ObjectGatewayServer {
    private readonly app = express();
    private server: Server | null = null;
    private exposure: TeamClusterServiceExposure | null = null;
    private readonly allowedBuckets: Set<string>;

    constructor(
        private readonly config: DaemonConfig,
        private readonly objectStore: LocalClusterObjectStoreGateway,
        private readonly security: ObjectGatewaySecurity = {}
    ) {
        this.allowedBuckets = new Set(this.objectStore.listBuckets());
        this.configureRoutes();
    }

    async start(): Promise<void> {
        if (this.server) return;

        this.server = await new Promise<Server>((resolve, reject) => {
            const server = this.app.listen(this.config.port, this.config.host, () => {
                resolve(server);
            });

            server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
            server.headersTimeout = HEADERS_TIMEOUT_MS;
            server.once('error', reject);
        });

        const address = this.server.address() as AddressInfo | null;
        if (!address) {
            throw new Error('Object gateway server did not expose a TCP address');
        }

        const isWildcardHost = address.address === '0.0.0.0' || address.address === '::' || address.address === '[::]';
        this.exposure = {
            id: OBJECT_GATEWAY_EXPOSURE_ID,
            teamClusterId: this.config.teamClusterId,
            teamId: this.config.teamId ?? this.config.teamClusterId,
            sourceKind: TeamClusterServiceExposureSourceKind.Daemon,
            exposureName: OBJECT_GATEWAY_EXPOSURE_NAME,
            accessModes: [TeamClusterServiceExposureAccessMode.Http],
            targetHost: isWildcardHost ? LOOPBACK_HOST : address.address,
            targetPort: address.port,
            status: TeamClusterServiceExposureStatus.Active,
            labels: {
                'volt.exposure.api-version': 'v1',
                'volt.exposure.service': OBJECT_GATEWAY_EXPOSURE_NAME,
                'volt.exposure.source-kind': TeamClusterServiceExposureSourceKind.Daemon
            }
        };

        logger.info(`Started daemon object gateway for teamClusterId=${this.config.teamClusterId}, host=${address.address}, port=${address.port}`);
    }

    async stop(): Promise<void> {
        if (!this.server) return;

        const server = this.server;
        this.server = null;
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
            this.handleListObjects(request, response).catch(next);
        });

        this.app.delete(OBJECT_COLLECTION_ROUTE, (request, response, next) => {
            this.handleDeletePrefix(request, response).catch(next);
        });

        this.app.post(OBJECT_COMPOSE_ROUTE, express.json({ limit: '1mb' }), (request, response, next) => {
            this.handleCompose(request, response).catch(next);
        });

        this.app.all(OBJECT_COLLECTION_ROUTE, (request, _response, next) => {
            next(new ApplicationError(
                ErrorCodes.OBJECT_GATEWAY_UNSUPPORTED_COLLECTION_METHOD,
                `Unsupported method for object collection: ${request.method}`,
                405
            ));
        });

        this.app.use(OBJECT_COLLECTION_ROUTE, (request, response, next) => {
            this.handleObjectRoute(request, response).catch(next);
        });

        this.app.use((_request, _response, next) => {
            next(new ApplicationError(ErrorCodes.OBJECT_GATEWAY_ROUTE_NOT_FOUND, 'Object gateway route not found', 404));
        });

        this.app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
            writeRequestFailure(response, error);
        });
    }

    private async handleObjectRoute(request: Request<ObjectGatewayRouteParams>, response: Response): Promise<void> {
        const objectKeyPath = request.path.replace(/^\/+/, '');
        if (!objectKeyPath) {
            throw new ApplicationError(ErrorCodes.OBJECT_GATEWAY_ROUTE_NOT_FOUND, 'Object gateway route not found', 404);
        }

        const bucket = this.readAllowedBucket(request.params.bucket);
        const objectKey = this.decodePathComponent(objectKeyPath, 'objectKey');

        switch (request.method) {
            case 'HEAD':
                return this.handleHeadObject(bucket, objectKey, response);
            case 'GET':
                return this.handleGetObject(request, bucket, objectKey, response);
            case 'PUT':
                return this.handlePutObject(request, bucket, objectKey, response);
            case 'DELETE':
                return this.handleDeleteObject(bucket, objectKey, response);
            default:
                throw new ApplicationError(
                    ErrorCodes.OBJECT_GATEWAY_UNSUPPORTED_OBJECT_METHOD,
                    `Unsupported method for object resource: ${request.method}`,
                    405
                );
        }
    }

    private readAllowedBucket(encodedBucket: string): string {
        const bucket = this.decodePathComponent(encodedBucket, 'bucket');
        if (!this.allowedBuckets.has(bucket)) {
            throw new ApplicationError(ErrorCodes.OBJECT_GATEWAY_BUCKET_NOT_ALLOWED, `Bucket is not allowed: ${bucket}`, 403);
        }

        return bucket;
    }

    private decodePathComponent(value: string, fieldName: string): string {
        try {
            return decodeURIComponent(value);
        } catch {
            throw new ApplicationError(ErrorCodes.OBJECT_GATEWAY_INVALID_PATH_ENCODING, `${fieldName} contains invalid path encoding`, 400);
        }
    }

    private readSearchParams(request: Request<ObjectGatewayRouteParams>): URLSearchParams {
        return new URL(request.originalUrl, 'http://localhost').searchParams;
    }

    private async handleListObjects(request: Request<ObjectGatewayRouteParams>, response: Response): Promise<void> {
        const bucket = this.readAllowedBucket(request.params.bucket);
        const searchParams = this.readSearchParams(request);
        const limitParam = searchParams.get('limit');
        const limit = limitParam === null ? DEFAULT_LIST_LIMIT : Number(limitParam);
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new ApplicationError(ErrorCodes.OBJECT_GATEWAY_INVALID_LIST_LIMIT, 'limit must be a positive integer', 400);
        }

        const result = await this.objectStore.listObjectsPage({
            bucket,
            prefix: searchParams.get('prefix') ?? '',
            cursor: searchParams.get('cursor') ?? undefined,
            limit: Math.min(limit, MAX_LIST_LIMIT)
        });

        writeJson(response, 200, result);
    }

    private async handleDeletePrefix(request: Request<ObjectGatewayRouteParams>, response: Response): Promise<void> {
        const bucket = this.readAllowedBucket(request.params.bucket);
        const prefix = this.readSearchParams(request).get('prefix');
        if (!prefix) {
            throw new ApplicationError(ErrorCodes.OBJECT_GATEWAY_MISSING_PREFIX, 'prefix query parameter is required', 400);
        }

        writeJson(response, 200, {
            deleted: true,
            deletedCount: await this.objectStore.deleteByPrefix(bucket, prefix)
        });
    }

    private async handleCompose(request: Request<ObjectGatewayRouteParams>, response: Response): Promise<void> {
        const bucket = this.readAllowedBucket(request.params.bucket);
        const { objectKey, sourceObjectKeys, metadata } = request.body as ObjectGatewayComposeRequest;

        await this.objectStore.composeObject({
            bucket,
            objectKey,
            sourceObjectKeys,
            metadata
        });

        writeJson(response, 201, { composed: true });
    }

    private async handleHeadObject(bucket: string, objectKey: string, response: Response): Promise<void> {
        writeObjectHeaders(response, await this.readObjectStat(bucket, objectKey));
        response.status(200).end();
    }

    private async handleGetObject(
        request: Request<ObjectGatewayRouteParams>,
        bucket: string,
        objectKey: string,
        response: Response
    ): Promise<void> {
        const skipMetadataHeader = request.get(TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER);
        const skipMetadata = skipMetadataHeader === '1' || skipMetadataHeader === 'true';
        const rangeHeader = request.get('range') ?? undefined;
        const stat = skipMetadata && !rangeHeader
            ? null
            : await this.readObjectStat(bucket, objectKey);
        const range = stat
            ? parseRangeHeader(rangeHeader, stat.size)
            : null;
        const stream = await this.readObjectStream(bucket, objectKey, range);

        if (stat) {
            if (range) {
                writePartialObjectHeaders(response, stat, range, !skipMetadata);
            } else {
                writeObjectHeaders(response, stat);
            }
        }

        response.status(range ? 206 : 200);

        await new Promise<void>((resolve, reject) => {
            const handleFinish = (): void => {
                cleanup();
                resolve();
            };
            const handleClose = (): void => {
                if (!response.writableEnded) {
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

            stream.once('error', handleError);
            response.once('finish', handleFinish);
            response.once('close', handleClose);
            stream.pipe(response);
        });
    }

    private async handlePutObject(
        request: Request<ObjectGatewayRouteParams>,
        bucket: string,
        objectKey: string,
        response: Response
    ): Promise<void> {
        // content-length is raw wire text; minio needs a real byte count up front.
        const contentLength = Number(request.get('content-length'));
        if (!Number.isInteger(contentLength) || contentLength < 0) {
            throw new ApplicationError(ErrorCodes.OBJECT_GATEWAY_MISSING_CONTENT_LENGTH, 'content-length header is required for uploads', 400);
        }

        await this.objectStore.putObjectStream({
            bucket,
            objectKey,
            stream: request,
            size: contentLength,
            metadata: readUploadMetadata(request)
        });

        response.status(201).end();
    }

    private async handleDeleteObject(bucket: string, objectKey: string, response: Response): Promise<void> {
        await this.readObjectStat(bucket, objectKey);
        await this.objectStore.removeObject(bucket, objectKey);
        response.status(204).end();
    }

    private async readObjectStat(bucket: string, objectKey: string): Promise<LocalClusterObjectStat> {
        return this.withObjectNotFound(bucket, objectKey, () => this.objectStore.statObject(bucket, objectKey));
    }

    private async readObjectStream(bucket: string, objectKey: string, range: ObjectByteRange | null): Promise<Readable> {
        return this.withObjectNotFound(bucket, objectKey, () => (range
            ? this.objectStore.getObjectRangeStream(bucket, objectKey, range.start, range.length)
            : this.objectStore.getObjectStream(bucket, objectKey)));
    }

    /** Object-store clients report a missing key through their own error shapes, not a status. */
    private async withObjectNotFound<T>(bucket: string, objectKey: string, read: () => Promise<T>): Promise<T> {
        try {
            return await read();
        } catch (error) {
            if (isObjectNotFoundError(error)) {
                throw new ApplicationError(ErrorCodes.OBJECT_GATEWAY_OBJECT_NOT_FOUND, `Object not found: ${bucket}/${objectKey}`, 404);
            }

            throw error;
        }
    }

    private authorizeRequest(request: Request): void {
        const token = request.get(TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER);
        if (!token) {
            throw new ApplicationError(ErrorCodes.OBJECT_GATEWAY_DIRECT_ACCESS_TOKEN_REQUIRED, 'Direct access token is required', 401);
        }

        const verifyDirectAccessToken = this.security.verifyDirectAccessToken;
        const claims: ObjectGatewayDirectAccessClaims | null = verifyDirectAccessToken
            ? verifyDirectAccessToken(token)
            : null;

        if (
            !claims
            || claims.ownerClusterId !== this.config.teamClusterId
            || claims.exposureId !== OBJECT_GATEWAY_EXPOSURE_ID
            || claims.exposureName !== OBJECT_GATEWAY_EXPOSURE_NAME
            || claims.accessMode !== TeamClusterServiceExposureAccessMode.Http
        ) {
            throw new ApplicationError(ErrorCodes.OBJECT_GATEWAY_INVALID_DIRECT_ACCESS_TOKEN, 'Direct access token is invalid or expired', 401);
        }
    }
}

export const getObjectGatewayServer = singleton((): ObjectGatewayServer => {
    const config = getConfig();
    return new ObjectGatewayServer(config, getMinioService(), {
        verifyDirectAccessToken: (token) => verifyTeamClusterDirectAccessToken(config.daemonPassword, token)
    });
});
