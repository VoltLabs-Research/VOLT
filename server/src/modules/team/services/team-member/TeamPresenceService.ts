export interface DetachedTeamPresenceSession {
    teamId: string;
    userId: string;
    endedAt: Date;
    minutesToPersist: number;
    userWentOfflineCompletely: boolean;
    userWentOffline: boolean;
};

interface AttachTeamPresenceResult {
    userBecameOnline: boolean;
    detachedSession: DetachedTeamPresenceSession | null;
};

interface TeamPresenceSession {
    teamId: string;
    userId: string;
};

interface TeamPresenceState {
    connectionIds: Set<string>;
    lastTrackedAt: number;
};

interface HeartbeatResult {
    teamId: string;
    userId: string;
    minutesToPersist: number;
};

const getOrCreate = <K, V>(map: Map<K, V>, key: K, create: () => V): V => {
    const existing = map.get(key);

    if (existing) {
        return existing;
    }

    const created = create();
    map.set(key, created);
    return created;
};

export default class TeamPresenceService {
    private readonly sessionsByConnection = new Map<string, TeamPresenceSession>();
    private readonly presenceByTeam = new Map<string, Map<string, TeamPresenceState>>();
    private readonly connectionsByUser = new Map<string, Set<string>>();

    attachConnection(connectionId: string, teamId: string, userId: string): AttachTeamPresenceResult {
        const existingSession = this.sessionsByConnection.get(connectionId);

        if (existingSession?.teamId === teamId && existingSession.userId === userId) {
            return {
                userBecameOnline: false,
                detachedSession: null
            };
        }

        const detachedSession = existingSession
            ? this.detachConnection(connectionId)
            : null;

        const now = Date.now();
        const teamPresence = getOrCreate(this.presenceByTeam, teamId, () => new Map<string, TeamPresenceState>());
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
        this.sessionsByConnection.set(connectionId, {
            teamId,
            userId
        });
        getOrCreate(this.connectionsByUser, userId, () => new Set<string>()).add(connectionId);

        return {
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

    registerHeartbeat(connectionId: string, teamId: string): HeartbeatResult | null {
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

    private consumeElapsedMinutes(
        presence: TeamPresenceState,
        now: number
    ): number {
        const elapsedMinutes = Math.max(0, now - presence.lastTrackedAt) / 60000;
        presence.lastTrackedAt = now;
        return elapsedMinutes;
    }
};
