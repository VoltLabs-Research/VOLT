import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';

export default class TeamRoomPresenceService {
    async getOnlineUserIds(teamId: string): Promise<string[]> {
        const users = await socketIORoomManager.collectPresence(
            `team:${teamId}`,
            (connection) => {
                const id = connection.user?._id ?? connection.userId ?? '';

                return {
                    id,
                    isAnonymous: !id
                };
            }
        );

        return users.map((user) => user.id).filter((id) => Boolean(id));
    }

    async isUserOnline(teamId: string, userId: string): Promise<boolean> {
        return (await this.getOnlineUserIds(teamId)).includes(userId);
    }
}
