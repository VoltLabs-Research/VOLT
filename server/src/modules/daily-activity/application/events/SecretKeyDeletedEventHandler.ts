import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import SecretKeyDeletedEvent from '@modules/team/domain/events/secret-key/SecretKeyDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('secret-key.deleted')
export default class SecretKeyDeletedEventHandler implements IEventHandler<SecretKeyDeletedEvent> {
    constructor(
        
        private activityRepo: DailyActivityRepository
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
