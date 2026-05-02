import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import SecretKeyCreatedEvent from '@modules/team/domain/events/secret-key/SecretKeyCreatedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('secret-key.created')
export default class SecretKeyCreatedEventHandler implements IEventHandler<SecretKeyCreatedEvent> {
    constructor(
        private activityRepo: DailyActivityRepository
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
}
