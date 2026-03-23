import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterExposureRegistryService from '@modules/team-cluster/infrastructure/services/TeamClusterExposureRegistryService';
import {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureSourceKind,
    TeamClusterServiceExposureStatus,
    type TeamClusterServiceExposure
} from '@modules/team-cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import http from 'node:http';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { Readable } from 'node:stream';
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import { objectGatewayClientTelemetry } from './ObjectGatewayClientTelemetry';
import { ensureObjectGatewayAccessEnabled } from './ObjectGatewayFeatureFlags';
import { ObjectGatewayHttpSessionPool, type ObjectGatewayHttpSessionDescriptor } from './ObjectGatewayHttpSessionPool';

type ObjectGatewayOperationName =
    | 'list'
    | 'head'
    | 'get'
    | 'put'
    | 'delete'
    | 'delete-prefix';

interface TeamClusterObjectGatewayListRequest {
    bucket: string;
    prefix?: string;
    cursor?: string;
    limit?: number;
}

interface TeamClusterObjectGatewayHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

interface TeamClusterObjectGatewayStreamResponse extends TeamClusterObjectGatewayHeadResponse {
    headers: Record<string, string>;
    stream: Readable;
}

interface TeamClusterObjectGatewayPutRequest {
    bucket: string;
    objectKey: string;
    contentLength: number;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
}

interface TeamClusterObjectGatewayPutStreamRequest extends TeamClusterObjectGatewayPutRequest {
    stream: Readable;
}

interface TeamClusterObjectGatewayPutBufferRequest extends TeamClusterObjectGatewayPutRequest {
    buffer: Buffer;
}

interface ObjectGatewayJsonListResponse {
    keys?: unknown;
    nextCursor?: unknown;
}

interface ObjectGatewayDeleteResponse {
    deletedCount?: unknown;
}

interface ObjectGatewayRequestOptions {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: Buffer | Readable;
    timeoutMs?: number;
    telemetryOperation: ObjectGatewayOperationName;
    bytesIn?: number;
}

const OBJECT_GATEWAY_EXPOSURE_NAME = 'object-gateway';
const OBJECT_GATEWAY_EXPOSURE_SERVICE_LABEL = 'volt.exposure.service';
const OBJECT_GATEWAY_BASE_PATH = '/internal/object-gateway/v1';
const OBJECT_METADATA_HEADER_PREFIX = 'x-object-meta-';
const DEFAULT_LIST_LIMIT = 100;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

const isSuccessfulStatusCode = (statusCode: number | undefined): boolean => {
    return typeof statusCode === 'number' && statusCode >= 200 && statusCode < 300;
};

const readHeaderValue = (value: string | string[] | undefined): string | undefined => {
    if (Array.isArray(value)) {
        return value.join(', ');
    }

    return value;
};

