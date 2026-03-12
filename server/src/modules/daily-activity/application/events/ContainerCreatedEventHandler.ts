import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import ContainerCreatedEvent from '@modules/container/domain/events/ContainerCreatedEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class ContainerCreatedEventHandler implements IEventHandler<ContainerCreatedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
    ) {}

    async handle(event: ContainerCreatedEvent): Promise<void> {
        const { teamId, userId, name } = event.payload;
        if (!teamId || !userId) return;
        const description = `Created Docker container "${name}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.ContainerCreation,
            description
        );
    }
};
