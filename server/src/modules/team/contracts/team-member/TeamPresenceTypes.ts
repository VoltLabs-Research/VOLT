export interface DetachedTeamPresenceSession {
    teamId: string;
    userId: string;
    endedAt: Date;
    minutesToPersist: number;
    userWentOfflineCompletely: boolean;
    userWentOffline: boolean;
};

export interface AttachTeamPresenceResult {
    onlineUserIds: string[];
    userBecameOnline: boolean;
    detachedSession: DetachedTeamPresenceSession | null;
};
