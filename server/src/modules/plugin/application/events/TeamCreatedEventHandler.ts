import { IEventHandler } from '@shared/application/events/IEventHandler';
import TeamCreatedEvent from '@modules/team/domain/events/team/TeamCreatedEvent';
import logger from '@shared/infrastructure/logger';
import { injectable } from 'tsyringe';

@injectable()
export default class TeamCreatedEventHandler implements IEventHandler<TeamCreatedEvent> {
    async handle(event: TeamCreatedEvent): Promise<void> {
        logger.info({
            action: 'plugin.default-bootstrap.deferred',
            teamId: event.payload.teamId,
            ownerId: event.payload.ownerId
        }, 'Skipping default plugin bootstrap on team creation until the first cluster connects');
    }
};
