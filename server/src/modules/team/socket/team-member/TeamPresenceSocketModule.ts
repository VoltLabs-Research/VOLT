import { ErrorCodes } from '@core/constants/error-codes';
import UserModel from '@modules/auth/models/UserModel';
import type { SubscribeToTeamSocketPayload, TeamScopedSocketPayload } from '@modules/socket/contracts/team-subscription';
import type { ISocketConnection } from '@modules/socket/ports/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { socketTeamSubscriptionCoordinator } from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import TeamPresenceService, { DetachedTeamPresenceSession } from '@modules/team/services/team-member/TeamPresenceService';
import TeamRoomPresenceService from '@modules/team/services/team-member/TeamRoomPresenceService';
import { GenericDomainEvent } from '@shared/domain/events/GenericDomainEvent';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { DOMAIN_EVENTS } from '@shared/contracts/events';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { container as diContainer } from 'tsyringe';

export class TeamPresenceSocketModule extends BaseSocketModule {
    public readonly name = 'TeamPresenceSocketModule';

    private unsubscribeFromTeamSubscription?: () => void;

    // `TeamPresenceService` and `TeamRoomPresenceService` have no runtime DI
    // dependencies of their own, so they're safe to construct eagerly here.
    private readonly teamPresenceService = new TeamPresenceService();
    private readonly teamRoomPresenceService = new TeamRoomPresenceService();
    private readonly teamSubscriptionService = socketTeamSubscriptionCoordinator;

    // `EventBus` is registered in `registerAllDependencies` (which hasn't run
    // yet when this module is constructed at import time), so it must be
    // resolved lazily — on first actual use — to avoid the eager-singleton DI
    // boot race.
    #eventBusCache?: IEventBus;
    private get eventBus(): IEventBus {
        return (this.#eventBusCache ??= diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus));
    }

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
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
            const heartbeat = this.teamPresenceService.registerHeartbeat(connection.id, payload.teamId);

            if (!heartbeat || heartbeat.minutesToPersist <= 0) {
                return;
            }

            await this.updateUserActivity(heartbeat.teamId, heartbeat.userId, heartbeat.minutesToPersist);
        });

        this.on<TeamScopedSocketPayload>(connection.id, 'leave_team', async (conn, payload) => {
            const detachedSession = await this.handleDisconnection(conn.id, true);

            if (!detachedSession || detachedSession.teamId !== payload.teamId) {
                await this.leaveRoom(conn.id, `team:${payload.teamId}`);
            }

            if (this.teamSubscriptionService.getCurrentTeamId(conn) === payload.teamId) {
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
            await this.eventBus.publish(
                new GenericDomainEvent(DOMAIN_EVENTS.UserActivityRecorded, { teamId, userId, minutes })
            );
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
                    await UserModel.findByIdAndUpdate(session.userId, { lastSeenAt: session.endedAt });
                }
            }
        }

        logger.info(`[TeamPresenceSocketModule] User ${session.userId} left team ${session.teamId}. Flushed ${session.minutesToPersist.toFixed(2)}m`);

        if (session.minutesToPersist > 0) {
            await this.updateUserActivity(session.teamId, session.userId, session.minutesToPersist);
        }
    }
}

export default new TeamPresenceSocketModule();
