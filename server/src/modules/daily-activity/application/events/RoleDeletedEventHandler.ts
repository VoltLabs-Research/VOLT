import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import TeamRoleDeletedEvent from '@modules/team/domain/events/team-role/TeamRoleDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team-role.deleted')
export default class RoleDeletedEventHandler implements IEventHandler<TeamRoleDeletedEvent> {
    constructor(
        private activityRepo: DailyActivityRepository
    ) {}

    async handle(event: TeamRoleDeletedEvent): Promise<void> {
        const { teamId, userId, roleName } = event.payload;
        if (!teamId || !userId) return;
        const description = `Deleted role "${roleName}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.RoleDeletion,
            description
        );
    }
}
