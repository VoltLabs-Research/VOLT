import UpdateUserActivityUseCase from '@modules/daily-activity/application/use-cases/UpdateUserActivityUseCase';
import type { UserActivityRecordedPayload } from '@shared/contracts/events';
import { DOMAIN_EVENTS } from '@shared/contracts/events';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

@Subscribe(DOMAIN_EVENTS.UserActivityRecorded)
export default class UserActivityRecordedEventHandler implements IEventHandler<IDomainEvent<UserActivityRecordedPayload>> {
    constructor(
        private readonly updateUserActivityUseCase: UpdateUserActivityUseCase
    ) {}

    async handle(event: IDomainEvent<UserActivityRecordedPayload>): Promise<void> {
        const { teamId, userId, minutes } = event.payload;

        try {
            await this.updateUserActivityUseCase.execute({
                teamId,
                userId,
                durationInMinutes: minutes
            });
        } catch (error) {
            logger.error(error, `[UserActivityRecordedEventHandler] Failed to update activity for user ${userId}`);
        }
    }
};
