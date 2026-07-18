import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';

export default class TeamRoomPresenceService {
    #roomManager = socketIORoomManager;

    async getOnlineUserIds(teamId: string): Promise<string[]> {
        const users = await this.#roomManager.collectPresence(
            this.#getTeamRoomName(teamId),
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

    #getTeamRoomName(teamId: string): string {
        return `team:${teamId}`;
    }
}
