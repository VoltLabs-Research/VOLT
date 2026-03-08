import TeamJobsService from './TeamJobsService';
import SocketTeamSubscriptionCoordinator from '@modules/socket/services/team-subscription/SocketTeamSubscriptionCoordinator';
import { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import logger from '@shared/infrastructure/logger';
import { inject, singleton } from 'tsyringe';
import type { SubscribeToTeamSocketPayload } from '@modules/socket/domain/contracts/team-subscription';

@singleton()
export default class TeamJobsSocketModule extends BaseSocketModule {
    public readonly name = 'TeamJobsSocketModule';
    private unsubscribeFromTeamSubscription?: () => void;

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry,
        @inject(TEAM_TOKENS.TeamJobsService) private readonly teamJobsService: TeamJobsService,
        @inject(SOCKET_TOKENS.TeamSubscriptionCoordinator)
        private readonly teamSubscriptionService: SocketTeamSubscriptionCoordinator
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[TeamJobsSocketModule] Initialized');
        this.unsubscribeFromTeamSubscription = this.teamSubscriptionService.subscribe(async ({ connection, subscription }) => {
            await this.sendInitialJobs(connection, {
                teamId: subscription.teamId,
                previousTeamId: subscription.previousTeamId
            });
        });
    }

    async onShutdown(): Promise<void> {
        this.unsubscribeFromTeamSubscription?.();
    }

    onConnection(connection: ISocketConnection): void {
        this.onDisconnect(connection.id, async () => {
            logger.debug(`[TeamJobsSocketModule] Connection ${connection.id} disconnected`);
        });
    }

    private async sendInitialJobs(
        connection: ISocketConnection,
        payload: SubscribeToTeamSocketPayload
    ): Promise<void> {
        const teamRoom = `team:${payload.teamId}`;
        logger.info(`[TeamJobsSocketModule] Connection ${connection.id} joined team room: ${teamRoom}`);

        try {
            const groupedJobs = await this.teamJobsService.getTeamJobs(payload.teamId);
            this.emitToSocket(connection.id, 'team.jobs.initial', groupedJobs);
            logger.debug(`[TeamJobsSocketModule] Sent ${groupedJobs.length} job groups to connection ${connection.id}`);
        } catch (error) {
            logger.error(error, `[TeamJobsSocketModule] Failed to fetch jobs for team ${payload.teamId}`);
        }
    }
};
