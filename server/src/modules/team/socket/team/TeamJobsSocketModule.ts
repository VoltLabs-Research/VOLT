import type { SubscribeToTeamSocketPayload } from '@modules/socket/domain/contracts/team-subscription';
import { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TeamJobsService from './TeamJobsService';

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class TeamJobsSocketModule extends BaseSocketModule {
    public readonly name = 'TeamJobsSocketModule';
    private unsubscribeFromTeamSubscription?: () => void;

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        private readonly teamJobsService: TeamJobsService,
        
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
            const groupedJobs = await this.teamJobsService.getInitialTeamJobs(payload.teamId);
            this.emitToSocket(connection.id, 'team.jobs.initial', groupedJobs);
            logger.debug(`[TeamJobsSocketModule] Sent ${groupedJobs.groups.length} job groups to connection ${connection.id}`);
        } catch (error) {
            logger.error(error, `[TeamJobsSocketModule] Failed to fetch jobs for team ${payload.teamId}`);
        }
    }
};
