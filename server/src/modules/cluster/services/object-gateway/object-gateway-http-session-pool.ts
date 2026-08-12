
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { OBJECT_GATEWAY_EXPOSURE_ID } from '@modules/cluster/services/object-gateway/object-gateway-paths';
import {
    headersFromIncoming,
    headersToObject
} from '@modules/cluster/services/object-gateway/object-gateway-responses';
import { TeamClusterServiceExposureAccessMode } from '@shared/contracts/types/TeamClusterExposure';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import http from 'node:http';
import type { RawHttpResponse } from '@modules/cluster/services/object-gateway/object-gateway-responses';
import type { Duplex, Readable as NodeReadable } from 'node:stream';

export type ObjectGatewayOperationName =
    | 'list'
    | 'head'
    | 'get'
    | 'put'
    | 'compose'
    | 'delete'
    | 'delete-prefix';

export interface ObjectGatewayRequestOptions {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: Buffer | NodeReadable;
}

export interface ObjectGatewayHttpSessionEntry {
    teamClusterId: string;
    tunnel: Duplex;
    agent: http.Agent;
    inUse: boolean;
    expiresAt: number;
}

const HTTP_PROXY_SESSION_TTL_MS = readPositiveIntegerEnv('TEAM_CLUSTER_OBJECT_GATEWAY_HTTP_SESSION_TTL_MS', 30_000);
const HTTP_PROXY_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv('TEAM_CLUSTER_OBJECT_GATEWAY_HTTP_REQUEST_TIMEOUT_MS', 10 * 60 * 1000);
const HTTP_PROXY_TUNNEL_ATTACH_TIMEOUT_MS = readPositiveIntegerEnv('TEAM_CLUSTER_OBJECT_GATEWAY_TUNNEL_ATTACH_TIMEOUT_MS', 120_000);
const HTTP_PROXY_FAST_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv('TEAM_CLUSTER_OBJECT_GATEWAY_FAST_REQUEST_TIMEOUT_MS', 45_000);
const HTTP_PROXY_FAST_TUNNEL_ATTACH_TIMEOUT_MS = readPositiveIntegerEnv(
    'TEAM_CLUSTER_OBJECT_GATEWAY_FAST_TUNNEL_ATTACH_TIMEOUT_MS',
    20_000
);

const FAST_REQUEST_TIMEOUT_MS = Math.min(HTTP_PROXY_FAST_REQUEST_TIMEOUT_MS, HTTP_PROXY_REQUEST_TIMEOUT_MS);
const ATTACH_TIMEOUT_MS = Math.min(HTTP_PROXY_TUNNEL_ATTACH_TIMEOUT_MS, HTTP_PROXY_REQUEST_TIMEOUT_MS);
const FAST_ATTACH_TIMEOUT_MS = Math.min(
    HTTP_PROXY_FAST_TUNNEL_ATTACH_TIMEOUT_MS,
    HTTP_PROXY_TUNNEL_ATTACH_TIMEOUT_MS,
    HTTP_PROXY_FAST_REQUEST_TIMEOUT_MS
);

const isFastOperation = (operation: ObjectGatewayOperationName): boolean => (
    operation === 'head' || operation === 'list'
);

export default class ObjectGatewayHttpSessionPool {
    private readonly sessions = new Map<string, ObjectGatewayHttpSessionEntry[]>();

    async acquire(
        teamClusterId: string,
        operation: ObjectGatewayOperationName
    ): Promise<ObjectGatewayHttpSessionEntry> {
        const existingSessions = this.pruneSessions(teamClusterId);
        const reusableSession = existingSessions.find((session) => !session.inUse && !session.tunnel.destroyed);

        if (reusableSession) {
            reusableSession.inUse = true;
            reusableSession.expiresAt = Date.now() + HTTP_PROXY_SESSION_TTL_MS;
            return reusableSession;
        }

        const tunnelAttachTimeoutMs = isFastOperation(operation) ? FAST_ATTACH_TIMEOUT_MS : ATTACH_TIMEOUT_MS;
        const tunnel = await teamClusterDaemonClient.openTunnel(
            teamClusterId,
            OBJECT_GATEWAY_EXPOSURE_ID,
            TeamClusterServiceExposureAccessMode.Http,
            {
                timeoutMs: tunnelAttachTimeoutMs,
                timeoutMessage: `Timed out waiting for daemon object gateway tunnel attachment after ${tunnelAttachTimeoutMs}ms`
            }
        );
        const latestSessions = this.pruneSessions(teamClusterId);
        const session = this.createSession(teamClusterId, tunnel);

        this.sessions.set(teamClusterId, [...latestSessions, session]);

        return session;
    }

