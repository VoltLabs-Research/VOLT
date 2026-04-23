import ContainerCreatedEvent from '@modules/container/domain/events/ContainerCreatedEvent';
import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('container.created')
export default class ContainerCreatedEventHandler implements IEventHandler<ContainerCreatedEvent> {
    constructor(
        
        private activityRepo: DailyActivityRepository
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
