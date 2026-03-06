import { injectable } from 'tsyringe';

interface TeamPresenceSession {
    teamId: string;
    userId: string;
}

export interface DetachedTeamPresenceSession {
    teamId: string;
    userId: string;
    endedAt: Date;
    minutesToPersist: number;
    userWentOfflineCompletely: boolean;
    userWentOffline: boolean;
}

export interface AttachTeamPresenceResult {
    onlineUserIds: string[];
    userBecameOnline: boolean;
    detachedSession: DetachedTeamPresenceSession | null;
}

@injectable()
export default class TeamPresenceService {
    private readonly sessionsByConnection = new Map<string, TeamPresenceSession>();
    private readonly presenceByTeam = new Map<string, Map<string, {
        connectionIds: Set<string>;
        lastTrackedAt: number;
    }>>();
    private readonly connectionsByUser = new Map<string, Set<string>>();

    attachConnection(connectionId: string, teamId: string, userId: string): AttachTeamPresenceResult {
        const existingSession = this.sessionsByConnection.get(connectionId);

        if (existingSession?.teamId === teamId && existingSession.userId === userId) {
            return {
                onlineUserIds: this.getOnlineUserIds(teamId),
                userBecameOnline: false,
                detachedSession: null
            };
        }

        const detachedSession = existingSession
            ? this.detachConnection(connectionId)
            : null;

        const now = Date.now();
        const teamPresence = this.getOrCreateTeamPresence(teamId);
        const existingPresence = teamPresence.get(userId);
        const userBecameOnline = !existingPresence;
        const presence = existingPresence ?? {
            connectionIds: new Set<string>(),
            lastTrackedAt: now
        };

        presence.connectionIds.add(connectionId);

        if (userBecameOnline) {
            presence.lastTrackedAt = now;
        }

        teamPresence.set(userId, presence);
        this.sessionsByConnection.set(connectionId, { teamId, userId });
        this.getOrCreateUserConnections(userId).add(connectionId);

        return {
            onlineUserIds: this.getOnlineUserIds(teamId),
            userBecameOnline,
            detachedSession
        };
    }

    detachConnection(connectionId: string): DetachedTeamPresenceSession | null {
        const session = this.sessionsByConnection.get(connectionId);

        if (!session) {
            return null;
        }

        this.sessionsByConnection.delete(connectionId);
        const userConnections = this.connectionsByUser.get(session.userId);
        userConnections?.delete(connectionId);

        if (userConnections && userConnections.size === 0) {
            this.connectionsByUser.delete(session.userId);
        }

        const teamPresence = this.presenceByTeam.get(session.teamId);
        const presence = teamPresence?.get(session.userId);

        presence?.connectionIds.delete(connectionId);

        let userWentOffline = false;
        let minutesToPersist = 0;

        if (presence && presence.connectionIds.size === 0) {
            minutesToPersist = this.consumeElapsedMinutes(presence, Date.now());
            teamPresence?.delete(session.userId);
            userWentOffline = true;
        }

        if (teamPresence && teamPresence.size === 0) {
            this.presenceByTeam.delete(session.teamId);
        }

        const endedAt = new Date();

        return {
            teamId: session.teamId,
            userId: session.userId,
            endedAt,
            minutesToPersist,
            userWentOfflineCompletely: !this.connectionsByUser.has(session.userId),
            userWentOffline
        };
    }

    registerHeartbeat(connectionId: string, teamId: string): { teamId: string; userId: string; minutesToPersist: number } | null {
        const session = this.sessionsByConnection.get(connectionId);

        if (!session || session.teamId !== teamId) {
            return null;
        }

        const teamPresence = this.presenceByTeam.get(teamId);
        const presence = teamPresence?.get(session.userId);

        if (!presence) {
            return null;
        }

        return {
            teamId,
            userId: session.userId,
            minutesToPersist: this.consumeElapsedMinutes(presence, Date.now())
        };
    }

    getOnlineUserIds(teamId: string): string[] {
        return Array.from(this.presenceByTeam.get(teamId)?.keys() ?? []);
    }

    isUserOnline(teamId: string, userId: string): boolean {
        return this.presenceByTeam.get(teamId)?.has(userId) ?? false;
    }

    private getOrCreateTeamPresence(teamId: string): Map<string, { connectionIds: Set<string>; lastTrackedAt: number }> {
        const existing = this.presenceByTeam.get(teamId);

        if (existing) {
            return existing;
        }

        const created = new Map<string, { connectionIds: Set<string>; lastTrackedAt: number }>();
        this.presenceByTeam.set(teamId, created);
        return created;
    }

    private getOrCreateUserConnections(userId: string): Set<string> {
        const existing = this.connectionsByUser.get(userId);

        if (existing) {
            return existing;
        }

        const created = new Set<string>();
        this.connectionsByUser.set(userId, created);
        return created;
    }

    private consumeElapsedMinutes(
        presence: { connectionIds: Set<string>; lastTrackedAt: number },
        now: number
    ): number {
        const elapsedMinutes = Math.max(0, now - presence.lastTrackedAt) / 60000;
        presence.lastTrackedAt = now;
        return elapsedMinutes;
    }
}
