export interface ITeamRoomPresenceService {
    getOnlineUserIds(teamId: string): Promise<string[]>;
    isUserOnline(teamId: string, userId: string): Promise<boolean>;
}
