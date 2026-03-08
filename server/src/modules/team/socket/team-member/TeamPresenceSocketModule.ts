import { ErrorCodes } from '@core/constants/error-codes';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import UpdateUserActivityUseCase from '@modules/daily-activity/application/use-cases/UpdateUserActivityUseCase';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { formatSocketValidationError } from '@modules/socket/utilities/socket-validation-error';
import { teamScopedSocketPayloadSchema } from '@modules/socket/utilities/team-subscription-schemas';
import TeamPresenceService, { DetachedTeamPresenceSession } from '@modules/team/infrastructure/services/team-member/TeamPresenceService';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import logger from '@shared/infrastructure/logger';
import { inject, singleton } from 'tsyringe';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { SubscribeToTeamSocketPayload, TeamScopedSocketPayload } from '@modules/socket/domain/contracts/team-subscription';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';

@singleton()
export default class TeamPresenceSocketModule extends BaseSocketModule {
    public readonly name = 'TeamPresenceSocketModule';

    private unsubscribeFromTeamSubscription?: () => void;

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry,
        @inject(TEAM_TOKENS.TeamPresenceService)
        private readonly teamPresenceService: TeamPresenceService,
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,
        @inject(DAILY_ACTIVITY_TOKENS.UpdateUserActivityUseCase)
        private readonly updateUserActivityUseCase: UpdateUserActivityUseCase,
        @inject(SOCKET_TOKENS.TeamSubscriptionCoordinator)
        private readonly teamSubscriptionService: SocketTeamSubscriptionCoordinator
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[TeamPresenceSocketModule] Initialized');
        this.unsubscribeFromTeamSubscription = this.teamSubscriptionService.subscribe(async ({ connection, subscription }) => {
            await this.handleTeamSubscription(connection, {
                teamId: subscription.teamId,
                previousTeamId: subscription.previousTeamId
            });
        });
    }

    async onShutdown(): Promise<void> {
        this.unsubscribeFromTeamSubscription?.();
    }

    onConnection(connection: ISocketConnection): void {
        this.on<TeamScopedSocketPayload>(connection.id, 'team:heartbeat', async (_conn, payload) => {
            const parsed = teamScopedSocketPayloadSchema.safeParse(payload);

            if (!parsed.success) {
                this.emitErrorToSocket(
                    connection.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    formatSocketValidationError(parsed.error)
                );
                return;
            }

            const heartbeat = this.teamPresenceService.registerHeartbeat(connection.id, parsed.data.teamId);

            if (!heartbeat || heartbeat.minutesToPersist <= 0) {
                return;
            }

            await this.updateUserActivity(heartbeat.teamId, heartbeat.userId, heartbeat.minutesToPersist);
        });

        this.on<TeamScopedSocketPayload>(connection.id, 'leave_team', async (conn, payload) => {
            const parsed = teamScopedSocketPayloadSchema.safeParse(payload);

            if (!parsed.success) {
                this.emitErrorToSocket(
                    conn.id,
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    formatSocketValidationError(parsed.error)
                );
                return;
            }

            const detachedSession = await this.handleDisconnection(conn.id, true);

            if (!detachedSession || detachedSession.teamId !== parsed.data.teamId) {
                await this.leaveRoom(conn.id, `team:${parsed.data.teamId}`);
            }

            if (this.teamSubscriptionService.getCurrentTeamId(conn) === parsed.data.teamId) {
                this.teamSubscriptionService.clearCurrentTeamId(conn);
            }
        });

        this.onDisconnect(connection.id, async (conn) => {
            this.teamSubscriptionService.clearCurrentTeamId(conn);
            await this.handleDisconnection(conn.id);
        });
    }

    private async handleTeamSubscription(
        connection: ISocketConnection,
        payload: SubscribeToTeamSocketPayload
    ): Promise<void> {
        const currentUserId = connection.user?._id ?? connection.userId;

        if (!currentUserId) {
            logger.warn(`[TeamPresenceSocketModule] User not identified for connection ${connection.id}, cannot track presence.`);
            return;
        }

        const attachResult = this.teamPresenceService.attachConnection(connection.id, payload.teamId, currentUserId);

        if (attachResult.detachedSession) {
            await this.finalizeDetachedSession(connection.id, attachResult.detachedSession, false);
        }

        if (attachResult.userBecameOnline) {
            this.emitToRoom(`team:${payload.teamId}`, 'user:online', {
                teamId: payload.teamId,
                userId: currentUserId
            });
        }

        this.emitToSocket(connection.id, 'user:list', {
            teamId: payload.teamId,
            users: attachResult.onlineUserIds.map((_id) => ({ _id }))
        });

        logger.info(`[TeamPresenceSocketModule] User ${currentUserId} joined team ${payload.teamId}`);
    }

    private async updateUserActivity(teamId: string, userId: string, minutes: number): Promise<void> {
        try {
            await this.updateUserActivityUseCase.execute({
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
};
