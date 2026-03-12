import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import SecretKeyCreatedEvent from '@modules/team/domain/events/secret-key/SecretKeyCreatedEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class SecretKeyCreatedEventHandler implements IEventHandler<SecretKeyCreatedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
    ) {}

    async handle(event: SecretKeyCreatedEvent): Promise<void> {
        const { teamId, userId, name } = event.payload;
        if (!teamId || !userId) return;
        const description = `Created secret key "${name}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.SecretKeyCreation,
            description
        );
    }
};
