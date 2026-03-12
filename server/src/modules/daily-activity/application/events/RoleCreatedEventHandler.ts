import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import TeamRoleCreatedEvent from '@modules/team/domain/events/team-role/TeamRoleCreatedEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class RoleCreatedEventHandler implements IEventHandler<TeamRoleCreatedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
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
