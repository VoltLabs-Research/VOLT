import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import type { ITeamRoomPresenceService } from '@modules/team/domain/port/team-member/ITeamRoomPresenceService';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton(TEAM_TOKENS.TeamRoomPresenceService)
export default class TeamRoomPresenceService implements ITeamRoomPresenceService {
    constructor(
        private readonly roomManager: SocketIORoomManager
    ) {}

    async getOnlineUserIds(teamId: string): Promise<string[]> {
        const users = await this.roomManager.collectPresence(
            this.getTeamRoomName(teamId),
            (connection) => {
                const id = connection.user?._id ?? connection.userId ?? '';

                return {
                    id,
                    isAnonymous: !id
                };
            }
        );

        return users
            .map((user) => user.id)
            .filter((id): id is string => Boolean(id));
    }

    async isUserOnline(teamId: string, userId: string): Promise<boolean> {
        const onlineUserIds = await this.getOnlineUserIds(teamId);
        return onlineUserIds.includes(userId);
    }

    private getTeamRoomName(teamId: string): string {
        return `team:${teamId}`;
    }
}
