import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationError';
import DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import {
    TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER
} from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import http from 'node:http';
import type { Duplex, Readable as NodeReadable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import TeamClusterDirectAccessTokenService from './TeamClusterDirectAccessTokenService';

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

export interface TeamClusterObjectGatewayListEntry {
    key: string;
    contentLength?: number;
    etag?: string;
    lastModified?: Date;
}

export interface TeamClusterObjectGatewayListResponse {
    keys: string[];
    objects: TeamClusterObjectGatewayListEntry[];
    nextCursor?: string;
}

export interface TeamClusterObjectGatewayHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

export interface TeamClusterObjectGatewayStreamResponse extends TeamClusterObjectGatewayHeadResponse {
    headers: Record<string, string>;
    stream: NodeReadable;
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
    stream: NodeReadable;
}

interface TeamClusterObjectGatewayPutBufferRequest extends TeamClusterObjectGatewayPutRequest {
    buffer: Buffer;
}

interface TeamClusterObjectGatewayReadOptions {
    skipMetadata?: boolean;
    rangeHeader?: string;
}

interface ObjectGatewayJsonListResponse {
    keys?: unknown;
    objects?: unknown;
    nextCursor?: unknown;
}

interface ObjectGatewayDeleteResponse {
    deletedCount?: unknown;
}

interface ObjectGatewayRequestOptions {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: Buffer | NodeReadable;
}

interface ObjectGatewayJsonError {
    code?: unknown;
    message?: unknown;
}

interface RawHttpResponse {
    statusCode: number;
    headers: Headers;
    stream: NodeReadable;
}

interface CachedAccessToken {
    token: string;
    expiresAt: string;
}

interface ObjectGatewayHttpSessionEntry {
    key: string;
    teamClusterId: string;
    tunnel: Duplex;
    agent: http.Agent;
    inUse: boolean;
    expiresAt: number;
}

const OBJECT_GATEWAY_EXPOSURE_ID = 'daemon:object-gateway';
const OBJECT_GATEWAY_EXPOSURE_NAME = 'object-gateway';
const OBJECT_GATEWAY_BASE_PATH = '/internal/object-gateway/v1';
const OBJECT_METADATA_HEADER_PREFIX = 'x-object-meta-';
const DEFAULT_LIST_LIMIT = 100;
const TOKEN_EXPIRY_SAFETY_WINDOW_MS = 5_000;
const TOKEN_TTL_SECONDS = 5 * 60;
const HTTP_PROXY_SESSION_TTL_MS = 30_000;
const HTTP_PROXY_REQUEST_TIMEOUT_MS = 120_000;
const MAX_HTTP_PROXY_SESSIONS_PER_CLUSTER = 4;

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

const normalizeHeaders = (headers: Headers): Record<string, string> => {
    const normalizedHeaders: Record<string, string> = {};
    headers.forEach((headerValue, headerName) => {
        normalizedHeaders[headerName.toLowerCase()] = headerValue;
    });
    return normalizedHeaders;
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

const parseHeadResponse = (headers: Headers): TeamClusterObjectGatewayHeadResponse => {
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

const parseListEntry = (value: unknown): TeamClusterObjectGatewayListEntry | null => {
    if (typeof value !== 'object' || value === null) {
        return null;
    }

    const entry = value as Record<string, unknown>;
    if (typeof entry.key !== 'string' || entry.key.length === 0) {
        return null;
    }

    const lastModified = entry.lastModified instanceof Date
        ? entry.lastModified
        : typeof entry.lastModified === 'string' && entry.lastModified.length > 0
            ? new Date(entry.lastModified)
            : undefined;

    return {
        key: entry.key,
        contentLength: typeof entry.contentLength === 'number'
            ? entry.contentLength
            : undefined,
        etag: typeof entry.etag === 'string' && entry.etag.length > 0
            ? entry.etag
            : undefined,
        lastModified: lastModified && !Number.isNaN(lastModified.getTime())
            ? lastModified
            : undefined
    };
};

const mapStatusToApplicationError = (statusCode: number, code: string, message: string): ApplicationError => {
    if (statusCode === 400) return ApplicationError.badRequest(code, message);
    if (statusCode === 401) return ApplicationError.unauthorized(code, message);
    if (statusCode === 403) return ApplicationError.forbidden(code, message);
    if (statusCode === 404) return ApplicationError.notFound(code, message);
    if (statusCode === 409) return ApplicationError.conflict(code, message);
    if (statusCode === 503) return new ApplicationError(code, message, 503);
    return new ApplicationError(code, message, statusCode >= 400 ? statusCode : 500);
};

@Singleton()
export default class TeamClusterObjectGatewayClient {
    private readonly cachedTokens = new Map<string, CachedAccessToken>();
    private readonly pendingTokens = new Map<string, Promise<CachedAccessToken>>();
    private readonly httpSessions = new Map<string, ObjectGatewayHttpSessionEntry[]>();
    private readonly pendingSessionWaiters = new Map<string, Array<() => void>>();
    private readonly pendingSessionCreations = new Map<string, number>();

    constructor(
        
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        
        private readonly teamClusterRepository: TeamClusterRepository,

        
        private readonly daemonCredentialGuard: DaemonCredentialGuard,

        
        private readonly directAccessTokenService: TeamClusterDirectAccessTokenService
    ) {}

    async list(
        teamClusterId: string,
        request: TeamClusterObjectGatewayListRequest
    ): Promise<TeamClusterObjectGatewayListResponse> {
        const query = new URLSearchParams();
        query.set('limit', String(request.limit ?? DEFAULT_LIST_LIMIT));

        if (request.prefix) {
            query.set('prefix', request.prefix);
        }

        if (request.cursor) {
            query.set('cursor', request.cursor);
        }

        const response = await this.fetchJson<ObjectGatewayJsonListResponse>(teamClusterId, {
            method: 'GET',
            path: `${this.buildCollectionPath(request.bucket)}?${query.toString()}`
        }, 'list');
        const objects = Array.isArray(response.objects)
            ? response.objects.map(parseListEntry).filter((entry): entry is TeamClusterObjectGatewayListEntry => entry !== null)
            : [];
        const keys = Array.isArray(response.keys)
            ? response.keys.filter((value): value is string => typeof value === 'string')
            : objects.map((object) => object.key);

        return {
            keys,
            objects: objects.length > 0
                ? objects
                : keys.map((key) => ({ key })),
            nextCursor: typeof response.nextCursor === 'string'
                ? response.nextCursor
                : undefined
        };
    }

    async *listAllEntries(
        teamClusterId: string,
        request: Omit<TeamClusterObjectGatewayListRequest, 'cursor'>
    ): AsyncIterable<TeamClusterObjectGatewayListEntry> {
        let cursor: string | undefined;

        do {
            const page = await this.list(teamClusterId, {
                ...request,
                cursor
            });

            for (const entry of page.objects) {
                yield entry;
            }

            cursor = page.nextCursor;
        } while (cursor);
    }

    async *listAll(teamClusterId: string, request: Omit<TeamClusterObjectGatewayListRequest, 'cursor'>): AsyncIterable<string> {
        for await (const entry of this.listAllEntries(teamClusterId, request)) {
            yield entry.key;
        }
    }

    async head(teamClusterId: string, bucket: string, objectKey: string): Promise<TeamClusterObjectGatewayHeadResponse> {
        const response = await this.fetch(teamClusterId, {
            method: 'HEAD',
            path: this.buildObjectPath(bucket, objectKey)
        }, 'head');

        const head = parseHeadResponse(response.headers);
        await buffer(response.stream);

        return head;
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

    async getStream(
        teamClusterId: string,
        bucket: string,
        objectKey: string,
        options?: TeamClusterObjectGatewayReadOptions
    ): Promise<TeamClusterObjectGatewayStreamResponse> {
        const response = await this.fetch(teamClusterId, {
            method: 'GET',
            path: this.buildObjectPath(bucket, objectKey),
            headers: this.buildReadHeaders(options)
        }, 'get');

        return {
            ...parseHeadResponse(response.headers),
            headers: normalizeHeaders(response.headers),
            stream: response.stream
        };
    }

    async getBuffer(teamClusterId: string, bucket: string, objectKey: string): Promise<Buffer> {
        const response = await this.fetch(teamClusterId, {
            method: 'GET',
            path: this.buildObjectPath(bucket, objectKey),
            headers: this.buildReadHeaders({ skipMetadata: true })
        }, 'get');

        return buffer(response.stream);
    }

    async putStream(teamClusterId: string, request: TeamClusterObjectGatewayPutStreamRequest): Promise<void> {
        await this.fetch(teamClusterId, {
            method: 'PUT',
            path: this.buildObjectPath(request.bucket, request.objectKey),
            headers: this.buildUploadHeaders(request),
            body: request.stream
        }, 'put').then((response) => buffer(response.stream));
    }

    async putBuffer(teamClusterId: string, request: TeamClusterObjectGatewayPutBufferRequest): Promise<void> {
        await this.fetch(teamClusterId, {
            method: 'PUT',
            path: this.buildObjectPath(request.bucket, request.objectKey),
            headers: this.buildUploadHeaders(request),
            body: request.buffer
        }, 'put').then((response) => buffer(response.stream));
    }

    async deleteObject(teamClusterId: string, bucket: string, objectKey: string): Promise<void> {
        await this.fetch(teamClusterId, {
            method: 'DELETE',
            path: this.buildObjectPath(bucket, objectKey)
        }, 'delete').then((response) => buffer(response.stream));
    }

    async deleteByPrefix(teamClusterId: string, bucket: string, prefix: string): Promise<number | undefined> {
        const query = new URLSearchParams();
        query.set('prefix', prefix);

        const response = await this.fetchJson<ObjectGatewayDeleteResponse>(teamClusterId, {
            method: 'DELETE',
            path: `${this.buildCollectionPath(bucket)}?${query.toString()}`
        }, 'delete-prefix');

        return typeof response.deletedCount === 'number'
            ? response.deletedCount
            : undefined;
    }

    private async fetchJson<T>(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions,
        operation: ObjectGatewayOperationName
    ): Promise<T> {
        const response = await this.fetch(teamClusterId, options, operation);
        return JSON.parse((await buffer(response.stream)).toString('utf8')) as T;
    }

    private async fetch(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions,
        operation: ObjectGatewayOperationName
    ): Promise<RawHttpResponse> {
        const accessToken = await this.resolveAccessToken(teamClusterId);
        const headers = new Headers(options.headers);
        headers.set(TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER, accessToken.token);
        const session = await this.acquireHttpSession(teamClusterId);

        try {
            const response = await this.performTunnelRequest(options, headers, session.agent);

            if (response.statusCode >= 200 && response.statusCode < 300) {
                this.bindResponseLifecycle(response.stream, session);
                return response;
            }

            const payloadBuffer = await buffer(response.stream);
            this.releaseHttpSession(session);

            let payload: ObjectGatewayJsonError | undefined;
            try {
                payload = JSON.parse(payloadBuffer.toString('utf8')) as ObjectGatewayJsonError;
            } catch {
                payload = undefined;
            }

            throw mapStatusToApplicationError(
                response.statusCode,
                typeof payload?.code === 'string'
                    ? payload.code
                    : `TeamCluster::ObjectGateway${operation}`,
                typeof payload?.message === 'string'
                    ? payload.message
                    : `Object gateway request failed with status ${response.statusCode}`
            );
        } catch (error) {
            this.releaseHttpSession(session, true);
            throw error;
        }
    }

    private async resolveAccessToken(teamClusterId: string): Promise<CachedAccessToken> {
        const cacheKey = `${teamClusterId}:${OBJECT_GATEWAY_EXPOSURE_ID}:${TeamClusterServiceExposureAccessMode.Http}`;
        const cachedToken = this.cachedTokens.get(cacheKey);
        const expiresAtMs = cachedToken
            ? Date.parse(cachedToken.expiresAt)
            : Number.NaN;

        if (cachedToken && Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > TOKEN_EXPIRY_SAFETY_WINDOW_MS) {
            return cachedToken;
        }

        const pendingToken = this.pendingTokens.get(cacheKey);
        if (pendingToken) {
            return pendingToken;
        }

        const nextTokenPromise = this.issueAccessToken(teamClusterId).finally(() => {
            this.pendingTokens.delete(cacheKey);
        });

        this.pendingTokens.set(cacheKey, nextTokenPromise);
        const token = await nextTokenPromise;
        this.cachedTokens.set(cacheKey, token);
        return token;
    }

    private async issueAccessToken(teamClusterId: string): Promise<CachedAccessToken> {
        const teamCluster = await this.teamClusterRepository.findByIdWithSensitiveData(teamClusterId);
        if (!teamCluster) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        const daemonPassword = await this.daemonCredentialGuard.getDecryptedDaemonPassword(teamCluster);
        const issuedAt = Math.floor(Date.now() / 1000);

        return {
            token: this.directAccessTokenService.create(daemonPassword, {
                requesterKind: 'server',
                requesterId: 'volt-server',
                ownerClusterId: teamCluster.id,
                teamId: teamCluster.props.team,
                exposureId: OBJECT_GATEWAY_EXPOSURE_ID,
                exposureName: OBJECT_GATEWAY_EXPOSURE_NAME,
                accessMode: TeamClusterServiceExposureAccessMode.Http,
                iat: issuedAt,
                exp: issuedAt + TOKEN_TTL_SECONDS
            }),
            expiresAt: new Date((issuedAt + TOKEN_TTL_SECONDS) * 1000).toISOString()
        };
    }

    private async performTunnelRequest(
        options: ObjectGatewayRequestOptions,
        headers: Headers,
        agent: http.Agent
    ): Promise<RawHttpResponse> {
        return new Promise<RawHttpResponse>((resolve, reject) => {
            const request = http.request({
                protocol: 'http:',
                hostname: '127.0.0.1',
                host: '127.0.0.1',
                port: 80,
                path: options.path,
                method: options.method,
                headers: headersToObject(headers),
                agent
            }, (response) => {
                resolve({
                    statusCode: response.statusCode || 0,
                    headers: headersFromIncoming(response.headers),
                    stream: response
                });
            });

            request.setTimeout(HTTP_PROXY_REQUEST_TIMEOUT_MS, () => {
                request.destroy(new Error(`Object gateway tunnel request timed out after ${HTTP_PROXY_REQUEST_TIMEOUT_MS}ms`));
            });
            request.once('error', reject);

            if (!options.body) {
                request.end();
                return;
            }

            if (Buffer.isBuffer(options.body)) {
                request.end(options.body);
                return;
            }

            options.body.once('error', (error) => {
                request.destroy(error);
            });
            options.body.pipe(request);
        });
    }

    private async acquireHttpSession(teamClusterId: string): Promise<ObjectGatewayHttpSessionEntry> {
        const sessionKey = this.buildSessionKey(teamClusterId);
        const existingSessions = this.pruneHttpSessions(sessionKey);
        const reusableSession = existingSessions.find((session) => !session.inUse && !session.tunnel.destroyed);

        if (reusableSession) {
            reusableSession.inUse = true;
            reusableSession.expiresAt = Date.now() + HTTP_PROXY_SESSION_TTL_MS;
            return reusableSession;
        }

        const inFlightSessionCreations = this.pendingSessionCreations.get(sessionKey) ?? 0;
        if (existingSessions.length + inFlightSessionCreations >= MAX_HTTP_PROXY_SESSIONS_PER_CLUSTER) {
            await this.waitForHttpSessionAvailability(sessionKey);
            return this.acquireHttpSession(teamClusterId);
        }

        this.pendingSessionCreations.set(sessionKey, inFlightSessionCreations + 1);

        try {
            const tunnel = await this.teamClusterDaemonClient.openTunnel(
                teamClusterId,
                OBJECT_GATEWAY_EXPOSURE_ID,
                TeamClusterServiceExposureAccessMode.Http
            );
            const latestSessions = this.pruneHttpSessions(sessionKey);
            const session = this.createHttpSession(sessionKey, teamClusterId, tunnel as Duplex);

            this.httpSessions.set(sessionKey, [...latestSessions, session]);

            return session;
        } finally {
            const remainingCreations = Math.max(0, (this.pendingSessionCreations.get(sessionKey) ?? 1) - 1);
            if (remainingCreations === 0) {
                this.pendingSessionCreations.delete(sessionKey);
            } else {
                this.pendingSessionCreations.set(sessionKey, remainingCreations);
            }

            this.notifyHttpSessionWaiter(sessionKey);
        }
    }

    private createHttpSession(
        sessionKey: string,
        teamClusterId: string,
        tunnel: Duplex
    ): ObjectGatewayHttpSessionEntry {
        const agent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: HTTP_PROXY_SESSION_TTL_MS,
            maxFreeSockets: 1,
            maxSockets: 1
        });

        agent.createConnection = (): Duplex => tunnel;
        const session: ObjectGatewayHttpSessionEntry = {
            key: sessionKey,
            teamClusterId,
            tunnel,
            agent,
            inUse: true,
            expiresAt: Date.now() + HTTP_PROXY_SESSION_TTL_MS
        };

        const destroySession = (): void => {
            this.destroyHttpSession(session);
        };

        tunnel.once('close', destroySession);
        tunnel.once('error', destroySession);
        return session;
    }

    private bindResponseLifecycle(stream: NodeReadable, session: ObjectGatewayHttpSessionEntry): void {
        let finalized = false;
        const finalize = (destroySession = false): void => {
            if (finalized) {
                return;
            }

            finalized = true;
            this.releaseHttpSession(session, destroySession);
        };

        stream.once('end', () => {
            finalize();
        });
        stream.once('close', () => {
            finalize();
        });
        stream.once('error', () => {
            finalize(true);
        });
    }

    private releaseHttpSession(session: ObjectGatewayHttpSessionEntry, destroySession = false): void {
        if (destroySession || session.tunnel.destroyed) {
            this.destroyHttpSession(session);
            return;
        }

        session.inUse = false;
        session.expiresAt = Date.now() + HTTP_PROXY_SESSION_TTL_MS;
        this.notifyHttpSessionWaiter(session.key);
    }

    private pruneHttpSessions(sessionKey: string): ObjectGatewayHttpSessionEntry[] {
        const sessions = this.httpSessions.get(sessionKey) || [];
        const activeSessions = sessions.filter((session) => {
            if (session.tunnel.destroyed || session.expiresAt <= Date.now()) {
                this.destroyHttpSession(session);
                return false;
            }

            return true;
        });

        if (activeSessions.length === 0) {
            this.httpSessions.delete(sessionKey);
            return [];
        }

        this.httpSessions.set(sessionKey, activeSessions);
        return activeSessions;
    }

    private destroyHttpSession(session: ObjectGatewayHttpSessionEntry): void {
        session.inUse = false;
        session.agent.destroy();
        if (!session.tunnel.destroyed) {
            session.tunnel.destroy();
        }

        const sessions = this.httpSessions.get(session.key);
        if (!sessions) {
            return;
        }

        const nextSessions = sessions.filter((entry) => entry !== session);
        if (nextSessions.length === 0) {
            this.httpSessions.delete(session.key);
        } else {
            this.httpSessions.set(session.key, nextSessions);
        }

        this.notifyHttpSessionWaiter(session.key);
    }

    private async waitForHttpSessionAvailability(sessionKey: string): Promise<void> {
        await new Promise<void>((resolve) => {
            const waiters = this.pendingSessionWaiters.get(sessionKey) ?? [];
            waiters.push(resolve);
            this.pendingSessionWaiters.set(sessionKey, waiters);
        });
    }

    private notifyHttpSessionWaiter(sessionKey: string): void {
        const waiters = this.pendingSessionWaiters.get(sessionKey);
        if (!waiters || waiters.length === 0) {
            return;
        }

        const nextWaiter = waiters.shift();
        if (!nextWaiter) {
            return;
        }

        if (waiters.length === 0) {
            this.pendingSessionWaiters.delete(sessionKey);
        } else {
            this.pendingSessionWaiters.set(sessionKey, waiters);
        }

        nextWaiter();
    }

    private buildSessionKey(teamClusterId: string): string {
        return `${teamClusterId}:${OBJECT_GATEWAY_EXPOSURE_ID}:${TeamClusterServiceExposureAccessMode.Http}`;
    }

    private buildCollectionPath(bucket: string): string {
        return `${OBJECT_GATEWAY_BASE_PATH}/buckets/${encodePathComponent(bucket)}/objects`;
    }

    private buildObjectPath(bucket: string, objectKey: string): string {
        return `${this.buildCollectionPath(bucket)}/${encodeObjectKeyPath(objectKey)}`;
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

        for (const [key, value] of Object.entries(request.metadata ?? {})) {
            headers[`${OBJECT_METADATA_HEADER_PREFIX}${key.toLowerCase()}`] = value;
        }

        return headers;
    }

    private buildReadHeaders(options?: TeamClusterObjectGatewayReadOptions): Record<string, string> | undefined {
        if (!options?.skipMetadata && !options?.rangeHeader) {
            return undefined;
        }

        const headers: Record<string, string> = {};

        if (options?.skipMetadata) {
            headers[TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER] = '1';
        }

        if (options?.rangeHeader) {
            headers.range = options.rangeHeader;
        }

        return headers;
    }
}

export type {
    TeamClusterObjectGatewayListRequest,
    TeamClusterObjectGatewayPutBufferRequest,
    TeamClusterObjectGatewayPutStreamRequest
};
