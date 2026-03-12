import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import ContainerDeletedEvent from '@modules/container/domain/events/ContainerDeletedEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class ContainerDeletedEventHandler implements IEventHandler<ContainerDeletedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
    ) {}

    async handle(event: ContainerDeletedEvent): Promise<void> {
        const { teamId, userId, containerName } = event.payload;
        if (!teamId || !userId) return;
        const description = `Deleted Docker container "${containerName}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.ContainerDeletion,
            description
        );
    }
};
