
import { Socket } from 'socket.io';
import BaseSocketModule from '@/socket/base-socket-module';
import { IUser } from '@/types/models/user';

class TeamPresenceModule extends BaseSocketModule {
    constructor() {
        super('TeamPresenceModule');
    }

    onConnection(socket: Socket): void {
        const user = (socket as any).user as IUser;
        if (!user || !user.teams) return;

        // Join team rooms and notify online status
        user.teams.forEach((teamId) => {
            const room = `team:${teamId}`;
            this.joinRoom(socket, room);

            // Broadcast to others in the team that this user is online
            socket.to(room).emit('team_user_online', {
                teamId,
                userId: user._id,
                user: {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    avatar: user.avatar,
                    lastLoginAt: user.lastLoginAt
                }
            });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            if (!user || !user.teams) return;
            user.teams.forEach((teamId) => {
                const room = `team:${teamId}`;
                socket.to(room).emit('team_user_offline', {
                    teamId,
                    userId: user._id
                });
            });
        });

        // Allow fetching current online members for a team
        socket.on('get_team_presence', async (payload: { teamId: string }) => {
            const { teamId } = payload;
            if (!user.teams.some(t => t.toString() === teamId)) return;

            const room = `team:${teamId}`;
            const sockets = await this.io?.in(room).fetchSockets();

            const onlineUsers = sockets?.map(s => {
                const u = (s as any).user as IUser;
                return {
                    _id: u._id,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    email: u.email,
                    avatar: u.avatar,
                    lastLoginAt: u.lastLoginAt
                };
            }) || [];

            // Remove duplicates (same user multiple tabs)
            const uniqueUsers = Array.from(new Map(onlineUsers.map(u => [u._id.toString(), u])).values());

            socket.emit('team_presence_list', { teamId, users: uniqueUsers });
        });
    }
}

export default TeamPresenceModule;
