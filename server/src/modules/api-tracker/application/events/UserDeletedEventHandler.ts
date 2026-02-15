import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { IApiTrackerRepository } from '@modules/api-tracker/domain/ports/IApiTrackerRepository';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';
import { API_TRACKER_TOKENS } from '@modules/api-tracker/infrastructure/di/ApiTrackerTokens';
import logger from '@shared/infrastructure/logger';

@injectable()
export class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent> {
    constructor(
        @inject(API_TRACKER_TOKENS.ApiTrackerRepository) private repository: IApiTrackerRepository
    ){}

    async handle(event: UserDeletedEvent): Promise<void> {
        logger.info(`@api-tracker: Handling user.deleted event for user ${event.payload.userId}`);

        await this.repository.deleteByUserId(event.payload.userId);

        logger.info(`@api-tracker: Deleted all API tracker records for user ${event.payload.userId}`);
    }
}
