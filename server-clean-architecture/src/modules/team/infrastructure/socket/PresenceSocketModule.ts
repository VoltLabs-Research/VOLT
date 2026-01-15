import { injectable, inject } from 'tsyringe';
import { ISocketConnection } from '@/src/modules/socket/domain/ports/ISocketModule';
import { ISocketEmitter } from '@/src/modules/socket/domain/ports/ISocketEmitter';
import { ISocketRoomManager, PresenceUser } from '@/src/modules/socket/domain/ports/ISocketRoomManager';
import { ISocketEventRegistry } from '@/src/modules/socket/domain/ports/ISocketEventRegistry';
import { SOCKET_TOKENS } from '@/src/modules/socket/infrastructure/di/SocketTokens';
import { TEAM_TOKENS } from '../di/TeamTokens';
import { ITeamPresenceService } from '../../domain/ports/ITeamPresenceService';
import BaseSocketModule from '@/src/modules/socket/infrastructure/gateway/BaseSocketModule';

@injectable()
export default class TeamPresenceSocketModule extends BaseSocketModule {
    public readonly name = 'TeamPresenceModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) 
        emitter: ISocketEmitter,
        
        @inject(SOCKET_TOKENS.SocketRoomManager) 
        roomManager: ISocketRoomManager,
        
        @inject(SOCKET_TOKENS.SocketEventRegistry)
        eventRegistry: ISocketEventRegistry,
        
        @inject(TEAM_TOKENS.TeamPresenceService)
        private readonly presenceService: ITeamPresenceService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if(!connection.user || !connection.user.teams || connection.user.teams.length === 0) return;

        const user = connection.user;
        const teamIds: string[] = user.teams!;

        // Record connection for activity tracking
        this.presenceService.recordConnection(connection.id, user._id, teamIds);

        // Join team rooms and notify online status
        for(const teamId of teamIds){
            const room = `team:${teamId}`;
            this.joinRoom(connection.id, room);

            this.emitToRoomExcept(connection.id, room, 'team_user_online', {
                teamId,
                userId: user._id,
                user: this.extractUser(connection)
            });
        }

        this.onDisconnect(connection.id, async (conn) => {
            if(!conn.user?.teams) return;

            // Record disconnection for activity tracking
            await this.presenceService.recordDisconnection(conn.id);

            // Notify teams of offline status
            for(const teamId of conn.user.teams){
                const room = `team:${teamId}`;
                this.emitToRoom(room, 'team_user_offline', {
                    teamId,
                    userId: conn.user._id
                });
            }
        });

        // Handle get team presence request
        this.on<{ teamId: string }>(
            connection.id,
            'get_team_presence',
            async (conn, { teamId }) => {
                if(!conn.user?.teams?.some((t: string) => t.toString() === teamId)) return;

                const room = `team:${teamId}`;
                const users = await this.collectPresence(room, (c) => this.extractUser(c));

                this.emitToSocket(conn.id, 'team_presence_list', { teamId, users });
            }
        );
    }

    private extractUser(connection: ISocketConnection): PresenceUser & { _id: string } {
        const userId = connection.user?._id || connection.userId || connection.id;

        return {
            id: userId,
            _id: userId,
            firstName: connection.user?.firstName,
            lastName: connection.user?.lastName,
            email: connection.user?.email,
            avatar: connection.user?.avatar,
            isAnonymous: !connection.user
        };
    }
}
