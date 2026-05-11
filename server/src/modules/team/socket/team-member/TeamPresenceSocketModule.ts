import { ErrorCodes } from '@core/constants/error-codes';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import UpdateUserActivityUseCase from '@modules/daily-activity/application/use-cases/UpdateUserActivityUseCase';
import type { SubscribeToTeamSocketPayload, TeamScopedSocketPayload } from '@modules/socket/domain/contracts/team-subscription';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { formatSocketValidationError } from '@modules/socket/utilities/socket-validation-error';
import { teamScopedSocketPayloadSchema } from '@modules/socket/utilities/team-subscription-schemas';
import TeamPresenceService, { DetachedTeamPresenceSession } from '@modules/team/infrastructure/services/team-member/TeamPresenceService';
import TeamRoomPresenceService from '@modules/team/infrastructure/services/team-member/TeamRoomPresenceService';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class TeamPresenceSocketModule extends BaseSocketModule {
    public readonly name = 'TeamPresenceSocketModule';

    private unsubscribeFromTeamSubscription?: () => void;

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        
        private readonly teamPresenceService: TeamPresenceService,
        private readonly teamRoomPresenceService: TeamRoomPresenceService,
        
        private readonly userRepository: UserRepository,
        
        private readonly updateUserActivityUseCase: UpdateUserActivityUseCase,
        
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

        const onlineUserIds = await this.teamRoomPresenceService.getOnlineUserIds(payload.teamId);

        this.emitToSocket(connection.id, 'user:list', {
            teamId: payload.teamId,
            users: onlineUserIds.map((_id) => ({ _id }))
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
            const isStillOnlineInTeam = await this.teamRoomPresenceService.isUserOnline(session.teamId, session.userId);

            if (!isStillOnlineInTeam) {
                this.emitToRoom(roomName, 'user:offline', {
                    teamId: session.teamId,
                    userId: session.userId
                });

                if (session.userWentOfflineCompletely) {
                    await this.userRepository.updateById(session.userId, { lastSeenAt: session.endedAt });
                }
            }
        }

        logger.info(`[TeamPresenceSocketModule] User ${session.userId} left team ${session.teamId}. Flushed ${session.minutesToPersist.toFixed(2)}m`);

        if (session.minutesToPersist > 0) {
            await this.updateUserActivity(session.teamId, session.userId, session.minutesToPersist);
        }
    }
};
