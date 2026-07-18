import type { SubscribeToTeamSocketPayload } from '@modules/socket/contracts/team-subscription';
import { ISocketConnection } from '@modules/socket/ports/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { socketTeamSubscriptionCoordinator } from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import logger from '@shared/infrastructure/logger';
import TeamJobsService from './TeamJobsService';

export class TeamJobsSocketModule extends BaseSocketModule {
    public readonly name = 'TeamJobsSocketModule';
    private unsubscribeFromTeamSubscription?: () => void;
    private readonly teamSubscriptionService = socketTeamSubscriptionCoordinator;
    private readonly teamJobsService = new TeamJobsService();

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
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
}

export default new TeamJobsSocketModule();