@injectable()
export default class TeamClusterObjectGatewayClient {
    private readonly sessionPool: ObjectGatewayHttpSessionPool;

    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterExposureRegistryService)
        private readonly exposureRegistryService: TeamClusterExposureRegistryService
    ) {
        this.sessionPool = new ObjectGatewayHttpSessionPool(this.teamClusterDaemonClient);
    }

    async list(
        teamClusterId: string,
        request: TeamClusterObjectGatewayListRequest
    ): Promise<{ keys: string[]; nextCursor?: string; }> {
        ensureObjectGatewayAccessEnabled('read');
        const query = new URLSearchParams();
        query.set('limit', String(request.limit ?? DEFAULT_LIST_LIMIT));

        if (request.prefix) {
            query.set('prefix', request.prefix);
        }

        if (request.cursor) {
            query.set('cursor', request.cursor);
        }

        const response = await this.requestJson<ObjectGatewayJsonListResponse>(teamClusterId, {
            method: 'GET',
            path: `${this.buildCollectionPath(request.bucket)}?${query.toString()}`,
            telemetryOperation: 'list'
        });

        return {
            keys: Array.isArray(response.keys)
                ? response.keys.filter((value): value is string => typeof value === 'string')
                : [],
            nextCursor: typeof response.nextCursor === 'string'
                ? response.nextCursor
                : undefined
        };
    }

    async *listAll(teamClusterId: string, request: Omit<TeamClusterObjectGatewayListRequest, 'cursor'>): AsyncIterable<string> {
        let cursor: string | undefined;

        do {
            const page = await this.list(teamClusterId, {
                ...request,
                cursor
            });

            for (const key of page.keys) {
                yield key;
            }

            cursor = page.nextCursor;
        } while (cursor);
    }

    async head(teamClusterId: string, bucket: string, objectKey: string): Promise<TeamClusterObjectGatewayHeadResponse> {
        ensureObjectGatewayAccessEnabled('read');
        const response = await this.requestHeaders(teamClusterId, {
            method: 'HEAD',
            path: this.buildObjectPath(bucket, objectKey),
            telemetryOperation: 'head'
        });

        return this.readHeadResponse(response.headers);
    }

    async exists(teamClusterId: string, bucket: string, objectKey: string): Promise<boolean> {
        try {
            await this.head(teamClusterId, bucket, objectKey);
            return true;
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return false;
            }

            throw error;
        }
    }

    async getStream(teamClusterId: string, bucket: string, objectKey: string): Promise<TeamClusterObjectGatewayStreamResponse> {
        ensureObjectGatewayAccessEnabled('read');
        const response = await this.requestStream(teamClusterId, {
            method: 'GET',
            path: this.buildObjectPath(bucket, objectKey),
            telemetryOperation: 'get'
        });

        const headResponse = this.readHeadResponse(response.headers);
        return {
            ...headResponse,
            headers: response.headers,
            stream: response.stream
        };
    }

    async getBuffer(teamClusterId: string, bucket: string, objectKey: string): Promise<Buffer> {
        ensureObjectGatewayAccessEnabled('read');
        return this.requestBuffer(teamClusterId, {
            method: 'GET',
            path: this.buildObjectPath(bucket, objectKey),
            telemetryOperation: 'get'
        });
    }

    async putStream(teamClusterId: string, request: TeamClusterObjectGatewayPutStreamRequest): Promise<void> {
        ensureObjectGatewayAccessEnabled('write');
        await this.requestEmpty(teamClusterId, {
            method: 'PUT',
            path: this.buildObjectPath(request.bucket, request.objectKey),
            headers: this.buildUploadHeaders(request),
            body: request.stream,
            timeoutMs: DEFAULT_UPLOAD_TIMEOUT_MS,
            telemetryOperation: 'put',
            bytesIn: request.contentLength
        });
    }

    async putBuffer(teamClusterId: string, request: TeamClusterObjectGatewayPutBufferRequest): Promise<void> {
        ensureObjectGatewayAccessEnabled('write');
        await this.requestEmpty(teamClusterId, {
            method: 'PUT',
            path: this.buildObjectPath(request.bucket, request.objectKey),
            headers: this.buildUploadHeaders(request),
            body: request.buffer,
            timeoutMs: DEFAULT_UPLOAD_TIMEOUT_MS,
            telemetryOperation: 'put',
            bytesIn: request.contentLength
        });
    }

    async deleteObject(teamClusterId: string, bucket: string, objectKey: string): Promise<void> {
        ensureObjectGatewayAccessEnabled('write');
        await this.requestEmpty(teamClusterId, {
            method: 'DELETE',
            path: this.buildObjectPath(bucket, objectKey),
            telemetryOperation: 'delete'
        });
    }

    async deleteByPrefix(teamClusterId: string, bucket: string, prefix: string): Promise<number | undefined> {
        ensureObjectGatewayAccessEnabled('write');
        const query = new URLSearchParams();
        query.set('prefix', prefix);

        const response = await this.requestJson<ObjectGatewayDeleteResponse>(teamClusterId, {
            method: 'DELETE',
            path: `${this.buildCollectionPath(bucket)}?${query.toString()}`,
            telemetryOperation: 'delete-prefix'
        });

        return typeof response.deletedCount === 'number'
            ? response.deletedCount
            : undefined;
    }

    private async requestJson<T>(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions
    ): Promise<T> {
        const tracker = objectGatewayClientTelemetry.beginRequest(options.telemetryOperation, teamClusterId);
        let request: ClientRequest;
        let session: ObjectGatewayHttpSessionDescriptor;

        try {
            ({ request, session } = await this.createRequest(teamClusterId, options));
        } catch (error) {
            tracker.complete({
                bytesIn: options.bytesIn,
                error
            });
            throw error;
        }

        return new Promise<T>((resolve, reject) => {
            const finalize = this.createSessionFinalizer(session);

            request.once('response', (response) => {
                this.collectResponseBuffer(response, () => {
                    tracker.markFirstByte();
                }).then((body) => {
                    finalize(false);

                    if (!isSuccessfulStatusCode(response.statusCode)) {
                        tracker.complete({
                            statusCode: response.statusCode,
                            bytesIn: options.bytesIn,
                            bytesOut: body.length
                        });
                        reject(this.createHttpStatusError(response.statusCode, body));
                        return;
                    }

                    tracker.complete({
                        statusCode: response.statusCode,
                        bytesIn: options.bytesIn,
                        bytesOut: body.length
                    });
                    if (body.length === 0) {
                        resolve({} as T);
                        return;
                    }

                    try {
                        resolve(JSON.parse(body.toString('utf8')) as T);
                    } catch {
                        reject(ApplicationError.internalServerError('Object gateway returned invalid JSON'));
                    }
                }).catch((error) => {
                    finalize(true);
                    tracker.complete({
                        bytesIn: options.bytesIn,
                        error
                    });
                    reject(error);
                });
            });

            request.once('error', (error) => {
                finalize(true);
                tracker.complete({
                    bytesIn: options.bytesIn,
                    error
                });
                reject(error);
            });

            this.writeRequestBody(request, options.body);
        });
    }

    private async requestBuffer(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions
    ): Promise<Buffer> {
        const tracker = objectGatewayClientTelemetry.beginRequest(options.telemetryOperation, teamClusterId);
        let request: ClientRequest;
        let session: ObjectGatewayHttpSessionDescriptor;

        try {
            ({ request, session } = await this.createRequest(teamClusterId, options));
        } catch (error) {
            tracker.complete({
                bytesIn: options.bytesIn,
                error
            });
            throw error;
        }

        return new Promise<Buffer>((resolve, reject) => {
            const finalize = this.createSessionFinalizer(session);

            request.once('response', (response) => {
                this.collectResponseBuffer(response, () => {
                    tracker.markFirstByte();
                }).then((body) => {
                    finalize(false);

                    if (!isSuccessfulStatusCode(response.statusCode)) {
                        tracker.complete({
                            statusCode: response.statusCode,
                            bytesIn: options.bytesIn,
                            bytesOut: body.length
                        });
                        reject(this.createHttpStatusError(response.statusCode, body));
                        return;
                    }

                    tracker.complete({
                        statusCode: response.statusCode,
                        bytesIn: options.bytesIn,
                        bytesOut: body.length
                    });
                    resolve(body);
                }).catch((error) => {
                    finalize(true);
                    tracker.complete({
                        bytesIn: options.bytesIn,
                        error
                    });
                    reject(error);
                });
            });

            request.once('error', (error) => {
                finalize(true);
                tracker.complete({
                    bytesIn: options.bytesIn,
                    error
                });
                reject(error);
            });

            this.writeRequestBody(request, options.body);
        });
    }

    private async requestHeaders(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions
    ): Promise<{ headers: Record<string, string>; }> {
        const tracker = objectGatewayClientTelemetry.beginRequest(options.telemetryOperation, teamClusterId);
        let request: ClientRequest;
        let session: ObjectGatewayHttpSessionDescriptor;

        try {
            ({ request, session } = await this.createRequest(teamClusterId, options));
        } catch (error) {
            tracker.complete({
                bytesIn: options.bytesIn,
                error
            });
            throw error;
        }

        return new Promise<{ headers: Record<string, string>; }>((resolve, reject) => {
            const finalize = this.createSessionFinalizer(session);

            request.once('response', (response) => {
                this.collectResponseBuffer(response).then((body) => {
                    finalize(false);

                    if (!isSuccessfulStatusCode(response.statusCode)) {
                        tracker.complete({
                            statusCode: response.statusCode,
                            bytesIn: options.bytesIn,
                            bytesOut: body.length
                        });
                        reject(this.createHttpStatusError(response.statusCode, body));
                        return;
                    }

                    tracker.complete({
                        statusCode: response.statusCode,
                        bytesIn: options.bytesIn,
                        bytesOut: body.length
                    });
                    resolve({
                        headers: this.normalizeHeaders(response.headers)
                    });
                }).catch((error) => {
                    finalize(true);
                    tracker.complete({
                        bytesIn: options.bytesIn,
                        error
                    });
                    reject(error);
                });
            });

            request.once('error', (error) => {
                finalize(true);
                tracker.complete({
                    bytesIn: options.bytesIn,
                    error
                });
                reject(error);
            });

            this.writeRequestBody(request, options.body);
        });
    }

    private async requestStream(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions
    ): Promise<{ headers: Record<string, string>; stream: Readable; }> {
        const tracker = objectGatewayClientTelemetry.beginRequest(options.telemetryOperation, teamClusterId);
        let request: ClientRequest;
        let session: ObjectGatewayHttpSessionDescriptor;

        try {
            ({ request, session } = await this.createRequest(teamClusterId, options));
        } catch (error) {
            tracker.complete({
                bytesIn: options.bytesIn,
                error
            });
            throw error;
        }

        return new Promise<{ headers: Record<string, string>; stream: Readable; }>((resolve, reject) => {
            const finalize = this.createSessionFinalizer(session);

            request.once('response', (response) => {
                if (!isSuccessfulStatusCode(response.statusCode)) {
                    this.collectResponseBuffer(response).then((body) => {
                        finalize(false);
                        tracker.complete({
                            statusCode: response.statusCode,
                            bytesIn: options.bytesIn,
                            bytesOut: body.length
                        });
                        reject(this.createHttpStatusError(response.statusCode, body));
                    }).catch((error) => {
                        finalize(true);
                        tracker.complete({
                            bytesIn: options.bytesIn,
                            error
                        });
                        reject(error);
                    });
                    return;
                }

                let responseBytes = 0;
                const releaseSession = this.createSessionFinalizer(session);
                let streamFinalized = false;
                const finalizeStream = (destroySession: boolean, error?: unknown): void => {
                    if (streamFinalized) {
                        return;
                    }

                    streamFinalized = true;
                    tracker.complete({
                        statusCode: error
                            ? (response.complete ? response.statusCode : undefined)
                            : response.statusCode,
                        bytesIn: options.bytesIn,
                        bytesOut: responseBytes,
                        error
                    });
                    releaseSession(destroySession);
                };

                const trackedStream = new Transform({
                    transform(chunk, _encoding, callback) {
                        const buffer = Buffer.isBuffer(chunk)
                            ? chunk
                            : Buffer.from(chunk);
                        responseBytes += buffer.length;
                        tracker.markFirstByte();
                        callback(null, buffer);
                    }
                });

                response.once('error', (error) => {
                    trackedStream.destroy(error);
                });
                response.once('aborted', () => {
                    trackedStream.destroy(new Error('Object gateway response stream aborted before completion'));
                });
                response.once('close', () => {
                    if (!response.complete && !trackedStream.destroyed) {
                        trackedStream.destroy(new Error('Object gateway response stream closed before completion'));
                    }
                });

                trackedStream.once('end', () => {
                    finalizeStream(false);
                });
                trackedStream.once('error', (error) => {
                    finalizeStream(true, error);
                });
                trackedStream.once('close', () => {
                    if (!trackedStream.readableEnded) {
                        finalizeStream(true, new Error('Object gateway tracked stream closed before completion'));
                    }
                });

                response.pipe(trackedStream);

                resolve({
                    headers: this.normalizeHeaders(response.headers),
                    stream: trackedStream
                });
            });

            request.once('error', (error) => {
                finalize(true);
                tracker.complete({
                    bytesIn: options.bytesIn,
                    error
                });
                reject(error);
            });

            this.writeRequestBody(request, options.body);
        });
    }

    private async requestEmpty(teamClusterId: string, options: ObjectGatewayRequestOptions): Promise<void> {
        const tracker = objectGatewayClientTelemetry.beginRequest(options.telemetryOperation, teamClusterId);
        let request: ClientRequest;
        let session: ObjectGatewayHttpSessionDescriptor;

        try {
            ({ request, session } = await this.createRequest(teamClusterId, options));
        } catch (error) {
            tracker.complete({
                bytesIn: options.bytesIn,
                error
            });
            throw error;
        }

        return new Promise<void>((resolve, reject) => {
            const finalize = this.createSessionFinalizer(session);

            request.once('response', (response) => {
                this.collectResponseBuffer(response).then((body) => {
                    finalize(false);

                    if (!isSuccessfulStatusCode(response.statusCode)) {
                        tracker.complete({
                            statusCode: response.statusCode,
                            bytesIn: options.bytesIn,
                            bytesOut: body.length
                        });
                        reject(this.createHttpStatusError(response.statusCode, body));
                        return;
                    }

                    tracker.complete({
                        statusCode: response.statusCode,
                        bytesIn: options.bytesIn,
                        bytesOut: body.length
                    });
                    resolve();
                }).catch((error) => {
                    finalize(true);
                    tracker.complete({
                        bytesIn: options.bytesIn,
                        error
                    });
                    reject(error);
                });
            });

            request.once('error', (error) => {
                finalize(true);
                tracker.complete({
                    bytesIn: options.bytesIn,
                    error
                });
                reject(error);
            });

            this.writeRequestBody(request, options.body);
        });
    }

    private async createRequest(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions
    ): Promise<{ request: ClientRequest; session: ObjectGatewayHttpSessionDescriptor; }> {
        const exposure = this.resolveExposure(teamClusterId);
        const session = await this.sessionPool.acquire({
            teamClusterId,
            exposureId: exposure.id,
            targetHost: exposure.targetHost,
            targetPort: exposure.targetPort
        });
        const requestOptions = this.buildRequestOptions(exposure, options, session);
        const request = http.request(requestOptions);

        request.setTimeout(options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, () => {
            request.destroy(new Error('Object gateway request timed out'));
        });

        return {
            request,
            session
        };
    }

    private resolveExposure(teamClusterId: string): TeamClusterServiceExposure {
        const exposure = this.exposureRegistryService.findTeamClusterExposure(teamClusterId, (currentExposure) => {
            return currentExposure.sourceKind === TeamClusterServiceExposureSourceKind.Daemon
                && currentExposure.exposureName === OBJECT_GATEWAY_EXPOSURE_NAME
                && currentExposure.status === TeamClusterServiceExposureStatus.Active
                && currentExposure.accessModes.includes(TeamClusterServiceExposureAccessMode.Http)
                && currentExposure.labels[OBJECT_GATEWAY_EXPOSURE_SERVICE_LABEL] === OBJECT_GATEWAY_EXPOSURE_NAME;
        });

        if (exposure) {
            return exposure;
        }

        logger.warn({ teamClusterId }, 'Object gateway exposure is not available for team cluster');
        throw new ApplicationError(
            'TeamCluster::ObjectGatewayUnavailable',
            'Team cluster object gateway is not available',
            503
        );
    }

    private buildRequestOptions(
        exposure: TeamClusterServiceExposure,
        request: ObjectGatewayRequestOptions,
        session: ObjectGatewayHttpSessionDescriptor
    ): RequestOptions {
        const headers = { ...(request.headers || {}) };
        headers.host = `${exposure.targetHost}:${exposure.targetPort}`;

        return {
            protocol: 'http:',
            hostname: exposure.targetHost,
            host: exposure.targetHost,
            port: exposure.targetPort,
            method: request.method,
            path: request.path,
            headers,
            agent: session.agent
        };
    }

    private buildCollectionPath(bucket: string): string {
        return `${OBJECT_GATEWAY_BASE_PATH}/buckets/${encodeURIComponent(bucket)}/objects`;
    }

    private buildObjectPath(bucket: string, objectKey: string): string {
        return `${this.buildCollectionPath(bucket)}/${encodeURIComponent(objectKey)}`;
    }

    private buildUploadHeaders(request: TeamClusterObjectGatewayPutRequest): Record<string, string> {
        const headers: Record<string, string> = {
            'content-length': String(request.contentLength)
        };

        if (request.contentType) {
            headers['content-type'] = request.contentType;
        }

        if (request.contentEncoding) {
            headers['content-encoding'] = request.contentEncoding;
        }

        for (const [metadataKey, metadataValue] of Object.entries(request.metadata || {})) {
            headers[`${OBJECT_METADATA_HEADER_PREFIX}${metadataKey.toLowerCase()}`] = metadataValue;
        }

        return headers;
    }

    private async collectResponseBuffer(
        response: IncomingMessage,
        onChunk?: (chunk: Buffer) => void
    ): Promise<Buffer> {
        const chunks: Buffer[] = [];

        for await (const chunk of response) {
            const buffer = Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(chunk);
            onChunk?.(buffer);
            chunks.push(buffer);
        }

        return Buffer.concat(chunks);
    }

    private normalizeHeaders(headers: IncomingHttpHeaders): Record<string, string> {
        const normalizedHeaders: Record<string, string> = {};

        for (const [headerName, headerValue] of Object.entries(headers)) {
            const value = readHeaderValue(headerValue);
            if (!value) {
                continue;
            }

            normalizedHeaders[headerName.toLowerCase()] = value;
        }

        return normalizedHeaders;
    }

    private readHeadResponse(headers: Record<string, string>): TeamClusterObjectGatewayHeadResponse {
        const metadata: Record<string, string> = {};

        for (const [headerName, headerValue] of Object.entries(headers)) {
            if (!headerName.startsWith(OBJECT_METADATA_HEADER_PREFIX)) {
                continue;
            }

            metadata[headerName.slice(OBJECT_METADATA_HEADER_PREFIX.length)] = headerValue;
        }

        const contentLength = headers['content-length']
            ? Number(headers['content-length'])
            : undefined;
        const lastModified = headers['last-modified']
            ? new Date(headers['last-modified'])
            : undefined;

        return {
            contentLength: typeof contentLength === 'number' && Number.isFinite(contentLength)
                ? contentLength
                : undefined,
            contentType: headers['content-type'],
            contentEncoding: headers['content-encoding'],
            etag: headers.etag,
            lastModified: lastModified instanceof Date && !Number.isNaN(lastModified.getTime())
                ? lastModified
                : undefined,
            metadata
        };
    }

    private createHttpStatusError(statusCode: number | undefined, body: Buffer): ApplicationError {
        const status = typeof statusCode === 'number'
            ? statusCode
            : 500;
        const parsedBody = body.length > 0
            ? this.readErrorMessage(body)
            : undefined;
        const message = parsedBody || `Object gateway request failed with status ${status}`;

        if (status === 400) return ApplicationError.badRequest('TeamCluster::ObjectGatewayBadRequest', message);
        if (status === 403) return ApplicationError.forbidden('TeamCluster::ObjectGatewayForbidden', message);
        if (status === 404) return ApplicationError.notFound('TeamCluster::ObjectGatewayObjectNotFound', message);
        if (status === 409) return ApplicationError.conflict('TeamCluster::ObjectGatewayConflict', message);
        if (status === 503) return new ApplicationError('TeamCluster::ObjectGatewayUnavailable', message, 503);

        return new ApplicationError('TeamCluster::ObjectGatewayRequestFailed', message, status >= 400 ? status : 500);
    }

    private readErrorMessage(body: Buffer): string | undefined {
        const text = body.toString('utf8').trim();
        if (!text) {
            return undefined;
        }

        try {
            const parsedBody = JSON.parse(text) as { message?: unknown; };
            return typeof parsedBody.message === 'string'
                ? parsedBody.message
                : text;
        } catch {
            return text;
        }
    }

    private createSessionFinalizer(session: ObjectGatewayHttpSessionDescriptor): (destroySession: boolean) => void {
        let finalized = false;

        return (destroySession: boolean): void => {
            if (finalized) {
                return;
            }

            finalized = true;
            this.sessionPool.release(session, destroySession);
        };
    }

    private writeRequestBody(request: ClientRequest, body?: Buffer | Readable): void {
        if (!body) {
            request.end();
            return;
        }

        if (Buffer.isBuffer(body)) {
            request.end(body);
            return;
        }

        pipeline(body, request).catch((error: unknown) => {
            request.destroy(error instanceof Error ? error : new Error('Object gateway request body failed'));
        });
    }
}

export type {
    TeamClusterObjectGatewayHeadResponse,
    TeamClusterObjectGatewayListRequest,
    TeamClusterObjectGatewayPutBufferRequest,
    TeamClusterObjectGatewayPutStreamRequest,
    TeamClusterObjectGatewayStreamResponse
};
