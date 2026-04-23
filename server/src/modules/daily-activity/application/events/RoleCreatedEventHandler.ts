import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import TeamRoleCreatedEvent from '@modules/team/domain/events/team-role/TeamRoleCreatedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team-role.created')
export default class RoleCreatedEventHandler implements IEventHandler<TeamRoleCreatedEvent> {
    constructor(
        
        private activityRepo: DailyActivityRepository
    ) {}

    async handle(event: TeamRoleCreatedEvent): Promise<void> {
        const { teamId, userId, name } = event.payload;
        if (!teamId || !userId) return;
        const description = `Created role "${name}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.RoleCreation,
            description
        );
    }
};
