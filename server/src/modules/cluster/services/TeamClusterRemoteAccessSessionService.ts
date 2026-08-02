import { ErrorCodes } from '@core/constants/error-codes';
import {
    TeamClusterRemoteAccessSessionView,
    TeamClusterRemoteAccessTarget
} from '@modules/cluster/services/TeamClusterRemoteAccess';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { InMemoryAbsoluteExpiryStore } from '@shared/infrastructure/services/InMemoryAbsoluteExpiryStore';
import { randomUUID } from 'node:crypto';

interface CreateRemoteAccessSessionParams {
    userId: string;
    teamId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
}

interface ValidateRemoteAccessSessionParams {
    sessionId: string;
    userId: string;
    teamId?: string;
    teamClusterId?: string;
    target?: TeamClusterRemoteAccessTarget;
}

interface StoredRemoteAccessSession extends TeamClusterRemoteAccessSessionView {
    userId: string;
    teamId: string;
}

const REMOTE_ACCESS_SESSION_TTL_MS = 15 * 60 * 1000;
const SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const getRemoteAccessSessionExpiresAt = (session: StoredRemoteAccessSession): number => {
    return new Date(session.expiresAt).getTime();
};

class TeamClusterRemoteAccessSessionService {
    private readonly sessions = new InMemoryAbsoluteExpiryStore<string, StoredRemoteAccessSession>({
        getExpiresAt: getRemoteAccessSessionExpiresAt,
        sweepIntervalMs: SESSION_SWEEP_INTERVAL_MS
    });

    createSession(params: CreateRemoteAccessSessionParams): TeamClusterRemoteAccessSessionView {
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + REMOTE_ACCESS_SESSION_TTL_MS);
        const session: StoredRemoteAccessSession = {
            sessionId: randomUUID(),
            userId: params.userId,
            teamId: params.teamId,
            teamClusterId: params.teamClusterId,
            target: params.target,
            createdAt: createdAt.toISOString(),
            expiresAt: expiresAt.toISOString()
        };

        this.sessions.set(session.sessionId, session);

        return this.toView(session);
    }

    validateSession(params: ValidateRemoteAccessSessionParams): StoredRemoteAccessSession | ApplicationError {
        const session = this.sessions.get(params.sessionId);
        if (!session) {
            return ApplicationError.notFound(
                ErrorCodes.TEAM_CLUSTER_REMOTE_ACCESS_SESSION_NOT_FOUND,
                'Remote access session not found or expired'
            );
        }

        if (this.sessions.isExpired(session)) {
            this.sessions.delete(params.sessionId);

            return ApplicationError.notFound(
                ErrorCodes.TEAM_CLUSTER_REMOTE_ACCESS_SESSION_EXPIRED,
                'Remote access session expired'
            );
        }

        if (session.userId !== params.userId) {
            return ApplicationError.forbidden(
                ErrorCodes.TEAM_CLUSTER_REMOTE_ACCESS_SESSION_FORBIDDEN,
                'Remote access session does not belong to this user'
            );
        }

        if (params.teamId && session.teamId !== params.teamId) {
            return ApplicationError.forbidden(
                ErrorCodes.TEAM_CLUSTER_REMOTE_ACCESS_SESSION_TEAM_MISMATCH,
                'Remote access session does not belong to this team'
            );
        }

        if (params.teamClusterId && session.teamClusterId !== params.teamClusterId) {
            return ApplicationError.forbidden(
                ErrorCodes.TEAM_CLUSTER_REMOTE_ACCESS_SESSION_CLUSTER_MISMATCH,
                'Remote access session does not belong to this cluster'
            );
        }

        if (params.target && session.target !== params.target) {
            return ApplicationError.forbidden(
                ErrorCodes.TEAM_CLUSTER_REMOTE_ACCESS_SESSION_TARGET_MISMATCH,
                'Remote access session does not match this action'
            );
        }

        return session;
    }

    private cleanupExpiredSessions(): void {
        this.sessions.sweepExpired();
    }

    private toView(session: StoredRemoteAccessSession): TeamClusterRemoteAccessSessionView {
        return {
            sessionId: session.sessionId,
            teamClusterId: session.teamClusterId,
            target: session.target,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt
        };
    }
}

export default new TeamClusterRemoteAccessSessionService();
