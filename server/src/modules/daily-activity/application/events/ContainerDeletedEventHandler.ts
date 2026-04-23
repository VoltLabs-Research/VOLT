import ContainerDeletedEvent from '@modules/container/domain/events/ContainerDeletedEvent';
import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('container.deleted')
export default class ContainerDeletedEventHandler implements IEventHandler<ContainerDeletedEvent> {
    constructor(
        
        private activityRepo: DailyActivityRepository
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
