import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { IContainerRepository } from '@modules/container/domain/ports/IContainerRepository';
import { IContainerService } from '@modules/container/domain/ports/IContainerService';
import logger from '@shared/infrastructure/logger';

interface TeamDeletedEvent {
    teamId: string;
    occurredOn: Date;
    name: string;
    eventId: string;
}

@injectable()
export class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService
    ){}

    async handle(event: TeamDeletedEvent): Promise<void> {
        logger.info(`@container: Handling team:deleted event for team ${event.teamId}`);

        // Stop and remove Docker containers before deleting DB records
        const result = await this.repository.findAll({ filter: { team: event.teamId } as any });
        for (const container of result.data) {
            try {
                await this.containerService.removeContainer(container.containerId);
                logger.info(`@container: Removed Docker container ${container.containerId} for team ${event.teamId}`);
            } catch (e: any) {
                logger.error(`@container: Failed to remove Docker container ${container.containerId}: ${e.message}`);
            }
        }

        await this.repository.deleteByTeamId(event.teamId);

        logger.info(`@container: Deleted all containers for team ${event.teamId}`);
    }
}
