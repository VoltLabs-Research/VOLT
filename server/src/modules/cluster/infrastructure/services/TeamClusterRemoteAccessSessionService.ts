import {
    TeamClusterRemoteAccessSessionDTO,
    TeamClusterRemoteAccessTargetDTO
} from '@modules/cluster/application/dtos/TeamClusterRemoteAccessDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { InMemoryAbsoluteExpiryStore } from '@shared/infrastructure/services/InMemoryAbsoluteExpiryStore';
import { randomUUID } from 'node:crypto';


interface CreateRemoteAccessSessionParams {
    userId: string;
    teamId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
};

interface ValidateRemoteAccessSessionParams {
    sessionId: string;
    userId: string;
    teamId?: string;
    teamClusterId?: string;
    target?: TeamClusterRemoteAccessTargetDTO;
};

interface StoredRemoteAccessSession extends TeamClusterRemoteAccessSessionDTO {
    userId: string;
    teamId: string;
};

const REMOTE_ACCESS_SESSION_TTL_MS = 15 * 60 * 1000;
const SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const getRemoteAccessSessionExpiresAt = (session: StoredRemoteAccessSession): number => {
    return new Date(session.expiresAt).getTime();
};

const isExpiredSession = (session: StoredRemoteAccessSession): boolean => {
    return getRemoteAccessSessionExpiresAt(session) <= Date.now();
};

@Singleton()
export default class TeamClusterRemoteAccessSessionService {
    private readonly sessions = new InMemoryAbsoluteExpiryStore<string, StoredRemoteAccessSession>({
        getExpiresAt: getRemoteAccessSessionExpiresAt,
        sweepIntervalMs: SESSION_SWEEP_INTERVAL_MS
    });

    /**
     * Creates an ephemeral session that authorizes a single remote access flow.
     */
    createSession(params: CreateRemoteAccessSessionParams): TeamClusterRemoteAccessSessionDTO {
        this.cleanupExpiredSessions();

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

        return this.toDTO(session);
    }

    /**
     * Validates that an ephemeral remote access session still belongs to the caller and target resource.
     */
    validateSession(params: ValidateRemoteAccessSessionParams): StoredRemoteAccessSession | ApplicationError {
        this.cleanupExpiredSessions();

        const session = this.sessions.get(params.sessionId);
        if (!session) {
            return ApplicationError.notFound(
                'TeamCluster::RemoteAccessSessionNotFound',
                'Remote access session not found or expired'
            );
        }

        if (isExpiredSession(session)) {
            this.sessions.delete(params.sessionId);

            return ApplicationError.notFound(
                'TeamCluster::RemoteAccessSessionExpired',
                'Remote access session expired'
            );
        }

        if (session.userId !== params.userId) {
            return ApplicationError.forbidden(
                'TeamCluster::RemoteAccessSessionForbidden',
                'Remote access session does not belong to this user'
            );
        }

        if (params.teamId && session.teamId !== params.teamId) {
            return ApplicationError.forbidden(
                'TeamCluster::RemoteAccessSessionTeamMismatch',
                'Remote access session does not belong to this team'
            );
        }

        if (params.teamClusterId && session.teamClusterId !== params.teamClusterId) {
            return ApplicationError.forbidden(
                'TeamCluster::RemoteAccessSessionClusterMismatch',
                'Remote access session does not belong to this cluster'
            );
        }

        if (params.target && session.target !== params.target) {
            return ApplicationError.forbidden(
                'TeamCluster::RemoteAccessSessionTargetMismatch',
                'Remote access session does not match this action'
            );
        }

        return session;
    }

    private cleanupExpiredSessions(): void {
        this.sessions.sweepExpired();
    }

    private toDTO(session: StoredRemoteAccessSession): TeamClusterRemoteAccessSessionDTO {
        return {
            sessionId: session.sessionId,
            teamClusterId: session.teamClusterId,
            target: session.target,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt
        };
    }
}
