import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import { injectable } from 'tsyringe';
import type { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import type { BinaryRelayDuplex } from './BinaryRelayDuplex';

type BinaryRelaySessionState = 'pending' | 'attaching' | 'attached' | 'closed';

export interface BinaryRelaySessionRecord {
    relaySessionId: string;
    teamClusterId: string;
    sessionId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    relayProtocolVersion: 1;
    state: BinaryRelaySessionState;
    createdAt: number;
    lastActivityAt: number;
    stream: BinaryRelayDuplex;
}

interface CreateBinaryRelaySessionInput {
    relaySessionId: string;
    teamClusterId: string;
    sessionId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    stream: BinaryRelayDuplex;
}

const DEFAULT_PENDING_SESSION_TTL_MS = 60_000;
const DEFAULT_ATTACHED_SESSION_IDLE_TTL_MS = 10 * 60 * 1000;
const SESSION_SWEEP_INTERVAL_MS = 30_000;

@injectable()
export class BinaryRelaySessionRegistry {
    private readonly pendingSessionTtlMs = readNumberEnv(
        'TEAM_CLUSTER_BINARY_RELAY_PENDING_SESSION_TTL_MS',
        DEFAULT_PENDING_SESSION_TTL_MS
    );
    private readonly attachedSessionIdleTtlMs = readNumberEnv(
        'TEAM_CLUSTER_BINARY_RELAY_IDLE_TTL_MS',
        DEFAULT_ATTACHED_SESSION_IDLE_TTL_MS
    );
    private readonly sessionsByRelayId = new Map<string, BinaryRelaySessionRecord>();

    constructor() {
        this.startSweepTimer();
    }

    createSession(input: CreateBinaryRelaySessionInput): BinaryRelaySessionRecord {
        const now = Date.now();
        const session: BinaryRelaySessionRecord = {
            relaySessionId: input.relaySessionId,
            teamClusterId: input.teamClusterId,
            sessionId: input.sessionId,
            accessMode: input.accessMode,
            relayProtocolVersion: 1,
            state: 'pending',
            createdAt: now,
            lastActivityAt: now,
            stream: input.stream
        };

        this.sessionsByRelayId.set(session.relaySessionId, session);
        return session;
    }

    getSession(relaySessionId: string): BinaryRelaySessionRecord | null {
        return this.sessionsByRelayId.get(relaySessionId) || null;
    }

    beginAttach(relaySessionId: string): BinaryRelaySessionRecord | null {
        const session = this.sessionsByRelayId.get(relaySessionId);
        if (!session || session.state !== 'pending') {
            return null;
        }

        session.state = 'attaching';
        session.lastActivityAt = Date.now();
        return session;
    }

    rollbackAttach(relaySessionId: string): void {
        const session = this.sessionsByRelayId.get(relaySessionId);
        if (!session || session.state !== 'attaching') {
            return;
        }

        session.state = 'pending';
        session.lastActivityAt = Date.now();
    }

    markAttached(relaySessionId: string): BinaryRelaySessionRecord | null {
        const session = this.sessionsByRelayId.get(relaySessionId);
        if (!session || (session.state !== 'pending' && session.state !== 'attaching')) {
            return null;
        }

        session.state = 'attached';
        session.lastActivityAt = Date.now();
        return session;
    }

    touchSession(relaySessionId: string): void {
        const session = this.sessionsByRelayId.get(relaySessionId);
        if (!session || session.state === 'closed') {
            return;
        }

        session.lastActivityAt = Date.now();
    }

    forgetSession(relaySessionId: string): void {
        const session = this.sessionsByRelayId.get(relaySessionId);
        if (!session) {
            return;
        }

        session.state = 'closed';
        this.sessionsByRelayId.delete(relaySessionId);
    }

    closeSession(relaySessionId: string, error?: Error): void {
        const session = this.sessionsByRelayId.get(relaySessionId);
        if (!session) {
            return;
        }

        const wasAttached = session.state === 'attached';
        this.forgetSession(relaySessionId);
        if (error && wasAttached) {
            session.stream.destroy(error);
            return;
        }

        session.stream.destroy();
    }

    closeRemoteSession(relaySessionId: string, error?: Error): void {
        const session = this.sessionsByRelayId.get(relaySessionId);
        if (!session) {
            return;
        }

        const wasAttached = session.state === 'attached';
        this.forgetSession(relaySessionId);
        if (error && wasAttached) {
            session.stream.fail(error);
            return;
        }

        session.stream.closeRemote();
    }

    private sweepExpiredSessions(): void {
        const now = Date.now();

        for (const session of this.sessionsByRelayId.values()) {
            if (session.state === 'attached') {
                if (now - session.lastActivityAt <= this.attachedSessionIdleTtlMs) {
                    continue;
                }

                logger.warn(`[BinaryRelay] Attached session idle TTL expired relaySessionId=${session.relaySessionId} sessionId=${session.sessionId}`);
                this.closeSession(session.relaySessionId, new Error('Binary relay session idle TTL expired'));
                continue;
            }

            if (now - session.createdAt <= this.pendingSessionTtlMs) {
                continue;
            }

            logger.warn(`[BinaryRelay] Pending session TTL expired relaySessionId=${session.relaySessionId} sessionId=${session.sessionId} state=${session.state}`);
            this.closeSession(session.relaySessionId, new Error('Binary relay session timed out before attachment'));
        }
    }

    private startSweepTimer(): void {
        const timer = setInterval(() => {
            this.sweepExpiredSessions();
        }, SESSION_SWEEP_INTERVAL_MS);

        if (typeof timer.unref === 'function') {
            timer.unref();
        }
    }
}
