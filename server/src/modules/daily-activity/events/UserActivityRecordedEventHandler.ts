import DailyActivityService from '@modules/daily-activity/services/DailyActivityService';
import type { UserActivityRecordedPayload } from '@shared/contracts/events';
import { DOMAIN_EVENTS } from '@shared/contracts/events';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';
import logger from '@shared/infrastructure/logger';

class UserActivityRecordedEventHandler implements IEventHandler<IDomainEvent<UserActivityRecordedPayload>> {
    #service = new DailyActivityService();

    async handle(event: IDomainEvent<UserActivityRecordedPayload>): Promise<void> {
        const { teamId, userId, minutes } = event.payload;

        try {
            await this.#service.recordOnlineMinutes(teamId, userId, minutes);
        } catch (error) {
            logger.error(error, `[UserActivityRecordedEventHandler] Failed to update activity for user ${userId}`);
        }
    }
}

const userActivityRecordedEventHandler = new UserActivityRecordedEventHandler();
subscribeHandler(DOMAIN_EVENTS.UserActivityRecorded, userActivityRecordedEventHandler);

export default userActivityRecordedEventHandler;
