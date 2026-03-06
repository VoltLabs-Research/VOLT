import { inject, singleton } from 'tsyringe';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import logger from '@shared/infrastructure/logger';
import { container } from 'tsyringe';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import UpdateUserActivityUseCase from '@modules/daily-activity/application/use-cases/UpdateUserActivityUseCase';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamPresenceService, { DetachedTeamPresenceSession } from '@modules/team/application/services/TeamPresenceService';

@singleton()
export default class TeamPresenceSocketModule extends BaseSocketModule {
    public readonly name = 'TeamPresenceSocketModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: any,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: any,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: any,
        @inject(TEAM_TOKENS.TeamPresenceService)
        private readonly teamPresenceService: TeamPresenceService,
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[TeamPresenceSocketModule] Initialized');
    }

    onConnection(connection: ISocketConnection): void {
        this.on(connection.id, 'subscribe_to_team', async (conn, payload: { teamId: string; previousTeamId?: string }) => {
            const currentUserId = (conn as any).user?.id || (conn as any).userId || (conn.nativeSocket?.handshake?.query?.userId as string);

            if (!currentUserId) {
                logger.warn(`[TeamPresenceSocketModule] User not identified for connection ${conn.id}, cannot track presence.`);
                return;
            }

            const { teamId, previousTeamId } = payload;
            const roomName = `team:${teamId}`;
            const attachResult = this.teamPresenceService.attachConnection(conn.id, teamId, currentUserId);

            if (attachResult.detachedSession) {
                await this.finalizeDetachedSession(conn.id, attachResult.detachedSession, true);
            } else if (previousTeamId && previousTeamId !== teamId) {
                await this.leaveRoom(conn.id, `team:${previousTeamId}`);
            }

            await this.joinRoom(conn.id, roomName);

            if (attachResult.userBecameOnline) {
                this.emitToRoom(roomName, 'user:online', { teamId, userId: currentUserId });
            }

            this.emitToSocket(conn.id, 'user:list', {
                teamId,
                users: attachResult.onlineUserIds.map((_id) => ({ _id }))
            });

            logger.info(`[TeamPresenceSocketModule] User ${currentUserId} joined team ${teamId}`);
        });

        this.on(connection.id, 'team:heartbeat', async (_conn, payload: { teamId: string }) => {
            const heartbeat = this.teamPresenceService.registerHeartbeat(connection.id, payload.teamId);

            if (!heartbeat || heartbeat.minutesToPersist <= 0) {
                return;
            }

            await this.updateUserActivity(
                heartbeat.teamId,
                heartbeat.userId,
                heartbeat.minutesToPersist
            );
        });

        this.on(connection.id, 'disconnect', async () => {
            await this.handleDisconnection(connection.id);
        });

        this.on(connection.id, 'leave_team', async (conn, payload: { teamId: string }) => {
            const detachedSession = await this.handleDisconnection(conn.id, true);

            if (!detachedSession || detachedSession.teamId !== payload.teamId) {
                await this.leaveRoom(conn.id, `team:${payload.teamId}`);
            }
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

    private async handleDisconnection(
        connectionId: string,
        leaveRoom = false
    ): Promise<DetachedTeamPresenceSession | null> {
        const detachedSession = this.teamPresenceService.detachConnection(connectionId);

        if (!detachedSession) {
            return null;
        }

        await this.finalizeDetachedSession(connectionId, detachedSession, leaveRoom);
        return detachedSession;
    }

    private async finalizeDetachedSession(
        connectionId: string,
        session: DetachedTeamPresenceSession,
        leaveRoom: boolean
    ): Promise<void> {
        const roomName = `team:${session.teamId}`;

        if (leaveRoom) {
            await this.leaveRoom(connectionId, roomName);
        }

        if (session.userWentOffline) {
            this.emitToRoom(roomName, 'user:offline', {
                teamId: session.teamId,
                userId: session.userId
            });
            if (session.userWentOfflineCompletely) {
                await this.userRepository.updateLastSeen(session.userId, session.endedAt);
            }
        }

        logger.info(`[TeamPresenceSocketModule] User ${session.userId} left team ${session.teamId}. Flushed ${session.minutesToPersist.toFixed(2)}m`);

        if (session.minutesToPersist > 0) {
            await this.updateUserActivity(session.teamId, session.userId, session.minutesToPersist);
        }
    }
}
