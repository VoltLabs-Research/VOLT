import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import logger from '@shared/infrastructure/logger';
import http from 'node:http';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { Duplex } from 'node:stream';
import { objectGatewayClientTelemetry } from './ObjectGatewayClientTelemetry';

export interface ObjectGatewayHttpSessionDescriptor {
    key: string;
    teamClusterId: string;
    exposureId: string;
    targetHost: string;
    targetPort: number;
    tunnel: Duplex;
    agent: http.Agent;
    ephemeral: boolean;
    inUse: boolean;
    expiresAt: number;
    destroyed: boolean;
}

interface AcquireObjectGatewayHttpSessionInput {
    teamClusterId: string;
    exposureId: string;
    targetHost: string;
    targetPort: number;
}

const DEFAULT_HTTP_SESSION_TTL_MS = 15_000;
const DEFAULT_MAX_HTTP_SESSIONS_PER_EXPOSURE = 4;
const SESSION_SWEEP_INTERVAL_MS = 30_000;

export class ObjectGatewayHttpSessionPool {
    private readonly sessionTtlMs = readNumberEnv(
        'TEAM_CLUSTER_OBJECT_GATEWAY_HTTP_SESSION_TTL_MS',
        DEFAULT_HTTP_SESSION_TTL_MS
    );
    private readonly maxSessionsPerExposure = readNumberEnv(
        'TEAM_CLUSTER_OBJECT_GATEWAY_MAX_HTTP_SESSIONS_PER_EXPOSURE',
        DEFAULT_MAX_HTTP_SESSIONS_PER_EXPOSURE
    );
    private readonly sessionsByKey = new Map<string, ObjectGatewayHttpSessionDescriptor[]>();

    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {
        this.startSweepTimer();
    }

    async acquire(input: AcquireObjectGatewayHttpSessionInput): Promise<ObjectGatewayHttpSessionDescriptor> {
        const sessionKey = this.buildSessionKey(input);
        this.pruneExpiredSessions(sessionKey);

        const existingSessions = this.sessionsByKey.get(sessionKey) ?? [];
        const reusableSession = existingSessions.find((session) => !session.inUse && !session.tunnel.destroyed);
        if (reusableSession) {
            reusableSession.inUse = true;
            reusableSession.expiresAt = Date.now() + this.sessionTtlMs;
            objectGatewayClientTelemetry.recordSessionReused();
            return reusableSession;
        }

        const tunnelOpenStartedAt = Date.now();
        const tunnel = await this.teamClusterDaemonClient.openTunnel(
            input.teamClusterId,
            input.exposureId,
            TeamClusterServiceExposureAccessMode.Http
        );
        const tunnelOpenDurationMs = Date.now() - tunnelOpenStartedAt;
        const storeSession = existingSessions.length < this.maxSessionsPerExposure;
        const session = this.createSession(sessionKey, input, tunnel, !storeSession);
        objectGatewayClientTelemetry.recordTunnelOpened(
            input.teamClusterId,
            input.exposureId,
            tunnelOpenDurationMs,
            !storeSession
        );
        objectGatewayClientTelemetry.recordSessionOpened(!storeSession);

        if (!storeSession) {
            logger.info({
                action: 'object-gateway.http-session.ephemeral',
                exposureId: input.exposureId,
                teamClusterId: input.teamClusterId,
                activeSessions: existingSessions.length
            }, 'Created ephemeral object gateway HTTP session because the pooled cap is in use');
            return session;
        }

        const nextSessions = [...existingSessions, session];
        this.sessionsByKey.set(sessionKey, nextSessions);
        return session;
    }

    release(session: ObjectGatewayHttpSessionDescriptor, destroySession = false): void {
        if (destroySession || session.ephemeral || session.tunnel.destroyed) {
            this.destroySession(session);
            return;
        }

        if (!session.inUse) {
            return;
        }

        session.inUse = false;
        session.expiresAt = Date.now() + this.sessionTtlMs;
        objectGatewayClientTelemetry.recordSessionReleased();
    }

    private buildSessionKey(input: AcquireObjectGatewayHttpSessionInput): string {
        return `${input.teamClusterId}:${input.exposureId}:${input.targetHost}:${input.targetPort}`;
    }

    private createSession(
        sessionKey: string,
        input: AcquireObjectGatewayHttpSessionInput,
        tunnel: Duplex,
        ephemeral: boolean
    ): ObjectGatewayHttpSessionDescriptor {
        const agent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: this.sessionTtlMs,
            maxSockets: 1,
            maxFreeSockets: 1
        });

        agent.createConnection = (): Duplex => tunnel;

        const session: ObjectGatewayHttpSessionDescriptor = {
            key: sessionKey,
            teamClusterId: input.teamClusterId,
            exposureId: input.exposureId,
            targetHost: input.targetHost,
            targetPort: input.targetPort,
            tunnel,
            agent,
            ephemeral,
            inUse: true,
            expiresAt: Date.now() + this.sessionTtlMs,
            destroyed: false
        };

        const destroy = (): void => {
            this.destroySession(session);
        };

        tunnel.once('close', destroy);
        tunnel.once('error', destroy);

        return session;
    }

    private destroySession(session: ObjectGatewayHttpSessionDescriptor): void {
        if (session.destroyed) {
            return;
        }

        const wasInUse = session.inUse;
        session.destroyed = true;

        const sessions = this.sessionsByKey.get(session.key);
        if (sessions) {
            this.sessionsByKey.set(
                session.key,
                sessions.filter((currentSession) => currentSession !== session)
            );

            if ((this.sessionsByKey.get(session.key) ?? []).length === 0) {
                this.sessionsByKey.delete(session.key);
            }
        }

        session.inUse = false;
        session.agent.destroy();
        session.tunnel.destroy();
        objectGatewayClientTelemetry.recordSessionDestroyed({
            ephemeral: session.ephemeral,
            wasInUse
        });
    }

    private pruneExpiredSessions(sessionKey?: string): void {
        const now = Date.now();
        const keys = sessionKey
            ? [sessionKey]
            : Array.from(this.sessionsByKey.keys());

        for (const key of keys) {
            const sessions = this.sessionsByKey.get(key);
            if (!sessions) {
                continue;
            }

            const activeSessions = sessions.filter((session) => {
                if (session.inUse || session.expiresAt > now) {
                    return true;
                }

                this.destroySession(session);
                return false;
            });

            if (activeSessions.length === 0) {
                this.sessionsByKey.delete(key);
                continue;
            }

            this.sessionsByKey.set(key, activeSessions);
        }
    }

    private startSweepTimer(): ReturnType<typeof setInterval> {
        const timer = setInterval(() => {
            this.pruneExpiredSessions();
        }, SESSION_SWEEP_INTERVAL_MS);

        if (typeof timer.unref === 'function') {
            timer.unref();
        }

        return timer;
    }
}
