import type {
    AttachTeamPresenceResult,
    DetachedTeamPresenceSession
} from '@modules/team/infrastructure/services/team-member/TeamPresenceService';

export interface TeamPresenceHeartbeatResult {
    teamId: string;
    userId: string;
    minutesToPersist: number;
}

export interface ITeamPresenceService {
    attachConnection(connectionId: string, teamId: string, userId: string): AttachTeamPresenceResult;
    detachConnection(connectionId: string): DetachedTeamPresenceSession | null;
    registerHeartbeat(connectionId: string, teamId: string): TeamPresenceHeartbeatResult | null;
    getOnlineUserIds(teamId: string): string[];
    isUserOnline(teamId: string, userId: string): boolean;
}
