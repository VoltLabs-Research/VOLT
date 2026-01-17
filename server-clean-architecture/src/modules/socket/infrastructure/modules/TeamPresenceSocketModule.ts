import { inject, singleton } from 'tsyringe';
import BaseSocketModule from '../gateway/BaseSocketModule';
import { ISocketConnection } from '../../domain/ports/ISocketModule';
import { SOCKET_TOKENS } from '../di/SocketTokens';
import logger from '@/src/shared/infrastructure/logger';
import { container } from 'tsyringe';
import { DAILY_ACTIVITY_TOKENS } from '@/src/modules/daily-activity/infrastructure/di/DailyActivityTokens';
import UpdateUserActivityUseCase from '@/src/modules/daily-activity/application/use-cases/UpdateUserActivityUseCase';

interface TeamSession {
    teamId: string;
    startTime: number;
    userId: string;
};

@singleton()
export default class TeamPresenceSocketModule extends BaseSocketModule {
    public readonly name = 'TeamPresenceSocketModule';

    // Track active sessions: connectionId -> Session
    private activeSessions: Map<string, TeamSession> = new Map();

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: any,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: any,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: any
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[TeamPresenceSocketModule] Initialized');
    }

    onConnection(connection: ISocketConnection): void {
        this.on(connection.id, 'subscribe_to_team', async (conn, payload: { teamId: string }) => {
            const currentUserId = (conn as any).user?.id || (conn as any).userId || (conn.nativeSocket?.handshake?.query?.userId as string);

            if (!currentUserId) {
                logger.warn(`[TeamPresenceSocketModule] User not identified for connection ${conn.id}, cannot track presence.`);
                return;
            }

            const { teamId } = payload;
            const roomName = `team-${teamId}`;

            // Join room
            await this.joinRoom(conn.id, roomName);

            // Record session start
            this.activeSessions.set(conn.id, {
                teamId,
                startTime: Date.now(),
                userId: currentUserId
            });

            // Broadcast online status
            this.emitToRoom(roomName, 'user:online', { teamId, userId: currentUserId });

            const roomSessions = Array.from(this.activeSessions.values()).filter(s => s.teamId === teamId);
            const userList = roomSessions.map(s => ({ _id: s.userId }));
            const uniqueUsers = Array.from(new Set(userList.map(u => u._id)))
                .map(id => ({ _id: id }));

            this.emitToSocket(conn.id, 'user:list', { teamId, users: uniqueUsers });

            logger.info(`[TeamPresenceSocketModule] User ${currentUserId} joined team ${teamId}`);
        });

        this.on(connection.id, 'disconnect', async () => {
            this.handleDisconnection(connection.id);
        });

        this.on(connection.id, 'leave_team', async (conn, payload: { teamId: string }) => {
            if (this.activeSessions.has(conn.id) && this.activeSessions.get(conn.id)?.teamId === payload.teamId) {
                this.handleDisconnection(conn.id);
            }
            await this.leaveRoom(conn.id, `team-${payload.teamId}`);
        });
    }

    private async updateUserActivity(teamId: string, userId: string, minutes: number): Promise<void> {
        try {
            const updateUserActivityUseCase = container.resolve<UpdateUserActivityUseCase>(DAILY_ACTIVITY_TOKENS.UpdateUserActivityUseCase);
            await updateUserActivityUseCase.execute({
                teamId,
                userId,
                durationInMinutes: minutes
            });
        } catch (error) {
            logger.error(error, `[TeamPresenceSocketModule] Failed to update activity for user ${userId}`);
        }
    }

    private async handleDisconnection(connectionId: string) {
        const session = this.activeSessions.get(connectionId);
        if (!session) return;

        const { teamId, startTime, userId } = session;
        const sessionDurationMs = Date.now() - startTime;
        const sessionDurationMinutes = Math.floor(sessionDurationMs / 1000 / 60);

        const roomName = `team-${teamId}`;

        // Broadcast offline status
        this.emitToRoom(roomName, 'user:offline', { teamId: teamId, userId });
        logger.info(`[TeamPresenceSocketModule] User ${userId} left team ${teamId}. Session duration: ${sessionDurationMinutes}m`);

        // Cleanup session
        this.activeSessions.delete(connectionId);

        // Update activity once with total session time
        if (sessionDurationMinutes > 0) {
            await this.updateUserActivity(teamId, userId, sessionDurationMinutes);
        }
    }
}
