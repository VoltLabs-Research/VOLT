import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import { IApiTrackerRepository } from '../../domain/ports/IApiTrackerRepository';
import logger from '@/src/shared/infrastructure/logger';

interface UserDeletedEvent {
    userId: string;
    occurredOn: Date;
    name: string;
    eventId: string;
}

@injectable()
export class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent> {
    constructor(
        @inject('IApiTrackerRepository') private repository: IApiTrackerRepository
    ) { }

    async handle(event: UserDeletedEvent): Promise<void> {
        logger.info(`@api-tracker: Handling user:deleted event for user ${event.userId}`);

        await this.repository.deleteByUserId(event.userId);

        logger.info(`@api-tracker: Deleted all API tracker records for user ${event.userId}`);
    }
}