    async request(
        session: ObjectGatewayHttpSessionEntry,
        options: ObjectGatewayRequestOptions,
        headers: Headers,
        operation: ObjectGatewayOperationName
    ): Promise<RawHttpResponse> {
        const requestTimeoutMs = isFastOperation(operation) ? FAST_REQUEST_TIMEOUT_MS : HTTP_PROXY_REQUEST_TIMEOUT_MS;

        return new Promise<RawHttpResponse>((resolve, reject) => {
            const request = http.request({
                protocol: 'http:',
                hostname: '127.0.0.1',
                host: '127.0.0.1',
                port: 80,
                path: options.path,
                method: options.method,
                headers: headersToObject(headers),
                agent: session.agent
            }, (response) => {
                resolve({
                    statusCode: response.statusCode || 0,
                    headers: headersFromIncoming(response.headers),
                    stream: response
                });
            });

            request.setTimeout(requestTimeoutMs, () => {
                request.destroy(new Error(`Object gateway tunnel request timed out after ${requestTimeoutMs}ms`));
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

    bindResponseLifecycle(stream: NodeReadable, session: ObjectGatewayHttpSessionEntry): void {
        let finalized = false;
        const finalize = (destroySession = false): void => {
            if (finalized) {
                return;
            }

            finalized = true;
            this.release(session, destroySession);
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

    release(session: ObjectGatewayHttpSessionEntry, destroySession = false): void {
        if (destroySession || session.tunnel.destroyed) {
            this.destroySession(session);
            return;
        }

        session.inUse = false;
        session.expiresAt = Date.now() + HTTP_PROXY_SESSION_TTL_MS;
    }

    discardCluster(teamClusterId: string): void {
        for (const session of this.sessions.get(teamClusterId) ?? []) {
            this.destroySession(session);
        }

        this.sessions.delete(teamClusterId);
    }

    private createSession(teamClusterId: string, tunnel: Duplex): ObjectGatewayHttpSessionEntry {
        const agent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: HTTP_PROXY_SESSION_TTL_MS,
            maxFreeSockets: 1,
            maxSockets: 1
        });

        agent.createConnection = (): Duplex => tunnel;
        const session: ObjectGatewayHttpSessionEntry = {
            teamClusterId,
            tunnel,
            agent,
            inUse: true,
            expiresAt: Date.now() + HTTP_PROXY_SESSION_TTL_MS
        };

        const destroySession = (): void => {
            this.destroySession(session);
        };

        tunnel.once('close', destroySession);
        tunnel.once('error', destroySession);
        return session;
    }

    private pruneSessions(teamClusterId: string): ObjectGatewayHttpSessionEntry[] {
        const sessions = this.sessions.get(teamClusterId) || [];
        const activeSessions = sessions.filter((session) => {
            if (session.tunnel.destroyed || (!session.inUse && session.expiresAt <= Date.now())) {
                this.destroySession(session);
                return false;
            }

            return true;
        });

        if (activeSessions.length === 0) {
            this.sessions.delete(teamClusterId);
            return [];
        }

        this.sessions.set(teamClusterId, activeSessions);
        return activeSessions;
    }

    private destroySession(session: ObjectGatewayHttpSessionEntry): void {
        session.inUse = false;
        session.agent.destroy();
        if (!session.tunnel.destroyed) {
            session.tunnel.destroy();
        }

        const sessions = this.sessions.get(session.teamClusterId);
        if (!sessions) {
            return;
        }

        const nextSessions = sessions.filter((entry) => entry !== session);
        if (nextSessions.length === 0) {
            this.sessions.delete(session.teamClusterId);
        } else {
            this.sessions.set(session.teamClusterId, nextSessions);
        }
    }
}
