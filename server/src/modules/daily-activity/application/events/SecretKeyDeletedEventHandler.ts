import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import SecretKeyDeletedEvent from '@modules/team/domain/events/secret-key/SecretKeyDeletedEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class SecretKeyDeletedEventHandler implements IEventHandler<SecretKeyDeletedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
    ) {}

    async handle(event: SecretKeyDeletedEvent): Promise<void> {
        const { teamId, userId, secretKeyName } = event.payload;
        if (!teamId || !userId) return;
        const description = `Deleted secret key "${secretKeyName}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.SecretKeyDeletion,
            description
        );
    }
};
