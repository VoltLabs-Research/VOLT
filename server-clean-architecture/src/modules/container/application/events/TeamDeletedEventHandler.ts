import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import { IContainerRepository } from '../../domain/ports/IContainerRepository';
import logger from '@/src/shared/infrastructure/logger';

interface TeamDeletedEvent {
    teamId: string;
    occurredOn: Date;
    name: string;
    eventId: string;
}

@injectable()
export class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository
    ) { }

    async handle(event: TeamDeletedEvent): Promise<void> {
        logger.info(`@container: Handling team:deleted event for team ${event.teamId}`);

        await this.repository.deleteByTeamId(event.teamId);

        logger.info(`@container: Deleted all containers for team ${event.teamId}`);
    }
}
