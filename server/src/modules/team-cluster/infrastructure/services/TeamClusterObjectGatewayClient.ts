import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type { Duplex, Readable as NodeReadable } from 'node:stream';
import http from 'node:http';
import {
    TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX
} from '@shared/infrastructure/contracts/team-cluster';
import { ensureObjectGatewayAccessEnabled } from './ObjectGatewayFeatureFlags';
import TeamClusterDirectAccessTokenService from './TeamClusterDirectAccessTokenService';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

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
    ephemeral: boolean;
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

const mapStatusToApplicationError = (statusCode: number, code: string, message: string): ApplicationError => {
    if (statusCode === 400) return ApplicationError.badRequest(code, message);
    if (statusCode === 401) return ApplicationError.unauthorized(code, message);
    if (statusCode === 403) return ApplicationError.forbidden(code, message);
    if (statusCode === 404) return ApplicationError.notFound(code, message);
    if (statusCode === 409) return ApplicationError.conflict(code, message);
    if (statusCode === 503) return new ApplicationError(code, message, 503);
    return new ApplicationError(code, message, statusCode >= 400 ? statusCode : 500);
};

@injectable()
export default class TeamClusterObjectGatewayClient {
    private readonly cachedTokens = new Map<string, CachedAccessToken>();
    private readonly pendingTokens = new Map<string, Promise<CachedAccessToken>>();
    private readonly httpSessions = new Map<string, ObjectGatewayHttpSessionEntry[]>();

    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(DaemonCredentialGuard)
        private readonly daemonCredentialGuard: DaemonCredentialGuard,

        @inject(TeamClusterDirectAccessTokenService)
        private readonly directAccessTokenService: TeamClusterDirectAccessTokenService
    ) {}

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

        const response = await this.fetchJson<ObjectGatewayJsonListResponse>(teamClusterId, {
            method: 'GET',
            path: `${this.buildCollectionPath(request.bucket)}?${query.toString()}`
        }, 'list');

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
        const response = await this.fetch(teamClusterId, {
            method: 'HEAD',
            path: this.buildObjectPath(bucket, objectKey)
        }, 'head');

        return parseHeadResponse(response.headers);
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
        const response = await this.fetch(teamClusterId, {
            method: 'GET',
            path: this.buildObjectPath(bucket, objectKey)
        }, 'get');

        return {
            ...parseHeadResponse(response.headers),
            headers: normalizeHeaders(response.headers),
            stream: response.stream
        };
    }

    async getBuffer(teamClusterId: string, bucket: string, objectKey: string): Promise<Buffer> {
        ensureObjectGatewayAccessEnabled('read');
        const response = await this.fetch(teamClusterId, {
            method: 'GET',
            path: this.buildObjectPath(bucket, objectKey)
        }, 'get');

        return this.readResponseBuffer(response.stream);
    }

    async putStream(teamClusterId: string, request: TeamClusterObjectGatewayPutStreamRequest): Promise<void> {
        ensureObjectGatewayAccessEnabled('write');
        await this.fetch(teamClusterId, {
            method: 'PUT',
            path: this.buildObjectPath(request.bucket, request.objectKey),
            headers: this.buildUploadHeaders(request),
            body: request.stream
        }, 'put');
    }

    async putBuffer(teamClusterId: string, request: TeamClusterObjectGatewayPutBufferRequest): Promise<void> {
        ensureObjectGatewayAccessEnabled('write');
        await this.fetch(teamClusterId, {
            method: 'PUT',
            path: this.buildObjectPath(request.bucket, request.objectKey),
            headers: this.buildUploadHeaders(request),
            body: request.buffer
        }, 'put');
    }

    async deleteObject(teamClusterId: string, bucket: string, objectKey: string): Promise<void> {
        ensureObjectGatewayAccessEnabled('write');
        await this.fetch(teamClusterId, {
            method: 'DELETE',
            path: this.buildObjectPath(bucket, objectKey)
        }, 'delete');
    }

    async deleteByPrefix(teamClusterId: string, bucket: string, prefix: string): Promise<number | undefined> {
        ensureObjectGatewayAccessEnabled('write');
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
        return JSON.parse((await this.readResponseBuffer(response.stream)).toString('utf8')) as T;
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

            const payloadBuffer = await this.readResponseBuffer(response.stream);
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

        const tunnel = await this.teamClusterDaemonClient.openTunnel(
            teamClusterId,
            OBJECT_GATEWAY_EXPOSURE_ID,
            TeamClusterServiceExposureAccessMode.Http
        );
        const storeSession = existingSessions.length < MAX_HTTP_PROXY_SESSIONS_PER_CLUSTER;
        const session = this.createHttpSession(sessionKey, teamClusterId, tunnel as Duplex, !storeSession);

        if (storeSession) {
            this.httpSessions.set(sessionKey, [...existingSessions, session]);
        }

        return session;
    }

    private createHttpSession(
        sessionKey: string,
        teamClusterId: string,
        tunnel: Duplex,
        ephemeral = false
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
            ephemeral,
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
        if (destroySession || session.ephemeral || session.tunnel.destroyed) {
            this.destroyHttpSession(session);
            return;
        }

        session.inUse = false;
        session.expiresAt = Date.now() + HTTP_PROXY_SESSION_TTL_MS;
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
            return;
        }

        this.httpSessions.set(session.key, nextSessions);
    }

    private buildSessionKey(teamClusterId: string): string {
        return `${teamClusterId}:${OBJECT_GATEWAY_EXPOSURE_ID}:${TeamClusterServiceExposureAccessMode.Http}`;
    }

    private async readResponseBuffer(stream: NodeReadable): Promise<Buffer> {
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
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
}

export type {
    TeamClusterObjectGatewayListRequest,
    TeamClusterObjectGatewayPutBufferRequest,
    TeamClusterObjectGatewayPutStreamRequest
};
